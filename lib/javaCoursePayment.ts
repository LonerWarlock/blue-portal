import nodemailer from "nodemailer";
import { JAVA_COURSE } from "@/app/courses/java/config";
import { escapeHtml, validateJavaRegistration } from "@/lib/javaCourseRegistration";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CompletePaymentInput = {
  txnid: string;
  payuPaymentId: string;
  formData: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type CompletePaymentResult =
  | { ok: true; registrationId: string }
  | { ok: false; error: string };

export async function completeJavaCoursePayment(input: CompletePaymentInput): Promise<CompletePaymentResult> {
  if (!supabaseAdmin) return { ok: false, error: "Database client unavailable." };

  const validation = validateJavaRegistration(input.formData);
  if (!validation.ok) return { ok: false, error: validation.error };
  const fd = validation.data;
  const paidAt = new Date().toISOString();

  // Keep legacy columns populated for installations that ran the original
  // pre-payment schema. These values are not collected from the learner.
  const { data: registration, error: saveError } = await supabaseAdmin
    .from("java_course_registrations")
    .upsert({
      full_name: fd.fullName,
      email: fd.email,
      phone: fd.phone,
      city: fd.city,
      current_status: fd.currentStatus,
      java_experience: fd.experience,
      preferred_schedule: "Not collected",
      learning_goal: null,
      consent_accepted: true,
      source: "java-course-landing-page",
      payment_txn_id: input.txnid,
      payu_payment_id: input.payuPaymentId,
      course_fee: JAVA_COURSE.fee,
      gateway_fee: JAVA_COURSE.gatewayFee,
      payment_amount: JAVA_COURSE.totalPayable,
      payment_status: "success",
      paid_at: paidAt,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent?.slice(0, 300) || null,
      updated_at: paidAt,
    }, { onConflict: "email" })
    .select("id")
    .single();

  if (saveError || !registration) {
    console.error("Java paid enrollment save failed:", saveError);
    return { ok: false, error: "Paid enrollment could not be saved." };
  }

  await supabaseAdmin.from("pending_registrations").delete().eq("id", input.txnid);

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const safeName = escapeHtml(fd.fullName);

      await transporter.sendMail({
        from: `"Imergene Learning" <${smtpUser}>`,
        to: fd.email,
        subject: `Payment confirmed — ${JAVA_COURSE.title}`,
        text: `Hi ${fd.fullName},\n\nYour enrollment in ${JAVA_COURSE.title} is confirmed. We received your payment of ${JAVA_COURSE.totalPayableLabel}, including ${JAVA_COURSE.gatewayFeeLabel} in payment processing charges.\n\nTransaction: ${input.txnid}\n\nJoin the learner WhatsApp group: ${JAVA_COURSE.whatsappGroupUrl}\n\nWe will send the final timetable and onboarding details before the cohort begins.\n\nImergene Learning`,
        html: `<div style="background:#f5f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#292524"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:20px;padding:32px"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#26733d;font-weight:700">Payment confirmed</div><h1 style="font-size:26px;margin:16px 0 12px">You’re enrolled, ${safeName}.</h1><p style="color:#57534e;line-height:1.7">Your enrollment in <strong>${JAVA_COURSE.title}</strong> is confirmed.</p><div style="margin:24px 0;padding:16px;border-radius:12px;background:#fafaf9;color:#57534e"><strong>Course fee:</strong> ${JAVA_COURSE.feeLabel}<br><strong>Payment processing:</strong> ${JAVA_COURSE.gatewayFeeLabel}<br><strong>Total paid:</strong> ${JAVA_COURSE.totalPayableLabel}<br><br><strong>Transaction:</strong> ${escapeHtml(input.txnid)}</div><a href="${JAVA_COURSE.whatsappGroupUrl}" style="display:inline-block;margin:0 0 20px;padding:12px 20px;border-radius:999px;background:#1f8f4d;color:#fff;text-decoration:none;font-weight:700">Join WhatsApp group</a><p style="color:#57534e;line-height:1.7">We will send the final timetable and onboarding details before the cohort begins.</p><p style="font-size:13px;color:#78716c">Questions? Reply to this email and our learning team will help.</p></div></div>`,
      });
    } catch (mailError) {
      console.error("Java payment confirmation email failed:", mailError);
    }
  }

  return { ok: true, registrationId: registration.id };
}
