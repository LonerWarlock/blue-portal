import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

export async function GET(req: Request) {
  return handleMarketingCampaign(req);
}

export async function POST(req: Request) {
  return handleMarketingCampaign(req);
}

async function handleMarketingCampaign(req: Request) {
  try {
    // 1. Authorization Check (for protection in production)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret');

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

    // 4. Fetch all subscription records
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('*');

    if (subsError) {
      console.error('Failed to retrieve subscriptions:', subsError);
      return NextResponse.json({ error: 'Failed to retrieve subscriptions' }, { status: 500 });
    }

    const subMap = new Map<string, any>();
    if (subscriptions) {
      subscriptions.forEach(sub => {
        subMap.set(sub.user_id, sub);
      });
    }

    const now = Date.now();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005';
    let processedCount = 0;
    const details: any[] = [];

    // 5. Filter and target inactive users
    for (const user of usersData.users) {
      if (!user.email) continue;
      
      const sub = subMap.get(user.id);
      
      // Target: Only users without an active subscription
      const isSubscribed = sub && sub.plan === 'blue' && sub.status === 'active';
      if (isSubscribed) {
        details.push({ email: user.email, status: 'skipped_active_subscriber' });
        continue;
      }

      // Check Cooldown (7 days)
      const lastSentStr = sub?.metadata?.last_marketing_sent_at;
      if (lastSentStr) {
        const lastSentMs = new Date(lastSentStr).getTime();
        const elapsedDays = (now - lastSentMs) / (1000 * 60 * 60 * 24);
        if (elapsedDays < 7) {
          details.push({ email: user.email, status: 'skipped_cooldown', days_since_last: elapsedDays.toFixed(1) });
          continue;
        }
      }

      // 6. Send Marketing Email
      const mailOptions = {
        from: `"Blue AI Assistant" <${smtpUser}>`,
        to: user.email,
        subject: 'Unlock Cursor-Grade Multi-Agent Coding for just ₹99/month',
        html: getMarketingEmailTemplate(siteUrl)
      };

      try {
        await transporter.sendMail(mailOptions);
        
        // 7. Update/Upsert metadata
        const updatedMetadata = {
          ...(sub?.metadata || {}),
          email: user.email,
          last_marketing_sent_at: new Date().toISOString()
        };

        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            plan: sub?.plan || 'lite',
            status: sub?.status || 'expired',
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        details.push({ email: user.email, status: 'notified' });
        processedCount++;
      } catch (mailErr: any) {
        console.error(`Failed to send campaign email to ${user.email}:`, mailErr);
        details.push({ email: user.email, status: 'failed_sending', error: mailErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      notified: processedCount,
      details
    });

  } catch (err: any) {
    console.error('Marketing campaign error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// ----------------------------------------------------
// DYNAMIC HIGH-CONVERSION HTML MARKETING EMAIL TEMPLATE
// ----------------------------------------------------

function getMarketingEmailTemplate(siteUrl: string) {
  return `
    <html>
      <body style="font-family: 'Outfit', 'Inter', -apple-system, sans-serif; background-color: #030712; padding: 40px 20px; margin: 0; color: #f3f4f6;">
        <div style="max-width: 550px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Gradient Top Shroud Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 40px 20px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 14px; padding: 12px; margin-bottom: 12px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">Unlock Blue AI Premium</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #cbd5e1; font-weight: 500;">Cursor-grade coding agent at a fraction of the cost</p>
          </div>

          <!-- Content Body -->
          <div style="padding: 40px 35px; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 16px; color: #94a3b8; font-weight: 500;">Hello Developer,</p>
            <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 24px;">
              Upgrade to the **Blue Plan** today and unlock advanced coding features that will speed up your workflow by 10x.
            </p>

            <!-- Premium Feature comparison -->
            <div style="background: #1e293b; border-radius: 12px; padding: 22px; border: 1px solid #334155; margin-bottom: 28px;">
              <h4 style="margin: 0 0 14px 0; color: #60a5fa; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">What You Get in Blue Premium</h4>
              <ul style="margin: 0; padding: 0; list-style: none; font-size: 13px; color: #cbd5e1; space-y: 8px;">
                <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">✔ Figma-to-Code:</strong> Instantly convert UI mockups into clean React, HTML/CSS code directly in VS Code.</li>
                <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">✔ Multi-Agent Teams:</strong> Deploy multiple autonomous agents working concurrently on your workspace.</li>
                <li style="margin-bottom: 8px;"><strong style="color: #ffffff;">✔ GitHub Integration:</strong> Resolve repository issues and review pull requests from your sidebar.</li>
                <li style="margin-bottom: 0;"><strong style="color: #ffffff;">✔ Web Search:</strong> Enhance your assistant's knowledge with live web search results and up-to-date documentation.</li>
              </ul>
            </div>

            <!-- Discount block highlighting IMR slider -->
            <div style="background: rgba(124, 58, 237, 0.1); border: 1px dashed rgba(124, 58, 237, 0.4); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
              <h4 style="margin: 0 0 6px 0; color: #a78bfa; font-size: 14px; font-weight: 700;">Use Your IMR Balance to Pay Just ₹99/mo</h4>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                You can apply up to **100 IMR** credits directly on the checkout range slider. <br/>
                Redeem 100 IMR for a ₹50 discount, bringing your price down from <del style="color: #ef4444;">₹149</del> to **only ₹99/month**!
              </p>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/subscribe" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); border: 1px solid rgba(255,255,255,0.1);">
                Upgrade to Blue Premium
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #020617; padding: 25px; text-align: center; border-top: 1px solid #1e293b; color: #475569; font-size: 11px;">
            &copy; 2026 Blue AI. All rights reserved. <br/>
            This is a one-time promotional update. If you wish to stop receiving these tips, you can unsubscribe from settings.
          </div>

        </div>
      </body>
    </html>
  `;
}
