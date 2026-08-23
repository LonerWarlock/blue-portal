import { createHash, timingSafeEqual } from "crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { JAVA_COURSE } from "@/app/courses/java/config";
import { escapeHtml, validateJavaRegistration } from "@/lib/javaCourseRegistration";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const secureHashEquals = (left: string, right: string) => {
  if (!/^[a-f0-9]{128}$/i.test(left) || !/^[a-f0-9]{128}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
};

export async function POST(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const siteUrl = configuredSiteUrl || new URL(request.url).origin;
  const redirect = (result: "success" | "failed", txnid = "") =>
    NextResponse.redirect(`${siteUrl}/courses/java?payment=${result}&txnid=${encodeURIComponent(txnid)}`, 303);

  try {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);
    const value = (name: string) => (params.get(name) || "").trim();

    const key = value("key");
    const txnid = value("txnid");
    const amount = value("amount");
    const productinfo = value("productinfo");
    const firstname = value("firstname");
    const email = value("email").toLowerCase();
    const status = value("status").toLowerCase();
    const receivedHash = value("hash");
    const additionalCharges = value("additionalCharges");
    const payuPaymentId = value("mihpayid") || value("payuMoneyId") || txnid;

    const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim() || "";
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() || "";
    if (!merchantKey || !salt || !txnid) {
      console.error("Java PayU callback rejected: configuration or transaction ID missing.");
      return redirect("failed", txnid);
    }

    let reverseHashSource = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) reverseHashSource = `${additionalCharges}|${reverseHashSource}`;
    const calculatedHash = createHash("sha512").update(reverseHashSource).digest("hex");

    const amountMatches = Number.isFinite(Number(amount)) && Number(amount).toFixed(2) === JAVA_COURSE.totalPayablePayU;
    const callbackIsAuthentic =
      key === merchantKey &&
      productinfo === JAVA_COURSE.productInfo &&
      amountMatches &&
      secureHashEquals(calculatedHash, receivedHash);

    if (!callbackIsAuthentic) {
      console.error("Java PayU callback rejected: signature or order details did not match.", { txnid, status });
      return redirect("failed", txnid);
    }

    if (!supabaseAdmin) {
      console.error("Java PayU callback failed: database client unavailable.");
      return redirect("failed", txnid);
    }

    if (status !== "success") {
      await supabaseAdmin.from("pending_registrations").delete().eq("id", txnid);
      return redirect("failed", txnid);
    }

    const { data: completed } = await supabaseAdmin
      .from("java_course_registrations")
      .select("id")
      .eq("payment_txn_id", txnid)
      .eq("payment_status", "success")
      .maybeSingle();

    if (completed) return redirect("success", txnid);

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("pending_registrations")
      .select("form_data")
      .eq("id", txnid)
      .maybeSingle();

    if (pendingError || !pending?.form_data) {
      console.error("Java PayU callback failed: pending enrollment not found.", { txnid, pendingError });
      return redirect("failed", txnid);
    }

    if (pending.form_data.courseKey !== "java_launchpad_2026" || pending.form_data.email !== email) {
      console.error("Java PayU callback rejected: pending enrollment does not match callback.", { txnid });
      return redirect("failed", txnid);
    }

    const validation = validateJavaRegistration(pending.form_data);
    if (!validation.ok) {
      console.error("Java PayU callback failed: stored enrollment is invalid.", { txnid, error: validation.error });
      return redirect("failed", txnid);
    }

    const fd = validation.data;
    const paidAt = new Date().toISOString();
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) || null;
    const { data: registration, error: saveError } = await supabaseAdmin
      .from("java_course_registrations")
      .upsert({
        full_name: fd.fullName,
        email: fd.email,
        phone: fd.phone,
        city: fd.city,
        current_status: fd.currentStatus,
        java_experience: fd.experience,
        preferred_schedule: fd.preferredSchedule,
        learning_goal: fd.learningGoal || null,
        consent_accepted: true,
        source: "java-course-landing-page",
        payment_txn_id: txnid,
        payu_payment_id: payuPaymentId,
        course_fee: JAVA_COURSE.fee,
        gateway_fee: JAVA_COURSE.gatewayFee,
        payment_amount: JAVA_COURSE.totalPayable,
        payment_status: "success",
        paid_at: paidAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        updated_at: paidAt,
      }, { onConflict: "email" })
      .select("id")
      .single();

    if (saveError || !registration) {
      console.error("Java PayU callback failed to save enrollment:", saveError);
      return redirect("failed", txnid);
    }

    await supabaseAdmin.from("pending_registrations").delete().eq("id", txnid);

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
          text: `Hi ${fd.fullName},\n\nYour enrollment in ${JAVA_COURSE.title} is confirmed. We received your payment of ${JAVA_COURSE.totalPayableLabel}, including ${JAVA_COURSE.gatewayFeeLabel} in payment processing charges.\n\nTransaction: ${txnid}\n\nWe will send the final timetable and onboarding details before the cohort begins.\n\nImergene Learning`,
          html: `<div style="background:#f5f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#292524"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:20px;padding:32px"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#26733d;font-weight:700">Payment confirmed</div><h1 style="font-size:26px;margin:16px 0 12px">You’re enrolled, ${safeName}.</h1><p style="color:#57534e;line-height:1.7">Your enrollment in <strong>${JAVA_COURSE.title}</strong> is confirmed.</p><div style="margin:24px 0;padding:16px;border-radius:12px;background:#fafaf9;color:#57534e"><strong>Course fee:</strong> ${JAVA_COURSE.feeLabel}<br><strong>Payment processing:</strong> ${JAVA_COURSE.gatewayFeeLabel}<br><strong>Total paid:</strong> ${JAVA_COURSE.totalPayableLabel}<br><br><strong>Transaction:</strong> ${escapeHtml(txnid)}<br><strong>Preferred schedule:</strong> ${escapeHtml(fd.preferredSchedule)}</div><p style="color:#57534e;line-height:1.7">We will send the final timetable and onboarding details before the cohort begins.</p><p style="font-size:13px;color:#78716c">Questions? Reply to this email and our learning team will help.</p></div></div>`,
        });
      } catch (mailError) {
        console.error("Java payment confirmation email failed:", mailError);
      }
    }

    return redirect("success", txnid);
  } catch (error) {
    console.error("Java PayU callback failed:", error);
    return redirect("failed");
  }
}
