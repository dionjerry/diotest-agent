import nodemailer from 'nodemailer';

import { env } from '@/lib/env';

const PLACEHOLDER_VALUES = new Set([
  'smtp.example.com',
  'mailer@example.com',
  'replace-with-your-smtp-password',
  'DioTest <no-reply@example.com>',
  'no-reply@example.com',
]);

function hasSmtpConfig() {
  const values = [env.smtp.host, env.smtp.user, env.smtp.pass, env.smtp.from];
  return Boolean(
    env.smtp.host &&
      env.smtp.port &&
      env.smtp.user &&
      env.smtp.pass &&
      env.smtp.from &&
      values.every((value) => value && !PLACEHOLDER_VALUES.has(value)),
  );
}

export function isSmtpConfigured() {
  return hasSmtpConfig();
}

export async function sendPasswordResetEmail(payload: { to: string; resetUrl: string }) {
  if (!hasSmtpConfig()) {
    throw new Error('Password reset email is unavailable because SMTP is not configured.');
  }

  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  await transport.sendMail({
    from: env.smtp.from,
    to: payload.to,
    subject: 'Reset your DioTest password',
    text: `Reset your DioTest password using this secure link: ${payload.resetUrl}\n\nThis link expires in 30 minutes.`,
    html: `
      <p>Reset your DioTest password using the secure link below.</p>
      <p><a href="${payload.resetUrl}">${payload.resetUrl}</a></p>
      <p>This link expires in 30 minutes.</p>
    `,
  });
}
