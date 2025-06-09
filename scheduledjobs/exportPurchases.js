const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const ExcelJS = require('exceljs');
const mysqlpool = require('../DifferentDatabases/MySQL');
const { sendExportNotifyEmail } = require('../utils/sendEmail');

// Load your service account key
const KEYFILEPATH = path.join(__dirname, '../Keys/service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

async function uploadToDrive(filePath, fileName, folderId) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId], // Google Drive folder ID
  };
  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: fs.createReadStream(filePath),
  };
  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });
  return res.data.id;
}

async function ExportPurchases(results) {
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchases');
    worksheet.columns = Object.keys(results[0] || {}).map(key => ({
      header: key,
      key: key,
      width: 20
    }));
    results.forEach(row => worksheet.addRow(row));

    const fileName = `purchases_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, `../exports/${fileName}`);
    await workbook.xlsx.writeFile(filePath);

    // Upload to Google Drive
    const folderId = '1NdfeATq6AQOSQ3kOr4cxOuQOPTfYgIG9'; // Folder ID in Google Drive
    try {
      const fileId = await uploadToDrive(filePath, fileName, folderId);
      console.log(`✅ Purchases exported and uploaded to Google Drive (file ID: ${fileId})`);

      // Send notification email after successful upload
      await sendExportNotifyEmail(
        process.env.EMAIL_USER, // send to myself
        fileName,
        fileId
      );
      console.log('✅ Export notification email sent.');
    } catch (e) {
      console.error('❌ Failed to upload to Google Drive:', e.message);
    }

}

cron.schedule('0 0 * * 2', async () => { // Runs every Tuesday at midnight (cron format: minute hour dayOfMonth month dayOfWeek)
  console.log('⏰ Running scheduled purchase export job...');

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
    ExportPurchases(results).catch(e => {
      console.error('❌ Export/upload failed:', e.message);
    });
  });

});


