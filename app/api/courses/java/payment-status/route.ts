import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const txnid = new URL(request.url).searchParams.get("txnid")?.trim() || "";
  const headers = { "Cache-Control": "no-store, max-age=0" };

  if (!/^JAV[a-z0-9]{12,22}$/i.test(txnid)) {
    return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400, headers });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }

  const { data, error } = await supabaseAdmin
    .from("java_course_registrations")
    .select("id, payment_status")
    .eq("payment_txn_id", txnid)
    .eq("payment_status", "success")
    .maybeSingle();

  if (error) {
    console.error("Java payment status lookup failed:", error);
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }

  if (!data) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers });
  }

  return NextResponse.json({ status: "success", registrationId: data.id }, { headers });
}
