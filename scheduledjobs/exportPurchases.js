const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

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
const TOKEN_PATH = path.join(__dirname, '../Keys/token.json');

// Configuration constants
const CRON_SCHEDULE = '0 0 1 * *'; // Runs once per month on the 1st at midnight (cron format: minute hour dayOfMonth month dayOfWeek)
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const WORKSHEET_NAME = 'Purchases';

// Load the full token object from token.json
if (!fs.existsSync(TOKEN_PATH)) {
  throw new Error('token.json not found! Run your auth script first!');
}
const tokenRaw = fs.readFileSync(TOKEN_PATH, 'utf8');
const token = JSON.parse(tokenRaw);

console.log({ CLIENT_ID, CLIENT_SECRET, REDIRECT_URI });

// Create OAuth2 client with the full token
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials(token);

// Listen for token refreshes and save them automatically
oAuth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('Refreshed token saved!');
  }
});

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
    const fileName = `purchases_${new Date().toISOString().split('T')[0]}.xlsx`;
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

{/*
    
// Create a small test file
const content = 'Hello Drive! This is a test.';
const bufferStream = new Readable();
bufferStream.push(Buffer.from(content));
bufferStream.push(null);

// For testing upload only
(async () => {
  try {
    const response = await drive.files.create({
      resource: { name: `test_upload_${Date.now()}.txt`, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] },
      media: { mimeType: 'text/plain', body: bufferStream },
      fields: 'id',
    });
    console.log('✅ Test file uploaded successfully. File ID:', response.data.id);
  } catch (err) {
    console.error('❌ Upload failed:', err);
  }
})();

*/}
