import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json();
    
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    // Configure Nodemailer with SMTP credentials from environment
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
      from: `"Blue AI Contact Form" <${user}>`,
      to: 'team.imergene@gmail.com',
      replyTo: email.trim().toLowerCase(),
      subject: `New Contact Form Message from ${name}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6; background-color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <h2 style="margin-top: 0; color: #1e3c72; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">New Message from Contact Form</h2>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #475569;">Name:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #475569;">Email:</td>
                  <td style="padding: 8px 0; color: #1e293b;"><a href="mailto:${email}">${email}</a></td>
                </tr>
              </table>

              <div style="margin-top: 25px; padding: 15px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; color: #475569;">Message:</h4>
                <p style="margin: 0; white-space: pre-wrap; color: #0f172a;">${message}</p>
              </div>

              <div style="margin-top: 30px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">
                This email was sent automatically from the Blue AI contact form.
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: 'Message sent successfully' });
  } catch (error: any) {
    console.error('SMTP sending error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred sending the message' }, { status: 500 });
  }
}
