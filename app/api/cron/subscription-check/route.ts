import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeCron } from '@/lib/cronAuth';
import { emailJobIdempotencyKey, enqueueEmailJob } from '@/lib/jobOutbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  return handleSubscriptionCheck(req);
}

export async function POST(req: Request) {
  return handleSubscriptionCheck(req);
}

async function handleSubscriptionCheck(req: Request) {
  try {
    // 1. Authorization Check (for protection in production)
    if (!authorizeCron(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    // 2. Query only actionable rows. Already-queued warnings are excluded so
    // the first 100 subscriptions cannot permanently starve later accounts.
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const warningDeadline = new Date(nowMs + 3 * 86_400_000).toISOString();
    const [expiredResult, warningResult] = await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .lte('current_period_end', nowIso)
        .order('current_period_end', { ascending: true })
        .limit(100),
      supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .gt('current_period_end', nowIso)
        .lte('current_period_end', warningDeadline)
        .or('metadata->>warning_email_sent.is.null,metadata->>warning_email_sent.eq.false')
        .order('current_period_end', { ascending: true })
        .limit(100),
    ]);
    const fetchError = expiredResult.error || warningResult.error;
    const subscriptions = [...(expiredResult.data || []), ...(warningResult.data || [])]
      .sort((left, right) => Date.parse(left.current_period_end) - Date.parse(right.current_period_end))
      .slice(0, 100);

    if (fetchError) {
      console.error('Failed to query subscriptions:', fetchError);
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No active subscriptions found.' });
    }

    let processedCount = 0;
    const details: any[] = [];

    // 4. Process each subscription
    for (const sub of subscriptions) {
      if (!sub.current_period_end) continue;

      const periodEndMs = new Date(sub.current_period_end).getTime();
      const msDiff = periodEndMs - nowMs;
      const daysDiff = msDiff / (1000 * 60 * 60 * 24);

      let email = sub.metadata?.email;
      
      // Fallback 1: Extract from stripe_customer_id if it's stored as payu_email
      if (!email && sub.stripe_customer_id?.startsWith('payu_')) {
        const emailPart = sub.stripe_customer_id.substring(5); // strip 'payu_'
        if (emailPart.includes('@')) {
          email = emailPart;
        }
      }

      // Fallback 2: Direct lookup from Auth.users using getUserById
      if (!email) {
        try {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
          if (!userError && userData?.user?.email) {
            email = userData.user.email;
          }
        } catch (err) {
          console.error(`Failed to resolve email for user_id ${sub.user_id}:`, err);
        }
      }

      if (!email) {
        console.warn(`Skipping user_id ${sub.user_id} - could not resolve email address.`);
        continue;
      }

      // AESTHETIC CONSTANTS
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005';
      const formattedDate = new Date(sub.current_period_end).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });

      // CASE A: Subscription has officially expired
      if (msDiff <= 0) {
        const isExpiryEmailSent = !!sub.metadata?.expiry_email_sent;
        let expiryQueued = isExpiryEmailSent;

        if (!isExpiryEmailSent) {
          try {
            await enqueueEmailJob({
              to: email,
              subject: 'Your Blue AI Subscription Has Expired',
              html: getExpiredEmailTemplate(formattedDate, siteUrl),
            }, emailJobIdempotencyKey('subscription-expired', [
              sub.id,
              String(sub.current_period_end),
            ]));
            expiryQueued = true;
          } catch (mailErr) {
            console.error('[subscription] Failed to queue expiry email', {
              subscription_id: sub.id,
              message: mailErr instanceof Error ? mailErr.message.slice(0, 300) : 'Unknown outbox error',
            });
          }
        }

        // Expiration is authoritative even if the email provider is down.
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'expired',
            metadata: {
              ...(sub.metadata || {}),
              warning_email_sent: true,
              expiry_email_sent: expiryQueued,
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);

        details.push({ action: expiryQueued ? 'expired_email_queued' : 'expired_db_only' });
        processedCount++;
      } 
      // CASE B: Subscription is expiring in <= 3 days (Warning)
      else if (daysDiff <= 3) {
        const isWarningEmailSent = !!sub.metadata?.warning_email_sent;

        if (!isWarningEmailSent) {
          const daysLeftStr = daysDiff <= 1 
            ? 'less than 24 hours' 
            : `${Math.ceil(daysDiff)} days`;

          try {
            await enqueueEmailJob({
              to: email,
              subject: `Action Required: Your Blue AI Subscription Ends in ${daysLeftStr}`,
              html: getWarningEmailTemplate(daysLeftStr, formattedDate, siteUrl),
            }, emailJobIdempotencyKey('subscription-warning', [
              sub.id,
              String(sub.current_period_end),
            ]));

            await supabaseAdmin
              .from('subscriptions')
              .update({
                metadata: {
                  ...(sub.metadata || {}),
                  warning_email_sent: true,
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', sub.id);

            details.push({ action: 'warning_email_queued' });
          } catch (mailErr) {
            console.error('[subscription] Failed to queue warning email', {
              subscription_id: sub.id,
              message: mailErr instanceof Error ? mailErr.message.slice(0, 300) : 'Unknown outbox error',
            });
          }
        } else {
          details.push({ action: 'warning_already_queued' });
        }
        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      details: details.map(detail => ({ action: detail.action }))
    });

  } catch (err: any) {
    console.error('Subscription Cron Error:', err);
    return NextResponse.json({ error: err.message || 'Cron error' }, { status: 500 });
  }
}

// ----------------------------------------------------
// DYNAMIC DUSTY-DARK PREMIUM EMAIL TEMPLATES
// ----------------------------------------------------

function getWarningEmailTemplate(daysLeft: string, formattedDate: string, siteUrl: string) {
  return `
    <html>
      <body style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #030712; padding: 40px 20px; margin: 0; color: #f3f4f6;">
        <div style="max-width: 550px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Gradient Top Shroud Header -->
          <div style="background: linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%); padding: 35px 20px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; margin-bottom: 12px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">Subscription Ends Soon</h1>
          </div>

          <!-- Content Body -->
          <div style="padding: 40px 35px; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 16px; color: #94a3b8; font-weight: 500;">Hello,</p>
            <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 24px;">
              Your **Blue AI Premium** subscription will end in <strong style="color: #60a5fa;">${daysLeft}</strong> on <strong style="color: #ffffff;">${formattedDate}</strong>.
            </p>

            <!-- Premium Feature list summary -->
            <div style="background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 28px;">
              <h4 style="margin: 0 0 12px 0; color: #38bdf8; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Premium Features at Risk</h4>
              <table style="width: 100%; font-size: 13px; color: #94a3b8;">
                <tr>
                  <td style="padding: 4px 0;"><span style="color: #34d399;">✔</span> Multi-Agent Team Collaboration</td>
                  <td style="padding: 4px 0;"><span style="color: #34d399;">✔</span> Figma-to-Code Converter</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><span style="color: #34d399;">✔</span> Premium Models (GPT-5, Claude-3.5)</td>
                  <td style="padding: 4px 0;"><span style="color: #34d399;">✔</span> Full Extension Integrations</td>
                </tr>
              </table>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/subscribe" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); border: 1px solid rgba(255,255,255,0.1);">
                Renew Subscription Now
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 30px;">
              You can apply your accrued IMR credits at the checkout slider to claim a discount of up to ₹50 on this renewal.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #020617; padding: 25px; text-align: center; border-top: 1px solid #1e293b; color: #475569; font-size: 11px;">
            &copy; 2026 Blue AI. All rights reserved. <br/>
            This email was sent automatically because you have an active premium service subscription.
          </div>

        </div>
      </body>
    </html>
  `;
}

function getExpiredEmailTemplate(formattedDate: string, siteUrl: string) {
  return `
    <html>
      <body style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #030712; padding: 40px 20px; margin: 0; color: #f3f4f6;">
        <div style="max-width: 550px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Gradient Top Shroud Header -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 35px 20px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; margin-bottom: 12px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">Subscription Expired</h1>
          </div>

          <!-- Content Body -->
          <div style="padding: 40px 35px; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 16px; color: #94a3b8; font-weight: 500;">Hello,</p>
            <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 24px;">
              Your **Blue AI Premium** plan expired on <strong style="color: #ef4444;">${formattedDate}</strong>.
            </p>

            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px;">
              Your account has been downgraded to the <strong style="color: #10b981;">Blue Lite</strong> (free forever) plan. You no longer have access to premium models and advanced multi-agent workspaces.
            </p>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/subscribe" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); border: 1px solid rgba(255,255,255,0.1);">
                Resubscribe to Blue Premium
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 30px;">
              Apply any available IMR credit balance on checkout to claim discounts on your payment.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #020617; padding: 25px; text-align: center; border-top: 1px solid #1e293b; color: #475569; font-size: 11px;">
            &copy; 2026 Blue AI. All rights reserved. <br/>
            This email was sent automatically because you held a premium service subscription.
          </div>

        </div>
      </body>
    </html>
  `;
}
