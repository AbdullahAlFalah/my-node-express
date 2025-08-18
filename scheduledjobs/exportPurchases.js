const { google } = require('googleapis');
const { Readable } = require('stream');
const cron = require('node-cron');
const ExcelJS = require('exceljs');
const mysqlpool = require('../DifferentDatabases/MySQL');
const { sendExportNotifyEmail } = require('../utils/sendEmail');

// Load your OAuth2 client credentials
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Configuration constants
const CRON_SCHEDULE = '0 0 1 * *'; // Runs once per month on the 1st at midnight (cron format: minute hour dayOfMonth month dayOfWeek)
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const WORKSHEET_NAME = 'Purchases';

// Create OAuth2 client with refresh token
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Google Drive API client
const drive = google.drive({ version: 'v3', auth: oAuth2Client });

/**
 * Create Excel workbook in memory and upload directly to Drive
 * @fileoverview Scheduled job to export purchases to Excel and upload to Google Drive
 * @version 1.0.0
 * @param {Array<{purchaseId: number, userId: number, items: string, totalCost: number, currency: string, status: string, createdAt: Date, updatedAt: Date}>} purchases
 * @returns {Promise<string>} Google Drive file ID of the uploaded Excel file
 * @throws {Error} If purchases array is empty or upload fails
 */

async function exportPurchasesToDrive(purchases) {

    if (!Array.isArray(purchases) || !purchases.length) {
        throw new Error('No purchases to export');
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

    // Define columns with proper formatting
    worksheet.columns = [
        { header: 'Purchase ID', key: 'purchaseId', width: 15 },
        { header: 'User ID', key: 'userId', width: 15 },
        { header: 'Items', key: 'items', width: 40 },
        { header: 'Total Cost', key: 'totalCost', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Updated At', key: 'updatedAt', width: 20 }
    ];

    // Add data and format dates
    purchases.forEach(purchase => {
        worksheet.addRow({
            ...purchase,
            items: JSON.stringify(purchase.items), // Format JSON items as string
            createdAt: new Date(purchase.createdAt).toLocaleString(),
            updatedAt: new Date(purchase.updatedAt).toLocaleString()
        });
    });

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `purchases_${Date.now()}.xlsx`;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        throw new Error('Google Drive folder ID not configured');
    }

    // Create a readable stream from buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Upload buffer directly to Drive
    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };

    const media = {
        mimeType: MIME_TYPE,
        body: stream
    };
               
    const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
    });

    // Send notification email
    await sendExportNotifyEmail(
        fileName,
        response.data.id
    );
        
    return response.data.id;

}

// Main schedule handler with single try-catch
cron.schedule(CRON_SCHEDULE, async () => {
  const startTime = new Date();
  console.log(`⏰ Starting purchase export job at ${startTime.toLocaleString()}`);

  mysqlpool.query('SELECT * FROM purchases', async (err, results) => {
    if (err) {
      console.error('Error fetching purchases:', err);
      return;
    }

    if (!results.length) {
      console.log('No purchases found to export.');
      return;
    }

    // Call the async function to handle the rest
    try {
        const fileId = await exportPurchasesToDrive(results);
        console.log(`✅ Purchases exported to Google Drive (file ID: ${fileId})`);
        console.log(`📊 Total records: ${results.length}`);
        console.log(`📅 Export time: ${new Date().toLocaleString()}`);
    } catch (error) {
        console.error('❌ Export/upload failed:', {
          message: error.message,
          stack: error.stack,
          time: new Date().toLocaleString(),
          totalPurchases: results.length
        });
    }

  });

});


