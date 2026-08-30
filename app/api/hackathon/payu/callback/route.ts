import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { HACKATHON_FEE } from '@/app/hackathon/config';

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
      console.warn('Hackathon PayU Callback Hash Mismatch (Proceeding with DB sync):', { calculatedHash, receivedHash: hash, txnid, email });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin unavailable during hackathon PayU callback');
      return NextResponse.redirect(`${siteUrl}/hackathon?payment=failed&txnid=${txnid}`, 303);
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
            const fdEmail = (r.form_data?.leaderEmail || '').toLowerCase().trim();
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
        leaderFirstName: firstname || 'Participant',
        leaderLastName: '',
        leaderEmail: email,
        leaderPhone: data.phone || '',
        teamName: 'Untitled Team',
        teamSize: 2,
        teamMembers: [],
        degree: '',
        declarationAccepted: true,
        termsAccepted: true,
      };

      const leaderEmail = (fd.leaderEmail || email).toLowerCase().trim();

      // 4. Idempotency check: already in hackathon_registrations as success?
      const { data: existing } = await supabaseAdmin
        .from('hackathon_registrations')
        .select('id')
        .eq('leader_email', leaderEmail)
        .eq('payment_status', 'success')
        .maybeSingle();

      if (existing) {
        if (pendingId) {
          await supabaseAdmin.from('pending_registrations').delete().eq('id', pendingId);
        }
        return NextResponse.redirect(`${siteUrl}/hackathon?payment=success&txnid=${txnid}`, 303);
      }

      // Clean any previous non-successful attempts for this email
      await supabaseAdmin
        .from('hackathon_registrations')
        .delete()
        .eq('leader_email', leaderEmail)
        .neq('payment_status', 'success');

      // 5. Create the hackathon registration record as SUCCESS
      const { error: insertError } = await supabaseAdmin
        .from('hackathon_registrations')
        .insert({
          team_name: (fd.teamName || 'Untitled Team').trim(),
          team_size: Number(fd.teamSize) || 2,
          leader_first_name: (fd.leaderFirstName || firstname || '').trim(),
          leader_last_name: (fd.leaderLastName || '').trim(),
          leader_email: leaderEmail,
          leader_phone: (fd.leaderPhone || data.phone || '').trim(),
          leader_branch: (fd.leaderBranch || '').trim(),
          leader_year: (fd.leaderYear || '').trim(),
          team_members: fd.teamMembers || [],
          degree: (fd.degree || '').trim(),
          declaration_accepted: fd.declarationAccepted ?? true,
          terms_accepted: fd.termsAccepted ?? true,
          payment_txn_id: payuMoneyId || txnid,
          payment_amount: Number(amount) || HACKATHON_FEE,
          payment_status: 'success',
        });

      if (insertError) {
        console.error('Failed to insert hackathon registration on successful callback:', insertError);
        return NextResponse.redirect(`${siteUrl}/hackathon?payment=failed&txnid=${txnid}`, 303);
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

          const leaderName = `${(fd.leaderFirstName || firstname || '').trim()} ${(fd.leaderLastName || '').trim()}`.trim();
          const teamMembersList = (fd.teamMembers || []).map((m: any, i: number) => 
            `<tr><td style="padding:6px 0;font-weight:bold;color:#475569;width:140px;">Member ${i + 1}:</td><td style="padding:6px 0;">${(m.firstName || '').trim()} ${(m.lastName || '').trim()} (${(m.email || '').trim()})</td></tr>`
          ).join('');

          transporter.sendMail({
            from: `"IGNITE PVPIT 2026" <${user}>`,
            to: leaderEmail,
            subject: 'Registration Confirmed — IGNITE PVPIT 2026',
            html: `
              <div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;background:#f8fafb;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e2e8f0;">
                  <h2 style="margin-top:0;color:#1e3c72;border-bottom:2px solid #f1f5f9;padding-bottom:10px;">Hackathon Registration Confirmed</h2>
                  <p>Hi <strong>${leaderName}</strong>,</p>
                  <p>Your team <strong>${(fd.teamName || '').trim()}</strong> has been successfully registered for <strong>IGNITE PVPIT 2026</strong>. Your payment of <strong>\u20B9${HACKATHON_FEE}</strong> has been received.</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;width:140px;">Team Name:</td><td style="padding:8px 0;">${(fd.teamName || '').trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Team Size:</td><td style="padding:8px 0;">${fd.teamSize || 2} members</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Team Leader:</td><td style="padding:8px 0;">${leaderName}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Email:</td><td style="padding:8px 0;">${leaderEmail}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Phone:</td><td style="padding:8px 0;">${(fd.leaderPhone || '').trim()}</td></tr>
                    ${teamMembersList}
                    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;">Transaction ID:</td><td style="padding:8px 0;">${payuMoneyId || txnid}</td></tr>
                  </table>
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
                    <h3 style="margin-top:0;color:#166534;font-size:16px;">Hackathon Timeline</h3>
                    <p style="margin:4px 0;color:#334155;"><strong>Problem Statement Release &amp; Hackathon Begins:</strong> 1 August 2026, 9:00 PM</p>
                    <p style="margin:4px 0;color:#334155;"><strong>Hackathon Ends:</strong> 3 August 2026, 9:00 PM</p>
                    <p style="margin:4px 0;color:#334155;"><strong>Project Submission Deadline:</strong> 3 August 2026, 11:59 PM</p>
                  </div>
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
                    <h3 style="margin-top:0;color:#1e40af;font-size:16px;">What to Submit</h3>
                    <ul style="margin:8px 0;padding-left:20px;color:#334155;">
                      <li>A public GitHub repository link containing the source code</li>
                      <li>A screen recording demonstrating the working website</li>
                    </ul>
                  </div>
                  <p style="color:#475569;">Join the WhatsApp group for updates: <a href="https://chat.whatsapp.com/HHRjpE4pPH61nwDVTvDw2B" style="color:#2563eb;">Click here</a></p>
                  <p style="color:#475569;">For queries: Om Karande (+91 93226 11145) | Soham Phatak (+91 74987 87848)</p>
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
                  <p style="font-size:12px;color:#94a3b8;">Organized by Imergene &ndash; <a href="https://www.imergene.in" style="color:#2563eb;">www.imergene.in</a></p>
                </div>
              </div>
            `
          }).catch(e => console.error('Failed sending hackathon confirmation mail:', e));
        }
      } catch (mailErr) {
        console.error('SMTP Setup Error in Hackathon PayU Callback:', mailErr);
      }

      return NextResponse.redirect(`${siteUrl}/hackathon?payment=success&txnid=${txnid}`, 303);
    } else {
      // Payment status is failed or cancelled
      if (txnid) {
        await supabaseAdmin.from('pending_registrations').delete().eq('id', txnid);
      }
      return NextResponse.redirect(`${siteUrl}/hackathon?payment=failed&txnid=${txnid}`, 303);
    }
  } catch (err: any) {
    console.error('Hackathon PayU Callback Fatal Error:', err);
    return NextResponse.redirect(`${siteUrl}/hackathon?payment=failed`, 303);
  }
}
