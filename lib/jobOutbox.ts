import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export function emailJobIdempotencyKey(scope: string, parts: string[]): string {
  const material = [scope, ...parts].map(value => String(value || '').trim().toLowerCase()).join('|');
  return scope + ':' + createHash('sha256').update(material).digest('hex');
}

export async function enqueueEmailJob(
  email: EmailJob,
  idempotencyKey: string,
  availableAt = new Date()
): Promise<void> {
  if (!supabaseAdmin) throw new Error('Supabase admin is not configured');
  const { error } = await supabaseAdmin
    .from('job_outbox')
    .upsert({
      job_type: 'transactional_email',
      idempotency_key: idempotencyKey,
      payload: email,
      status: 'queued',
      available_at: availableAt.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (error) throw new Error('Failed to enqueue email: ' + error.message);
}

export async function sendEmailViaResend(email: EmailJob): Promise<string | null> {
  const apiKey = String(process.env.RESEND_API_KEY || '');
  const from = String(process.env.RESEND_FROM_EMAIL || '');
  if (!apiKey || !from) throw new Error('Resend is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      ...(email.replyTo ? { reply_to: email.replyTo } : {})
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Resend failed (' + response.status + ')');
  return payload.id || null;
}
