const { google } = require('googleapis');
const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const mysqlpool = require('../DifferentDatabases/vercelMySQL');
const { sendExportNotifyEmail } = require('../utils/sendEmail');

// We pass the OAuth client and credentials in dynamically
async function runVercelExport() {
  const startTime = new Date();
  console.log(`⏰ Starting purchase export job at ${startTime.toLocaleString()}`);

  return new Promise((resolve, reject) => {
    // 1. Setup Auth from Env Var
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Parse the token JSON string we will store in Vercel
    const token = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
    oauth2Client.setCredentials(token);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 2. Fetch Data
    mysqlpool.query('SELECT * FROM purchases', async (err, results) => {
      if (err) {
        console.error('Error fetching purchases:', err);
        return reject(err);
      }
      if (!results.length) {
        console.log('No purchases found to export.');
        return resolve('No data to export');
      }

      try {
        // --- Your Legacy Logic Starts Here (ExcelJS + Upload) ---
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Purchases');
        
        // Define columns with proper formatting
        worksheet.columns = [
          { header: 'Purchase ID', key: 'purchaseId', width: 15 },
          { header: 'User ID', key: 'userId', width: 15 },
          { header: 'Items', key: 'items', width: 50 },
          { header: 'Total Cost', key: 'totalCost', width: 15 },
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Created At', key: 'createdAt', width: 25 },
          { header: 'Updated At', key: 'updatedAt', width: 25 }
        ];

        results.forEach(purchase => {
          worksheet.addRows({
            ...purchase,
            items: JSON.stringify(purchase.items), // Format JSON items as string
            createdAt: new Date(purchase.createdAt).toLocaleString(),
            updatedAt: new Date(purchase.updatedAt).toLocaleString()
          });
        });
        
        // Generate Excel buffer and creaate a readable stream for upload
        const buffer = await workbook.xlsx.writeBuffer();
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        // Variables
        const fileName = `Purchases_New_Vercel_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        if (!folderId) {
            throw new Error('Google Drive folder ID not configured');
        }

        const response = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: folderId,
          },
          media: {
            mimeType: MIME_TYPE,
            body: bufferStream,
          },
          fields: 'id',
        });

        await sendExportNotifyEmail(
          fileName,
          response.data.id,
        );

        console.log(`✅ Purchases exported to Google Drive (file ID: ${response.data.id})`);
        console.log(`📊 Total records: ${results.length}`);
        console.log(`📅 Export time: ${new Date().toLocaleString()}`);

        resolve(response.data.id);
      } catch (error) {
        console.error('❌ Export/upload failed:', {
          message: error.message,
          stack: error.stack,
          time: new Date().toLocaleString(),
          totalPurchases: results.length
        });
        reject(error);
      }
    });
  });
}

module.exports = { runVercelExport };
