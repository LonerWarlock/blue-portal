import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Supabase admin client is not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 });
    }

    // 1. Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // 2. Save OTP to public.otp_codes table
    const cleanEmail = email.trim().toLowerCase();
    let { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({ email: cleanEmail, code, expires_at: expiresAt }, { onConflict: 'email' });

    if (dbError) {
      // Fallback: Delete existing code if onConflict constraint fails, then insert
      await supabaseAdmin.from('otp_codes').delete().eq('email', cleanEmail);
      const { error: insertError } = await supabaseAdmin
        .from('otp_codes')
        .insert({ email: cleanEmail, code, expires_at: expiresAt });
      dbError = insertError;
    }

    if (dbError) {
      console.error('Database error storing OTP:', dbError);
      return NextResponse.json({ 
        error: `Failed to store verification code: ${dbError.message || dbError.details || JSON.stringify(dbError)}` 
      }, { status: 500 });
    }

    // 3. Configure Nodemailer with .env.local SMTP credentials
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      return NextResponse.json({ 
        error: 'SMTP credentials are not configured. Please add SMTP_USER and SMTP_PASS to .env.local' 
      }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"Blue AI Coding Assistant" <${user}>`,
      to: email.trim().toLowerCase(),
      subject: `Your Blue AI OTP Code: ${code}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; padding: 30px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e1e8ed;">
              <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 30px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Blue AI Coding Assistant</h1>
              </div>
              <div style="padding: 40px 30px; color: #333333; line-height: 1.6;">
                <p style="margin-top: 0; font-size: 16px;">Hello,</p>
                <p style="font-size: 16px;">Use the verification code below to complete your sign-in to Blue AI:</p>
                <div style="margin: 30px 0; text-align: center;">
                  <span style="display: inline-block; background-color: #f1f5f9; color: #1e3c72; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 15px 30px; border-radius: 6px; border: 1px solid #e2e8f0; font-family: monospace;">${code}</span>
                </div>
                <p style="font-size: 14px; color: #666666;">This code is valid for 5 minutes. If you did not request this code, you can safely ignore this email.</p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px;">
                &copy; 2026 Blue AI. All rights reserved.
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('SMTP sending error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred sending the verification code' }, { status: 500 });
  }
}
