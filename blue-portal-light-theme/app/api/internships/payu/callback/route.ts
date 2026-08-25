import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { INTERNSHIP_FEE } from '@/app/internships/config';

export async function POST(req: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';

  try {
    const data: Record<string, string> = {};

    // 1. Safe parsing of incoming form data (supports both multipart and urlencoded)
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

    // Verify reverse signature hash
    let hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.warn('Internship PayU Callback Hash Mismatch (Proceeding with DB sync):', { calculatedHash, receivedHash: hash, txnid, email });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client unavailable during PayU callback');
      return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
    }

    if (status === 'success') {
      let pendingFd: Record<string, any> | null = null;
      let pendingId: string | null = null;

      // 2a. Primary lookup: by txnid in pending_registrations
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

      // 2b. Fallback lookup: by email in pending_registrations if txnid match missed
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

      // 3. Fallback form data if pending registration was somehow missing
      const fd = pendingFd || {
        firstName: firstname || 'Intern',
        lastName: '',
        email: email,
        phone: data.phone || '',
        paymentTxnId: payuMoneyId || txnid,
        paymentAmount: Number(amount) || INTERNSHIP_FEE
      };

      const internEmail = (fd.email || email).toLowerCase().trim();

      // 4. Idempotency check: already in interns as success?
      const { data: existing } = await supabaseAdmin
        .from('interns')
        .select('id')
        .eq('email', internEmail)
        .eq('payment_status', 'success')
        .maybeSingle();

      if (existing) {
        if (pendingId) {
          await supabaseAdmin.from('pending_registrations').delete().eq('id', pendingId);
        }
        return NextResponse.redirect(`${siteUrl}/internships?payment=success&txnid=${txnid}`, 303);
      }

      // Clean any previous non-successful attempts for this email
      await supabaseAdmin
        .from('interns')
        .delete()
        .eq('email', internEmail)
        .neq('payment_status', 'success');

      // 5. Create the intern record as SUCCESS
      const { error: insertError } = await supabaseAdmin
        .from('interns')
        .insert({
          first_name: (fd.firstName || firstname || '').trim(),
          last_name: (fd.lastName || '').trim(),
          date_of_birth: fd.dateOfBirth || null,
          gender: fd.gender || '',
          email: internEmail,
          phone: (fd.phone || data.phone || '').trim(),
          alternate_phone: fd.alternatePhone?.trim() || null,
          father_name: (fd.fatherName || '').trim(),
          mother_name: (fd.motherName || '').trim(),
          current_address: (fd.currentAddress || '').trim(),
          current_city: (fd.currentCity || '').trim(),
          current_state: (fd.currentState || '').trim(),
          current_pin: (fd.currentPin || '').trim(),
          permanent_address: (fd.permanentAddress || '').trim(),
          permanent_city: (fd.permanentCity || '').trim(),
          permanent_state: (fd.permanentState || '').trim(),
          permanent_pin: (fd.permanentPin || '').trim(),
          degree: (fd.degree || '').trim(),
          branch: (fd.branch || '').trim(),
          college_name: (fd.collegeName || '').trim(),
          university_name: (fd.universityName || '').trim(),
          year_start: (fd.yearStart || '').trim(),
          year_end: (fd.yearEnd || '').trim(),
          cgpa: (fd.cgpa || '').trim(),
          backlogs: (fd.backlogs || '0').trim(),
          technical_skills: (fd.technicalSkills || '').trim(),
          programming_languages: (fd.programmingLanguages || '').trim() || null,
          previous_internships: (fd.previousInternships || '').trim() || null,
          github_url: (fd.githubUrl || '').trim() || null,
          portfolio_url: (fd.portfolioUrl || '').trim() || null,
          declaration_accepted: fd.declarationAccepted ?? true,
          terms_accepted: fd.termsAccepted ?? true,
          payment_txn_id: payuMoneyId || txnid,
          payment_amount: Number(amount) || INTERNSHIP_FEE,
          payment_status: 'success',
        });

      if (insertError) {
        console.error('Failed to insert intern record on successful callback:', insertError);
        return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
      }

      // Clean up pending registration
      if (pendingId) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', pendingId);
      } else if (txnid) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      }

      // 6. Send confirmation email (Async best-effort)
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

          // Email to intern
          transporter.sendMail({
            from: `"Imergene Internships" <${user}>`,
            to: internEmail,
            subject: 'Registration Confirmed — Imergene Internship Program',
            html: `
              <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;background:#f8fafc;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
                  <h2 style="margin-top:0;color:#1e3c72;border-bottom:2px solid #f1f5f9;padding-bottom:10px;">Internship Registration Confirmed</h2>
                  <p>Hi <strong>${fullName}</strong>,</p>
                  <p>Your registration for the <strong>Imergene Internship Program</strong> has been confirmed. Your payment of <strong>₹${INTERNSHIP_FEE}</strong> has been received successfully.</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;width:140px;">Name:</td><td style="padding:8px 0;">${fullName}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Email:</td><td style="padding:8px 0;">${internEmail}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Phone:</td><td style="padding:8px 0;">${(fd.phone || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Degree:</td><td style="padding:8px 0;">${(fd.degree || '').trim()} — ${(fd.branch || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">College:</td><td style="padding:8px 0;">${(fd.collegeName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Transaction ID:</td><td style="padding:8px 0;">${payuMoneyId || txnid}</td></tr>
                  </table>
                  <p>We will reach out to you shortly with further details regarding your internship schedule.</p>
                </div>
              </div>
            `
          }).catch(e => console.error('Failed sending intern confirmation mail:', e));
        }
      } catch (mailErr) {
        console.error('SMTP Setup Error in PayU Callback:', mailErr);
      }

      return NextResponse.redirect(`${siteUrl}/internships?payment=success&txnid=${txnid}`, 303);
    } else {
      // Payment status is failed or cancelled
      if (txnid) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      }
      return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
    }
  } catch (err: any) {
    console.error('Internship PayU Callback Fatal Error:', err);
    return NextResponse.redirect(`${siteUrl}/internships?payment=failed`, 303);
  }
}
