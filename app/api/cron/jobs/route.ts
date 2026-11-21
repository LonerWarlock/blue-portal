import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/cronAuth';
import { EmailJob, sendEmailViaResend } from '@/lib/jobOutbox';
import { deliverOrganizationInvitation, smtpTemporarilyRejected } from '@/lib/contactDelivery';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canonicalUrl } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  return processJobs(request);
}

export async function POST(request: Request) {
  return processJobs(request);
}

async function processJobs(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Job store is unavailable' }, { status: 503 });
  }

  const workerId = 'vercel-' + randomUUID();
  const { data, error } = await supabaseAdmin.rpc('claim_job_outbox', {
    worker_id_param: workerId,
    batch_size_param: 50,
    stale_after_seconds_param: 300
  });
  if (error) {
    console.error('[jobs] claim failed', { message: error.message });
    return NextResponse.json({ error: 'Failed to claim jobs' }, { status: 503 });
  }

  const jobs = Array.isArray(data) ? data : [];
  const results = await mapWithConcurrency(jobs, 10, async job => {
    const email = job.payload as EmailJob;
    const invitation = Boolean(email?.organizationInvitationId) || String(job.idempotency_key || '').startsWith('organization-invite:');
    let smtpAttempted = false;
    try {
      if (job.job_type !== 'transactional_email') {
        throw new Error('Unsupported job type: ' + job.job_type);
      }
      let providerId: string | null = null;
      if (invitation) {
        // Older queue entries contain the link instead of the invitation ID.
        const prefix = '<a href="' + canonicalUrl('/organizations/invite') + '#';
        const legacyToken = email.html.split(prefix)[1]?.match(/^([A-Za-z0-9_-]{43})"/)?.[1];
        // Entries with a Resend retry deadline may already have been accepted there.
        if (!email.organizationInvitationRetryBefore && (email.organizationInvitationId || legacyToken)) {
          const lookup = supabaseAdmin!.from('blue_organization_invitations').select('id')
            .eq('status', 'pending').gt('expires_at', new Date().toISOString());
          const { data: pending, error: lookupError } = await (email.organizationInvitationId
            ? lookup.eq('id', email.organizationInvitationId)
            : lookup.eq('token_hash', createHash('sha256').update(legacyToken!).digest('hex'))).maybeSingle();
          if (lookupError) throw new Error('Could not check invitation status');
          if (pending) {
            smtpAttempted = true;
            providerId = await deliverOrganizationInvitation(email);
          }
        }
      } else {
        providerId = await sendEmailViaResend(email);
      }
      await supabaseAdmin!
        .from('job_outbox')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          last_error: null,
          payload: invitation ? { organizationInvitationId: email.organizationInvitationId, provider_id: providerId } : { ...(job.payload || {}), provider_id: providerId },
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('locked_by', workerId);
      return true;
    } catch (jobError) {
      const attempts = Number(job.attempts || 1);
      const dead = attempts >= 5 || (smtpAttempted && !smtpTemporarilyRejected(jobError));
      const delayMinutes = Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
      await supabaseAdmin!
        .from('job_outbox')
        .update({
          status: dead ? 'dead' : 'retry',
          ...(dead && invitation ? { payload: { organizationInvitationId: email?.organizationInvitationId } } : {}),
          available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          locked_at: null,
          locked_by: null,
          last_error: invitation ? 'Organization invitation delivery failed' : jobError instanceof Error ? jobError.message.slice(0, 500) : 'Job failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('locked_by', workerId);
      return false;
    }
  });

  return NextResponse.json({
    ok: true,
    claimed: jobs.length,
    completed: results.filter(Boolean).length,
    failed: results.filter(result => !result).length
  });
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}
