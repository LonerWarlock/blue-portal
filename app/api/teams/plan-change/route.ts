import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({error:'Teams subscriptions have been replaced by Blue Credits. Existing paid access remains valid until its expiry.',code:'teams_subscriptions_retired',checkout_url:'/blue-pro/checkout?pack=custom&credits=25'}, {status:410,headers:{'Cache-Control':'no-store'}});
}
