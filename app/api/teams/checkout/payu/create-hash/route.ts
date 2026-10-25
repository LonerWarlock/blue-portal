import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
/** Existing provider callbacks remain available to reconcile stored payments. */
export async function POST() {
  return NextResponse.json({error:'Blue Teams subscriptions have been replaced by Blue Credits. Purchase at least 25 Blue Credits to activate Teams.',code:'teams_subscriptions_retired',checkout_url:'/blue-pro/checkout?pack=custom&credits=25'}, {status:410,headers:{'Cache-Control':'no-store'}});
}
