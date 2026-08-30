import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { JAVA_COURSE } from "@/app/courses/java/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateJavaRegistration } from "@/lib/javaCourseRegistration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 20_000) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    const body = await request.json();
    if (typeof body?.website === "string" && body.website.trim()) {
      return NextResponse.json({ error: "Unable to initialize payment." }, { status: 400 });
    }

    const validation = validateJavaRegistration(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Enrollment is temporarily unavailable." }, { status: 503 });
    }

    const key = process.env.PAYU_MERCHANT_KEY?.trim() || "";
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() || "";
    const payuUrl = process.env.NEXT_PUBLIC_PAYU_URL?.trim() || "https://secure.payu.in/_payment";

    if (!key || !salt) {
      console.error("Java PayU order failed: merchant credentials are missing.");
      return NextResponse.json({ error: "Payment gateway is temporarily unavailable." }, { status: 503 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("java_course_registrations")
      .select("id")
      .eq("email", validation.data.email)
      .eq("payment_status", "success")
      .maybeSingle();

    if (existingError) {
      console.error("Java enrollment lookup failed:", existingError);
      return NextResponse.json({ error: "Enrollment is not ready yet. Please try again shortly." }, { status: 503 });
    }

    if (existing) {
      return NextResponse.json({ error: "This email is already enrolled in the course." }, { status: 409 });
    }

    const txnid = `JAV${Date.now().toString(36)}${randomBytes(5).toString("hex")}`.slice(0, 25);
    const pendingData = {
      ...validation.data,
      courseKey: "java_launchpad_2026",
      productInfo: JAVA_COURSE.productInfo,
      courseFee: JAVA_COURSE.feePayU,
      gatewayFee: JAVA_COURSE.gatewayFee.toFixed(2),
      amount: JAVA_COURSE.totalPayablePayU,
    };

    const { error: pendingError } = await supabaseAdmin
      .from("pending_registrations")
      .insert({ id: txnid, form_data: pendingData });

    if (pendingError) {
      console.error("Java pending enrollment insert failed:", pendingError);
      return NextResponse.json({ error: "Could not initialize payment. Please try again." }, { status: 500 });
    }

    const firstname = validation.data.fullName.split(/\s+/)[0] || "Participant";
    const hashSource = `${key}|${txnid}|${JAVA_COURSE.totalPayablePayU}|${JAVA_COURSE.productInfo}|${firstname}|${validation.data.email}|||||||||||${salt}`;
    const hash = createHash("sha512").update(hashSource).digest("hex");
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const siteUrl = configuredSiteUrl || new URL(request.url).origin;

    return NextResponse.json({
      payuUrl,
      key,
      txnid,
      amount: JAVA_COURSE.totalPayablePayU,
      productinfo: JAVA_COURSE.productInfo,
      firstname,
      email: validation.data.email,
      phone: validation.data.phone,
      surl: `${siteUrl}/api/courses/java/payu/callback`,
      furl: `${siteUrl}/api/courses/java/payu/callback`,
      hash,
    });
  } catch (error) {
    console.error("Java PayU order endpoint failed:", error);
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }
}
