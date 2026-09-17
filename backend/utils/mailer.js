const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const {
  getEmailFrom,
  getEmailProvider,
} = require('./emailConfig');

const buildSmtpTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const portNumber = Number(SMTP_PORT) || 587;
  const secure = portNumber === 465;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: portNumber,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const logDevEmail = (label, payload) => {
  console.log(`\n📧 === ${label} (Dev Mode) ===`);
  for (const [key, value] of Object.entries(payload)) {
    console.log(`${key}: ${value}`);
  }
  console.log('=======================================\n');
};

const sendEmail = async ({ to, subject, text, html }) => {
  const provider = getEmailProvider();
  const from = getEmailFrom();

  if (provider === 'console') {
    logDevEmail('EMAIL', { To: to, Subject: subject, Body: text });
    return;
  }

  if (!from) {
    throw new Error('EMAIL_FROM (or SMTP_FROM) is required when sending email.');
  }

  if (provider === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    });

    if (error) {
      throw new Error(error.message || 'Resend failed to send email.');
    }
    return;
  }

  if (provider === 'smtp') {
    const transporter = buildSmtpTransport();
    await transporter.sendMail({ from, to, subject, text, html });
    return;
  }

  throw new Error(
    'Email is not configured. Set RESEND_API_KEY + EMAIL_FROM, or configure SMTP settings.'
  );
};

const sendVerificationEmail = async (to, code) => {
  const subject = 'Your Fantasy League verification code';
  const text = `Your verification code is ${code}. It expires in 10 minutes.`;
  const html = `<p>Hello,</p><p>Your fantasy verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`;

  await sendEmail({ to, subject, text, html });
};

const sendPasswordResetEmail = async (to, resetUrl, { audience = 'Fantasy' } = {}) => {
  const ttl = process.env.PASSWORD_RESET_TTL_MINUTES || 60;
  const subject = `${audience} password reset`;
  const text = `You requested a password reset. Open this link to choose a new password (expires in ${ttl} minutes):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<p>You requested a password reset for your ${audience} account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in ${ttl} minutes. If you did not request this, you can ignore this email.</p>`;

  await sendEmail({ to, subject, text, html });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendEmail };
