const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_ADMIN, // Admin Gmail address
    // pass: process.env.EMAIL_PASSWORD  // Admin Gmail app password
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  }
});

// Create a transporter using Resend's SMTP settings
// const transporter = nodemailer.createTransport({
//   host: 'smtp.resend.com',
//   port: 465,
//   secure: true, // true for 465
//   auth: {
//     user: 'resend', // Always literally 'resend'
//     pass: process.env.RESEND_API_KEY // My Resend API key
//   }
// });

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

// Notification email for user about push notifications registration
async function sendPushNotificationRegistrationEmail(email) {
  const mailOptions = {
    from: process.env.EMAIL_ADMIN,
    to: email,
    subject: 'Push Notification Registration Successful',
    text: `Hello,\n\nYou have successfully registered for push notifications by logging in.\n\nYou will now receive push notifications."\n\nBest regards,\nYour Backend System`
  };
  return transporter.sendMail(mailOptions);
}

// Notification email for admin about push notifications scheduled job
async function sendNotificationResultToAdmin(summary) {
  const mailOptions = {
    from: process.env.EMAIL_ADMIN,
    to: process.env.EMAIL_ADMIN,
    subject: `Push Notification Results for Summary`,
    text: summary.map(item =>
      `Email: ${item.email}\nSuccess: ${item.success}\nMessage: ${item.message || 'Delivered notification successfully'}\n`
    ).join('\n------------------------\n')
  };
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendGreetingEmail,
  sendExportNotifyEmail,
  sendPushNotificationRegistrationEmail,
  sendNotificationResultToAdmin,
};

