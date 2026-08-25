import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';
import { getCampaignEmail, CampaignType } from '@/lib/marketingTemplates';

export async function GET(req: Request) {
  return handleMarketingCampaign(req);
}

export async function POST(req: Request) {
  return handleMarketingCampaign(req);
}

async function handleMarketingCampaign(req: Request) {
  try {
    // 1. Authorization Check
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret');
    const overrideCampaign = searchParams.get('campaign') as CampaignType | null;
    const customSubject = searchParams.get('subject') || undefined;
    const customContent = searchParams.get('content') || undefined;
    const batchLimit = parseInt(searchParams.get('limit') || '50', 10);

    if (cronSecret) {
      const isAuthorized =
        (authHeader && authHeader === `Bearer ${cronSecret}`) ||
        (secretParam && secretParam === cronSecret);
      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    // 2. Fetch SMTP configurations
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.error('SMTP credentials missing. Skipping email sending.');
      return NextResponse.json({ error: 'SMTP configurations missing' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    // 3. Fetch all auth users
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError || !usersData?.users) {
      console.error('Failed to retrieve auth users:', usersError);
      return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
    }

    // 4. Fetch relational data in parallel
    const [subsRes, profilesRes, keysRes, walletsRes, vibeRes] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('*'),
      supabaseAdmin.from('blue_profiles').select('*'),
      supabaseAdmin.from('user_keys').select('user_id'),
      supabaseAdmin.from('wallets').select('*'),
      supabaseAdmin.from('vibe_coding_registrations').select('email')
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
    for (const user of usersData.users) {
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
      const lastCampaign = metadata.last_campaign_type;
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

      const mailOptions = {
        from: `"Om Karande at Blue AI" <${smtpUser}>`,
        to: user.email,
        subject,
        html
      };

      try {
        await transporter.sendMail(mailOptions);

        // Update metadata tracking
        const updatedMetadata = {
          ...metadata,
          email: user.email,
          last_marketing_sent_at: new Date().toISOString(),
          last_campaign_type: matchedCampaign,
          campaigns_sent: {
            ...campaignsSent,
            [matchedCampaign]: new Date().toISOString()
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

        details.push({ email: user.email, campaign: matchedCampaign, status: 'notified' });
        processedCount++;
      } catch (mailErr: any) {
        console.error(`Failed to send ${matchedCampaign} email to ${user.email}:`, mailErr);
        details.push({
          email: user.email,
          campaign: matchedCampaign,
          status: 'failed_sending',
          error: mailErr.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      details
    });
  } catch (err: any) {
    console.error('Marketing campaign engine error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
