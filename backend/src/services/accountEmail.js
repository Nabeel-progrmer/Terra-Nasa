import nodemailer from 'nodemailer';
import env from '../config/env.js';

export function isEmailDeliveryConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);
}

export async function sendAccountEmail({ to, subject, text }) {
  if (!isEmailDeliveryConfigured()) throw new Error('SMTP is not configured.');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: !env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
}
