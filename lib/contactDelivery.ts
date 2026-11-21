import nodemailer from 'nodemailer';
import type { EmailJob } from '@/lib/jobOutbox';

/** Send contact messages immediately so the form only succeeds after a provider accepts them. */
export async function deliverContactEmail(email: EmailJob): Promise<void> {
  await deliverSmtpEmail(email);
}

export function deliverOrganizationInvitation(email: EmailJob): Promise<string> {
  return deliverSmtpEmail(email, "team.imergene@gmail.com");
}

export function smtpTemporarilyRejected(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("responseCode" in error)) return false;
  const code = error.responseCode;
  return typeof code === "number" && code >= 400 && code < 500;
}

async function deliverSmtpEmail(email: EmailJob, requiredSender?: string): Promise<string> {
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '');
  if (!smtpUser || !smtpPass) {
    throw new Error('Contact email transport is not configured');
  }

  if (requiredSender && smtpUser.toLowerCase() !== requiredSender) {
    throw new Error("Organization invitation sender is not configured");
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
    html: email.html,
    text: email.text
  });
  if (!result.accepted?.some(address => {
    const acceptedAddress = typeof address === 'string' ? address : address.address;
    return acceptedAddress.toLowerCase() === email.to.toLowerCase();
  })) {
    throw new Error('SMTP provider did not accept the recipient');
  }
  return result.messageId;
}
