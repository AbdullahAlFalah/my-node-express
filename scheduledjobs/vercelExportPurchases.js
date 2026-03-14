const { google } = require('googleapis');
const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const mysqlpool = require('../DifferentDatabases/MySQL');
const { sendExportNotifyEmail } = require('../utils/sendEmail');

// We pass the OAuth client and credentials in dynamically
async function runVercelExport() {
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
      if (err) return reject(err);
      if (!results.length) return resolve('No data to export');

      try {
        // --- Your Legacy Logic Starts Here (ExcelJS + Upload) ---
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Purchases');
        
        // Add headers based on your DB columns
        worksheet.columns = Object.keys(results[0]).map(key => ({ header: key, key: key }));
        worksheet.addRows(results);

        const buffer = await workbook.xlsx.writeBuffer();
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        const response = await drive.files.create({
          requestBody: {
            name: `Purchases_Export_${new Date().toISOString().split('T')[0]}.xlsx`,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
          },
          media: {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: bufferStream,
          },
        });

        await sendExportNotifyEmail(results.length);
        resolve(response.data.id);
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = { runVercelExport };
