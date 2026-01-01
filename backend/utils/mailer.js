const nodemailer = require('nodemailer');

const isDevelopment = process.env.NODE_ENV !== 'production';

const buildTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  
  // In development without SMTP config, use console logging
  if (isDevelopment && (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS)) {
    console.warn('⚠️  SMTP not configured - emails will be logged to console');
    return null;
  }
  
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP settings are not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS).');
  }

  const portNumber = Number(SMTP_PORT) || 587;
  const secure = portNumber === 465; // true for 465, false for other ports

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: portNumber,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

const sendVerificationEmail = async (to, code) => {
  const transporter = buildTransport();
  
  // Development fallback: log to console instead of sending email
  if (!transporter) {
    console.log('\n📧 === VERIFICATION EMAIL (Dev Mode) ===');
    console.log(`To: ${to}`);
    console.log(`Code: ${code}`);
    console.log(`Expires: 10 minutes`);
    console.log('=======================================\n');
    return; // Don't actually send email
  }
  
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Your Fantasy League verification code';
  const text = `Your verification code is ${code}. It expires in 10 minutes.`;
  const html = `<p>Hello,</p><p>Your fantasy verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`;

  await transporter.sendMail({ from, to, subject, text, html });
};

module.exports = { sendVerificationEmail };
