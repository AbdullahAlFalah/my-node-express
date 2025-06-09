const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GREETING_EMAIL_USER, // your Gmail address
    pass: process.env.GREETING_EMAIL_PASSWORD  // your Gmail app password
  }
});

async function sendGreetingEmail(to, username) {
  const mailOptions = {
    from: process.env.GREETING_EMAIL_USER,
    to,
    subject: 'Welcome to Our App!',
    text: `Hello ${username},\n\nThank you for signing up! We're glad to have you on board.\n\nBest regards,\nAbdullah Al-Falah`
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendGreetingEmail;

