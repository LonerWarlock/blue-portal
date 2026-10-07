import nodemailer from 'nodemailer';
import type { EmailJob } from '@/lib/jobOutbox';

/** Send contact messages immediately so the form only succeeds after a provider accepts them. */
export async function deliverContactEmail(email: EmailJob): Promise<void> {
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '');
  if (!smtpUser || !smtpPass) {
    throw new Error('Contact email transport is not configured');
  }

  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP configuration is invalid');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
  const result = await transporter.sendMail({
    from: smtpUser,
    to: email.to,
    replyTo: email.replyTo,
    subject: email.subject,
    html: email.html
  });
  if (!result.accepted?.some(address => {
    const acceptedAddress = typeof address === 'string' ? address : address.address;
    return acceptedAddress.toLowerCase() === email.to.toLowerCase();
  })) {
    throw new Error('SMTP provider did not accept the contact recipient');
  }
}
