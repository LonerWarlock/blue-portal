import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { COURSE_FEE } from '@/app/courses/config';

export async function POST(req: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';

  try {
    const data: Record<string, string> = {};

    try {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } catch {
      try {
        const text = await req.text();
        const searchParams = new URLSearchParams(text);
        searchParams.forEach((value, key) => {
          data[key] = value.toString();
        });
      } catch (e) {
        console.error('Failed to parse PayU callback body:', e);
      }
    }

    const key = (data.key || '').trim();
    const txnid = (data.txnid || '').trim();
    const amount = (data.amount || '').trim();
    const productinfo = (data.productinfo || '').trim();
    const firstname = (data.firstname || '').trim();
    const email = (data.email || '').toLowerCase().trim();
    const status = (data.status || '').toLowerCase().trim();
    const hash = (data.hash || '').trim();
    const additionalCharges = (data.additionalCharges || '').trim();
    const payuMoneyId = (data.mihpayid || data.payuMoneyId || txnid).trim();

    const salt = process.env.PAYU_MERCHANT_SALT || '';

    let hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.warn('Course PayU Callback Hash Mismatch (Proceeding with DB sync):', { calculatedHash, receivedHash: hash, txnid, email });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin unavailable during course PayU callback');
      return NextResponse.redirect(`${siteUrl}/courses?payment=failed&txnid=${txnid}`, 303);
    }

    if (status === 'success') {
      let pendingFd: Record<string, any> | null = null;
      let pendingId: string | null = null;

      if (txnid) {
        const { data: pending } = await supabaseAdmin
          .from('pending_registrations')
          .select('id, form_data')
          .eq('id', txnid)
          .maybeSingle();

        if (pending && pending.form_data) {
          pendingFd = pending.form_data;
          pendingId = pending.id;
        }
      }

      if (!pendingFd && email) {
        const { data: fallbackList } = await supabaseAdmin
          .from('pending_registrations')
          .select('id, form_data')
          .order('created_at', { ascending: false })
          .limit(10);

        if (fallbackList) {
          const match = fallbackList.find(r => {
            const fdEmail = (r.form_data?.email || '').toLowerCase().trim();
            return fdEmail === email;
          });
          if (match && match.form_data) {
            pendingFd = match.form_data;
            pendingId = match.id;
          }
        }
      }

      const fd = pendingFd || {
        firstName: firstname || 'Participant',
        lastName: '',
        email: email,
        phone: data.phone || '',
        degree: '',
        branch: '',
        collegeName: '',
        yearOfStudy: '',
        currentStatus: '',
        programmingExperience: '',
        declarationAccepted: true,
        termsAccepted: true,
      };

      const courseEmail = (fd.email || email).toLowerCase().trim();

      const { data: existing } = await supabaseAdmin
        .from('course_registrations')
        .select('id')
        .eq('email', courseEmail)
        .eq('payment_status', 'success')
        .maybeSingle();

      if (existing) {
        if (pendingId) {
          await supabaseAdmin.from('pending_registrations').delete().eq('id', pendingId);
        }
        return NextResponse.redirect(`${siteUrl}/courses?payment=success&txnid=${txnid}`, 303);
      }

      await supabaseAdmin
        .from('course_registrations')
        .delete()
        .eq('email', courseEmail)
        .neq('payment_status', 'success');

      const { error: insertError } = await supabaseAdmin
        .from('course_registrations')
        .insert({
          first_name: (fd.firstName || firstname || '').trim(),
          last_name: (fd.lastName || '').trim(),
          email: courseEmail,
          phone: (fd.phone || data.phone || '').trim(),
          date_of_birth: fd.dateOfBirth?.trim() || null,
          gender: fd.gender?.trim() || null,
          degree: (fd.degree || '').trim(),
          branch: (fd.branch || '').trim(),
          college_name: (fd.collegeName || '').trim(),
          year_of_study: (fd.yearOfStudy || '').trim(),
          current_status: (fd.currentStatus || '').trim(),
          programming_experience: (fd.programmingExperience || '').trim(),
          declaration_accepted: fd.declarationAccepted ?? true,
          terms_accepted: fd.termsAccepted ?? true,
          payment_txn_id: payuMoneyId || txnid,
          payment_amount: Number(amount) || COURSE_FEE,
          payment_status: 'success',
        });

      if (insertError) {
        console.error('Failed to insert course registration on successful callback:', insertError);
        return NextResponse.redirect(`${siteUrl}/courses?payment=failed&txnid=${txnid}`, 303);
      }

      if (pendingId) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', pendingId);
      } else if (txnid) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      }

      try {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '587');
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (user && pass) {
          const transporter = nodemailer.createTransport({
            host, port, secure: port === 465, auth: { user, pass }
          });

          const fullName = `${(fd.firstName || firstname || '').trim()} ${(fd.lastName || '').trim()}`.trim();

          transporter.sendMail({
            from: `"Imergene Bootcamp" <${user}>`,
            to: courseEmail,
            subject: 'Registration Confirmed — Python & Data Science Bootcamp 2026',
            html: `
              <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;background:#f8fafb;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
                  <h2 style="margin-top:0;color:#6d28d9;border-bottom:2px solid #f1f5f9;padding-bottom:10px;">Bootcamp Registration Confirmed</h2>
                  <p>Hi <strong>${fullName}</strong>,</p>
                  <p>Your registration for the <strong>Python & Data Science Bootcamp 2026</strong> has been confirmed. Your payment of <strong>\u20B9${COURSE_FEE}</strong> has been received successfully.</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;width:140px;">Name:</td><td style="padding:8px 0;">${fullName}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Email:</td><td style="padding:8px 0;">${courseEmail}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Phone:</td><td style="padding:8px 0;">${(fd.phone || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Degree:</td><td style="padding:8px 0;">${(fd.degree || '').trim()} — ${(fd.branch || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">College:</td><td style="padding:8px 0;">${(fd.collegeName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Transaction ID:</td><td style="padding:8px 0;">${payuMoneyId || txnid}</td></tr>
                  </table>
                  <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:20px 0;">
                    <h3 style="margin-top:0;color:#6d28d9;font-size:16px;">Bootcamp Timeline</h3>
                    <p style="margin:4px 0;color:#334155;"><strong>Start Date:</strong> 13 August 2026</p>
                    <p style="margin:4px 0;color:#334155;"><strong>End Date:</strong> 30 September 2026</p>
                    <p style="margin:4px 0;color:#334155;"><strong>Duration:</strong> 45 days</p>
                  </div>
                  <p style="color:#475569;">We will reach out to you shortly with the detailed schedule and session links.</p>
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
                    <p style="margin:0;color:#166534;"><strong>Join the WhatsApp Group for updates:</strong></p>
                    <p style="margin:4px 0 0;"><a href="https://chat.whatsapp.com/CIdlgkTxklS7I3kZ6RqNcg" style="color:#2563eb;">Click here to join</a></p>
                  </div>
                  <p style="color:#475569;">For queries: Om Karande (+91 93226 11145) | Soham Phatak (+91 74987 87848)</p>
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
                  <p style="font-size:12px;color:#94a3b8;">Organized by Imergene &ndash; <a href="https://www.imergene.in" style="color:#6d28d9;">www.imergene.in</a></p>
                </div>
              </div>
            `
          }).catch(e => console.error('Failed sending course confirmation mail:', e));
        }
      } catch (mailErr) {
        console.error('SMTP Setup Error in Course PayU Callback:', mailErr);
      }

      return NextResponse.redirect(`${siteUrl}/courses?payment=success&txnid=${txnid}`, 303);
    } else {
      if (txnid) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      }
      return NextResponse.redirect(`${siteUrl}/courses?payment=failed&txnid=${txnid}`, 303);
    }
  } catch (err: any) {
    console.error('Course PayU Callback Fatal Error:', err);
    return NextResponse.redirect(`${siteUrl}/courses?payment=failed`, 303);
  }
}
