const nodemailer = require('nodemailer');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

async function testMail() {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(env.SMTP_PORT || '587');
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  console.log('Testing SMTP setup for:', user, 'via', host, port);

  if (!user || !pass) {
    console.error('Missing SMTP_USER or SMTP_PASS in .env.local!');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP Connection Verified Successfully!');

    const info = await transporter.sendMail({
      from: `"Imergene Learning" <${user}>`,
      to: user,
      subject: 'Test Registration Confirmation — Create Softwares Without Writing A Single Line Of Code',
      html: `
        <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;background:#f8fafb;padding:20px;">
          <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
            <h2 style="margin-top:0;color:#6d28d9;border-bottom:2px solid #f1f5f9;padding-bottom:10px;">Registration Confirmed</h2>
            <p>Hi <strong>Test Participant</strong>,</p>
            <p>Your registration for <strong>Create Softwares Without Writing A Single Line Of Code</strong> has been confirmed. Your payment of <strong>&#8377;2,000</strong> has been received successfully.</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0;color:#166534;"><strong>Join the WhatsApp Group for updates:</strong></p>
              <p style="margin:4px 0 0;"><a href="https://chat.whatsapp.com/KqjIjm2YhlkJNKZR6ObCoE" style="color:#2563eb;">Click here to join</a></p>
            </div>
            <p style="color:#475569;">For queries: Om Karande (+91 93226 11145) | Soham Phatak (+91 74987 87848)</p>
          </div>
        </div>
      `,
    });

    console.log('✅ Test Email Sent Successfully! Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ SMTP Error:', err);
  }
}

testMail();
