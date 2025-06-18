const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ADMIN, // Admin Gmail address
    pass: process.env.EMAIL_PASSWORD  // Admin Gmail app password
  }
});

// Greeting email for new users
async function sendGreetingEmail(to, username) {
  const mailOptions = {
    from: process.env.EMAIL_ADMIN,
    to,
    subject: 'Welcome to Our App!',
    text: `Hello ${username},\n\nThank you for signing up! We're glad to have you on board.\n\nBest regards,\nAbdullah Al-Falah`
  };

  return transporter.sendMail(mailOptions);
}

// Notification email for monthly export
async function sendExportNotifyEmail(fileName, fileId, folderId = process.env.GOOGLE_DRIVE_FOLDER_ID) {
  const driveFolderLink = `https://drive.google.com/drive/u/3/folders/${folderId}`; // Google Drive folder link

  const mailOptions = {
    from: process.env.EMAIL_ADMIN,
    to: process.env.EMAIL_ADMIN, 
    subject: 'Monthly Purchases Exported',
    text: `Hello,\n\nYour monthly purchases have been exported and uploaded to Google Drive.\n\nFile Name: ${fileName}\nGoogle Drive File ID: ${fileId}\nYou can access the folder containing all exported files here: ${driveFolderLink}\n\nBest regards,\nYour Backend System`, // For Older Clients: Fallback to the text version
    html: `<p>Hello,</p>
           <p>Your monthly purchases have been exported and uploaded to Google Drive.</p>
           <p><strong>File Name:</strong> ${fileName}</p>
           <p><strong>Google Drive File ID:</strong> ${fileId}</p>
           <p>You can access the folder containing all exported files <a href="${driveFolderLink}" target="_blank">here</a>.</p>
           <p>Best regards,<br>Your Backend System</p>` // For New Clients: Use HTML version for better formatting
  };
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendGreetingEmail,
  sendExportNotifyEmail,
};

