import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { INTERNSHIP_FEE } from '@/app/internships/config';

export async function POST(req: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';

  try {
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    const {
      key, txnid, amount, productinfo, firstname, email,
      status, hash, additionalCharges
    } = data;

    const salt = process.env.PAYU_MERCHANT_SALT || '';

    // Verify reverse signature hash — same formula as checkout callback (no udf in hash)
    // PayU sends back the udf values but hash verification uses empty udf fields
    let hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.error('Internship PayU Callback Hash Mismatch!', { calculatedHash, receivedHash: hash });
    }

    if (!supabaseAdmin) {
      return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
    }

    if (status === 'success') {
      // Read form data from pending_registrations
      const { data: pending, error: fetchError } = await supabaseAdmin
        .from('pending_registrations')
        .select('form_data')
        .eq('id', txnid)
        .maybeSingle();

      if (fetchError || !pending) {
        console.error('Pending registration not found for txnid:', txnid, fetchError);
        return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
      }

      const fd = pending.form_data as Record<string, any>;

      // Idempotency check
      const { data: existing } = await supabaseAdmin
        .from('interns')
        .select('id')
        .eq('email', (fd.email || '').toLowerCase().trim())
        .eq('payment_status', 'success')
        .maybeSingle();

      if (existing) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
        return NextResponse.redirect(`${siteUrl}/internships?payment=success&txnid=${txnid}`, 303);
      }

      // Clean any previous failed records for this email
      await supabaseAdmin
        .from('interns')
        .delete()
        .eq('email', (fd.email || '').toLowerCase().trim())
        .neq('payment_status', 'success');

      // Create the intern record ONLY on successful payment
      const { error: insertError } = await supabaseAdmin
        .from('interns')
        .insert({
          first_name: (fd.firstName || '').trim(),
          last_name: (fd.lastName || '').trim(),
          date_of_birth: fd.dateOfBirth || null,
          gender: fd.gender || '',
          email: (fd.email || '').toLowerCase().trim(),
          phone: (fd.phone || '').trim(),
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
          declaration_accepted: fd.declarationAccepted || false,
          terms_accepted: fd.termsAccepted || false,
          payment_txn_id: txnid,
          payment_amount: INTERNSHIP_FEE,
          payment_status: 'success',
        });

      if (insertError) {
        console.error('Failed to create intern record:', insertError);
        return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
      }

      // Send confirmation email to intern + notification to admin
      try {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '465');
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (user && pass) {
          const transporter = nodemailer.createTransport({
            host, port, secure: port === 465, auth: { user, pass }
          });

          const internEmail = (fd.email || '').toLowerCase().trim();
          const fullName = `${(fd.firstName || '').trim()} ${(fd.lastName || '').trim()}`;

          // 1. Confirmation email to intern
          await transporter.sendMail({
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
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Domain:</td><td style="padding:8px 0;">${(fd.branch || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Duration:</td><td style="padding:8px 0;">60 Hours</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Transaction ID:</td><td style="padding:8px 0;">${txnid}</td></tr>
                  </table>
                  <p>We will reach out to you shortly with further details regarding your internship schedule and lectures.</p>
                  <p style="margin-top:25px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:15px;text-align:center;">
                    This is an automated confirmation from Imergene. Do not reply to this email.
                  </p>
                </div>
              </div>
            `
          });

          // 2. Notification email to admin
          await transporter.sendMail({
            from: `"Imergene Internships" <${user}>`,
            to: 'team.imergene@gmail.com',
            subject: `New Intern Registration — ${fullName}`,
            html: `
              <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;background:#f8fafc;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
                  <h2 style="margin-top:0;color:#1e3c72;border-bottom:2px solid #f1f5f9;padding-bottom:10px;">New Intern Registered</h2>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;width:140px;">Name:</td><td style="padding:8px 0;">${fullName}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Email:</td><td style="padding:8px 0;"><a href="mailto:${internEmail}">${internEmail}</a></td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Phone:</td><td style="padding:8px 0;">${(fd.phone || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Father:</td><td style="padding:8px 0;">${(fd.fatherName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Mother:</td><td style="padding:8px 0;">${(fd.motherName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">DOB:</td><td style="padding:8px 0;">${fd.dateOfBirth || ''}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Gender:</td><td style="padding:8px 0;">${fd.gender || ''}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Address:</td><td style="padding:8px 0;">${(fd.currentAddress || '').trim()}, ${(fd.currentCity || '').trim()}, ${(fd.currentState || '').trim()} — ${(fd.currentPin || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Degree:</td><td style="padding:8px 0;">${(fd.degree || '').trim()} — ${(fd.branch || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">College:</td><td style="padding:8px 0;">${(fd.collegeName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">University:</td><td style="padding:8px 0;">${(fd.universityName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">CGPA:</td><td style="padding:8px 0;">${(fd.cgpa || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Skills:</td><td style="padding:8px 0;">${(fd.technicalSkills || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Prog. Languages:</td><td style="padding:8px 0;">${(fd.programmingLanguages || '').trim() || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">GitHub:</td><td style="padding:8px 0;">${(fd.githubUrl || '').trim() || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Prev. Internships:</td><td style="padding:8px 0;">${(fd.previousInternships || '').trim() || 'N/A'}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Txn ID:</td><td style="padding:8px 0;">${txnid}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Amount:</td><td style="padding:8px 0;">₹${INTERNSHIP_FEE}</td></tr>
                  </table>
                </div>
              </div>
            `
          });
        }
      } catch (emailErr) {
        console.error('Failed to send intern registration emails:', emailErr);
        // Don't fail the payment — emails are best-effort
      }

      // Clean up pending record
      await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);

      return NextResponse.redirect(`${siteUrl}/internships?payment=success&txnid=${txnid}`, 303);
    } else {
      // Payment failed — clean up pending record, no interns record created
      await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      return NextResponse.redirect(`${siteUrl}/internships?payment=failed&txnid=${txnid}`, 303);
    }
  } catch (err: any) {
    console.error('Internship PayU Callback Error:', err);
    return NextResponse.redirect(`${siteUrl}/internships?payment=failed`, 303);
  }
}
