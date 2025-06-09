const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your Gmail address
    pass: process.env.EMAIL_PASSWORD  // your Gmail app password
  }
});

// Greeting email for new users
async function sendGreetingEmail(to, username) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Welcome to Our App!',
    text: `Hello ${username},\n\nThank you for signing up! We're glad to have you on board.\n\nBest regards,\nAbdullah Al-Falah`
  };

  return transporter.sendMail(mailOptions);
}

// Notification email for monthly export
async function sendExportNotifyEmail(to, fileName, fileId) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Monthly Purchases Exported',
    text: `Hello,\n\nYour monthly purchases have been exported and uploaded to Google Drive.\n\nFile Name: ${fileName}\nGoogle Drive File ID: ${fileId}\n\nBest regards,\nYour Backend System`
  };
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendGreetingEmail,
  sendExportNotifyEmail,
};

