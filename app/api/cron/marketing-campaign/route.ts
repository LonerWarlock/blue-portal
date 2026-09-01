import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCampaignEmail, CampaignType } from '@/lib/marketingTemplates';
import { authorizeCron } from '@/lib/cronAuth';
import { emailJobIdempotencyKey, enqueueEmailJob } from '@/lib/jobOutbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  return handleMarketingCampaign(req);
}

export async function POST(req: Request) {
  return handleMarketingCampaign(req);
}

async function handleMarketingCampaign(req: Request) {
  try {
    // 1. Authorization Check
    const { searchParams } = new URL(req.url);
    const overrideCampaign = searchParams.get('campaign') as CampaignType | null;
    const customSubject = searchParams.get('subject') || undefined;
    const customContent = searchParams.get('content') || undefined;
    const batchLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const userPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    if (!authorizeCron(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    // 2. Process one bounded auth page. The next page is a separate cron run.
    const perPage = Math.min(200, Math.max(50, batchLimit * 4));
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: userPage,
      perPage
    });
    if (usersError || !usersData?.users) {
      console.error('Failed to retrieve auth users:', usersError);
      return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
    }
    const allUsers = usersData.users;
    if (allUsers.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No users found on this page.' });
    }
    const userIds = allUsers.map(user => user.id);
    const userEmails = allUsers
      .map(user => String(user.email || '').trim().toLowerCase())
      .filter(Boolean);

    // 4. Fetch relational data in parallel
    const [subsRes, profilesRes, keysRes, walletsRes, vibeRes] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('*').in('user_id', userIds),
      supabaseAdmin.from('blue_profiles').select('*').in('user_id', userIds),
      supabaseAdmin.from('user_keys').select('user_id').in('user_id', userIds),
      supabaseAdmin.from('wallets').select('*').in('user_id', userIds),
      supabaseAdmin.from('vibe_coding_registrations').select('email').in('email', userEmails)
    ]);

    const subMap = new Map<string, any>();
    if (subsRes.data) {
      subsRes.data.forEach((sub) => subMap.set(sub.user_id, sub));
    }

    const profileMap = new Map<string, any>();
    if (profilesRes.data) {
      profilesRes.data.forEach((p) => profileMap.set(p.user_id, p));
    }

    const keyUserIds = new Set<string>();
    if (keysRes.data) {
      keysRes.data.forEach((k) => keyUserIds.add(k.user_id));
    }

    const walletMap = new Map<string, any>();
    if (walletsRes.data) {
      walletsRes.data.forEach((w) => walletMap.set(w.user_id, w));
    }

    const vibeEmails = new Set<string>();
    if (vibeRes.data) {
      vibeRes.data.forEach((v) => {
        if (v.email) vibeEmails.add(v.email.toLowerCase());
      });
    }

    const now = Date.now();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005';
    let processedCount = 0;
    const details: any[] = [];

    // 5. Evaluate and classify each user
    for (const user of allUsers) {
      if (!user.email) continue;
      if (processedCount >= batchLimit) {
        details.push({ email: user.email, status: 'batch_limit_reached' });
        continue;
      }

      const email = user.email.toLowerCase();
      const sub = subMap.get(user.id);
      const profile = profileMap.get(user.id);
      const wallet = walletMap.get(user.id);
      const hasKey = keyUserIds.has(user.id);
      const hasBoughtVibe = vibeEmails.has(email);

      // Data metrics
      const totalCreditsUsed = Number(profile?.total_credits_used || 0);
      const requestsMade = totalCreditsUsed; // 0 requests made = extension not installed
      const blueCredits = Number(wallet?.blue_credits || 0);
      const accountType = wallet?.account_type || 'standard';

      // Skip active paid subscribers (plan = 'blue', status = 'active')
      const isSubscribed = sub && sub.plan === 'blue' && sub.status === 'active';
      if (isSubscribed && !overrideCampaign) {
        details.push({ email: user.email, status: 'skipped_active_subscriber' });
        continue;
      }

      // Check Cooldowns
      const metadata = sub?.metadata || {};
      const lastSentStr = metadata.last_marketing_sent_at;
      const campaignsSent = metadata.campaigns_sent || {};

      if (lastSentStr && !overrideCampaign) {
        const lastSentMs = new Date(lastSentStr).getTime();
        const elapsedDays = (now - lastSentMs) / (1000 * 60 * 60 * 24);

        // Global cooldown (3 days)
        if (elapsedDays < 3) {
          details.push({
            email: user.email,
            status: 'skipped_global_cooldown',
            days_since_last: elapsedDays.toFixed(1)
          });
          continue;
        }
      }

      // User age calculation
      const createdAtMs = new Date(user.created_at).getTime();
      const ageDays = (now - createdAtMs) / (1000 * 60 * 60 * 24);
      const lastSignInMs = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : createdAtMs;
      const inactiveDays = (now - lastSignInMs) / (1000 * 60 * 60 * 24);

      // Classify into exact campaign priority (first match wins)
      let matchedCampaign: CampaignType | null = overrideCampaign;

      if (!matchedCampaign) {
        if (ageDays <= 1 && !campaignsSent.welcome_day1) {
          matchedCampaign = 'welcome_day1';
        } else if (ageDays >= 3 && ageDays < 4 && !campaignsSent.welcome_day3) {
          matchedCampaign = 'welcome_day3';
        } else if (ageDays >= 7 && ageDays < 8 && !campaignsSent.welcome_day7) {
          matchedCampaign = 'welcome_day7';
        } else if (!hasKey && requestsMade === 0) {
          // Account exists in DB, 0 requests made, no key generated yet -> Extension not installed
          matchedCampaign = 'logged_in_no_install';
        } else if (hasKey && requestsMade === 0 && ageDays >= 7) {
          // Account exists in DB & has key, but 0 requests made -> Extension not installed
          matchedCampaign = 'signed_up_no_use';
        } else if (requestsMade > 0 && inactiveDays > 14 && inactiveDays <= 30) {
          matchedCampaign = 'used_once_inactive';
        } else if (requestsMade > 5 && inactiveDays > 30) {
          matchedCampaign = 'active_churned';
        } else if (sub?.plan === 'lite' && blueCredits < 0.5 && requestsMade > 0) {
          matchedCampaign = 'free_hitting_limits';
        } else if (sub?.plan === 'lite' && requestsMade > 20) {
          matchedCampaign = 'free_very_active';
        } else if (sub?.plan === 'blue' && sub?.status === 'expired') {
          matchedCampaign = 'expired_subscription';
        } else if (accountType === 'pro_payg' && blueCredits < 1.0) {
          matchedCampaign = 'pro_credits_low';
        } else if (!hasBoughtVibe) {
          matchedCampaign = 'course_promotion';
        }
      }

      if (!matchedCampaign) {
        details.push({ email: user.email, status: 'no_matching_campaign' });
        continue;
      }

      // Check per-campaign cooldown (14 days for same campaign type)
      const lastSentForCampaign = campaignsSent[matchedCampaign];
      if (lastSentForCampaign && !overrideCampaign) {
        const lastCampaignMs = new Date(lastSentForCampaign).getTime();
        const elapsedCampaignDays = (now - lastCampaignMs) / (1000 * 60 * 60 * 24);
        if (elapsedCampaignDays < 14) {
          details.push({
            email: user.email,
            campaign: matchedCampaign,
            status: 'skipped_campaign_cooldown',
            days_since_campaign: elapsedCampaignDays.toFixed(1)
          });
          continue;
        }
      }

      // Generate campaign email content
      const { subject, html } = getCampaignEmail(matchedCampaign, {
        siteUrl,
        customSubject,
        customContent,
        creditsRemaining: blueCredits
      });

      try {
        const queuedAt = new Date();
        await enqueueEmailJob(
          { to: user.email, subject, html },
          emailJobIdempotencyKey('marketing', [
            user.id,
            matchedCampaign,
            queuedAt.toISOString().slice(0, 10),
          ])
        );

        // Mark the durable enqueue, not provider delivery. The outbox owns
        // retries and dead-letter handling from this point onward.
        const updatedMetadata = {
          ...metadata,
          email: user.email,
          last_marketing_sent_at: queuedAt.toISOString(),
          last_campaign_type: matchedCampaign,
          campaigns_sent: {
            ...campaignsSent,
            [matchedCampaign]: queuedAt.toISOString()
          }
        };

        await supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              user_id: user.id,
              plan: sub?.plan || 'lite',
              status: sub?.status || 'expired',
              metadata: updatedMetadata,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          );

        details.push({ campaign: matchedCampaign, status: 'queued' });
        processedCount++;
      } catch (mailErr: any) {
        console.error('[marketing] Failed to queue campaign email', {
          campaign: matchedCampaign,
          message: String(mailErr?.message || mailErr).slice(0, 300),
        });
        details.push({
          campaign: matchedCampaign,
          status: 'failed_to_queue'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      page: userPage,
      has_more: allUsers.length === perPage,
      details: details.map(detail => ({
        campaign: detail.campaign,
        status: detail.status,
        days_since_campaign: detail.days_since_campaign,
        days_since_last: detail.days_since_last
      }))
    });
  } catch (err: any) {
    console.error('Marketing campaign engine error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
