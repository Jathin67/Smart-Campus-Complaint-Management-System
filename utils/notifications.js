const nodemailer = require('nodemailer');

// Helper function to send email
async function sendEmail(to, subject, message) {
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { 
          user: process.env.SMTP_USER, 
          pass: process.env.SMTP_PASS 
        }
      });

      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'no-reply@chanakyauniversity.edu.in',
        to: to,
        subject: subject,
        html: message
      });
      console.log(`Email sent to ${to}`);
    } else {
      console.log(`Email would be sent to ${to}: ${subject}`);
    }
  } catch (error) {
    console.error('Error sending email:', error.message);
  }
}

// Helper function to send SMS (placeholder - integrate with SMS service)
async function sendSMS(phone, message) {
  try {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log(`SMS would be sent to ${phone}: ${message}`);
  } catch (error) {
    console.error('Error sending SMS:', error.message);
  }
}

// Send notification to user (email and phone)
async function notifyUser(user, subject, message) {
  if (user.email) {
    await sendEmail(user.email, subject, message);
  }
  if (user.phone) {
    await sendSMS(user.phone, message);
  }
}

module.exports = { sendEmail, sendSMS, notifyUser };

