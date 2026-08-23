import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { JAVA_COURSE } from "@/app/courses/java/config";
import { completeJavaCoursePayment } from "@/lib/javaCoursePayment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const txnid = new URL(request.url).searchParams.get("txnid")?.trim() || "";
  const headers = { "Cache-Control": "no-store, max-age=0" };

  if (!/^JAV[a-z0-9]{12,22}$/i.test(txnid)) {
    return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400, headers });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }

  const { data: completed, error: completedError } = await supabaseAdmin
    .from("java_course_registrations")
    .select("id")
    .eq("payment_txn_id", txnid)
    .eq("payment_status", "success")
    .maybeSingle();

  if (completedError) {
    console.error("Java payment status lookup failed:", completedError);
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }
  if (completed) return NextResponse.json({ status: "success", registrationId: completed.id }, { headers });

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("pending_registrations")
    .select("form_data")
    .eq("id", txnid)
    .maybeSingle();

  if (pendingError || !pending?.form_data || pending.form_data.courseKey !== "java_launchpad_2026") {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers });
  }

  const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim() || "";
  const salt = process.env.PAYU_MERCHANT_SALT?.trim() || "";
  if (!merchantKey || !salt) {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }

  try {
    const command = "verify_payment";
    const hash = createHash("sha512").update(`${merchantKey}|${command}|${txnid}|${salt}`).digest("hex");
    const paymentUrl = process.env.NEXT_PUBLIC_PAYU_URL || "https://secure.payu.in/_payment";
    const verifyUrl = paymentUrl.includes("test.payu.in")
      ? "https://test.payu.in/merchant/postservice.php?form=2"
      : "https://info.payu.in/merchant/postservice.php?form=2";
    const body = new URLSearchParams({ key: merchantKey, command, var1: txnid, hash });
    const payuResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const verification = await payuResponse.json();
    const detail = verification?.transaction_details?.[txnid];
    const status = String(detail?.status || "").toLowerCase();
    const unmappedStatus = String(detail?.unmappedstatus || "").toLowerCase();
    const paidAmount = Number(detail?.amt ?? detail?.amount ?? detail?.originalAmount);
    const productInfo = String(detail?.productinfo ?? detail?.productInfo ?? "");
    const paymentSucceeded = status === "success" || unmappedStatus === "captured";
    const amountMatches = Number.isFinite(paidAmount) && paidAmount.toFixed(2) === JAVA_COURSE.totalPayablePayU;
    const pendingAmountMatches = Number(pending.form_data.amount).toFixed(2) === JAVA_COURSE.totalPayablePayU;
    const productMatches = !productInfo || productInfo === JAVA_COURSE.productInfo;

    if (!payuResponse.ok || Number(verification?.status) !== 1 || !detail || !paymentSucceeded || !amountMatches || !pendingAmountMatches || !productMatches) {
      console.warn("Java payment reconciliation did not confirm success.", { txnid, status, unmappedStatus });
      return NextResponse.json({ status: "not_successful" }, { status: 409, headers });
    }

    const completion = await completeJavaCoursePayment({
      txnid,
      payuPaymentId: String(detail.mihpayid || detail.mihpayupid || txnid),
      formData: pending.form_data,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    });

    if (!completion.ok) {
      return NextResponse.json({ error: completion.error }, { status: 500, headers });
    }

    return NextResponse.json({ status: "success", registrationId: completion.registrationId }, { headers });
  } catch (error) {
    console.error("Java PayU reconciliation failed:", error);
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }
}
