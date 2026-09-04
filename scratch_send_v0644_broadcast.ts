import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const SITE_URL = 'https://blue-by-imergene.vercel.app';

function wrapEmail(body: string, siteUrl: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 15px; line-height: 1.7;">
${body}

  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.6;">
    --<br/>
    <strong style="color: #1a1a1a;">Om Karande</strong><br/>
    <span style="color: #4b5563;">Founder @ <a href="${siteUrl}" style="color: #2563eb; text-decoration: none;">Blue AI</a></span><br/>
    <span style="color: #9ca3af;">Pune, India</span>
  </p>
</div>
  `.trim();
}

const emailSubject = "New in Blue (v0.6.44): 5-minute timeouts, error recovery & provider upgrades";
const emailBody = wrapEmail(`
<p>Hey there,</p>

<p>Om from Blue here — sending a quick update on our latest release.</p>

<p>We just released <strong>v0.6.44</strong> of Blue for VS Code with major improvements to provider stability, error recovery, and streaming execution:</p>

<ul style="padding-left: 20px; margin: 15px 0; line-height: 1.8;">
  <li style="margin-bottom: 8px;"><strong>Longer 5-minute provider timeouts:</strong> Fewer failures when running complex prompts on slow models.</li>
  <li style="margin-bottom: 8px;"><strong>Better automatic recovery:</strong> Smarter retry logic and seamless recovery from network errors.</li>
  <li style="margin-bottom: 8px;"><strong>Improved provider support:</strong> Enhanced reliability for Claude, Bedrock, Gemini, and OpenAI-compatible providers.</li>
  <li style="margin-bottom: 8px;"><strong>Safer streaming cancellation:</strong> Cleaner SSE stream cancellation when interrupting generations.</li>
  <li style="margin-bottom: 8px;"><strong>Better finish reason handling:</strong> Improved handling of unknown model finish reasons.</li>
</ul>

<p>Open VS Code, update Blue to <strong>v0.6.44</strong>, and try out your latest prompts. If you run into anything or have feedback, just hit reply to this email!</p>

<p>Happy coding,</p>
`, SITE_URL);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const databaseUrl = process.env.DATABASE_URL!;

  // 1. Supabase Auth Users
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data: supabaseUsersData } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  const supabaseEmails = (supabaseUsersData?.users || [])
    .map(u => u.email?.trim().toLowerCase())
    .filter((e): e is string => !!e);

  // 2. Neon DB Users
  let neonEmails: string[] = [];
  try {
    const sql = neon(databaseUrl);
    const rows = await sql`SELECT email FROM users WHERE email IS NOT NULL`;
    neonEmails = rows
      .map((r: any) => r.email?.trim().toLowerCase())
      .filter((e: string) => !!e);
  } catch (err) {
    console.error("Neon DB error:", err);
  }

  // 3. Deduplicate
  const recipientSet = new Set<string>([...supabaseEmails, ...neonEmails]);
  const recipients = Array.from(recipientSet).sort();

  console.log(`Starting broadcast of v0.6.44 update to ${recipients.length} unique recipients...`);

  // 4. Setup Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Verify connection
  await transporter.verify();
  console.log("SMTP Transporter verified successfully.");

  let successCount = 0;
  let failCount = 0;
  const failedEmails: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    try {
      await transporter.sendMail({
        from: '"Om Karande - Blue AI" <team.imergene@gmail.com>',
        to: recipient,
        subject: emailSubject,
        html: emailBody
      });
      successCount++;
      if ((i + 1) % 25 === 0 || i === recipients.length - 1) {
        console.log(`Progress: ${i + 1}/${recipients.length} sent successfully.`);
      }
    } catch (err: any) {
      failCount++;
      console.error(`Failed to send to ${recipient}:`, err?.message || err);
      failedEmails.push({ email: recipient, error: err?.message || String(err) });
    }

    // Small delay to prevent SMTP throttling
    await delay(150);
  }

  console.log("\n================ BROADCAST SUMMARY ================");
  console.log(`Total Recipients: ${recipients.length}`);
  console.log(`Successfully Sent: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  if (failedEmails.length > 0) {
    console.log("Failed List:", JSON.stringify(failedEmails, null, 2));
  }
  console.log("====================================================\n");
}

main().catch(console.error);
