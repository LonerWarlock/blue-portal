import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { JAVA_COURSE } from "@/app/courses/java/config";
import { completeJavaCoursePayment } from "@/lib/javaCoursePayment";
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
      // Preserve the pending record so the return page can reconcile with
      // PayU if the browser response disagrees with PayU's final status.
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

    const completion = await completeJavaCoursePayment({
      txnid,
      payuPaymentId,
      formData: pending.form_data,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    });

    if (!completion.ok) {
      console.error("Java PayU callback failed to complete enrollment:", completion.error);
      return redirect("failed", txnid);
    }

    return redirect("success", txnid);
  } catch (error) {
    console.error("Java PayU callback failed:", error);
    return redirect("failed");
  }
}
