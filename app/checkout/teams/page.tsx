import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';
import { safeInternalUrl } from '@/lib/paymentSecurity';
import { getBlueTeamsPlan, getBlueTeamsCheckoutQuote, getBlueTeamsTierFromCheckoutPlan } from '@/lib/blueTeamsPlans';
import { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';
import TeamsCheckoutForm from './checkout-form';

export const dynamic = 'force-dynamic';

function ErrorState({ message }: { message: string }) {
  return <main className="min-h-screen bg-paper flex items-center justify-center p-6"><section className="max-w-md w-full rounded-xl border border-line p-8 bg-paper-alt text-center">
    <h1 className="text-lg font-bold text-ink mb-2">Checkout could not open</h1><p className="text-sm text-ink-muted mb-6">{message}</p>
    <Link href="/teams" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white text-sm">Back to Blue Teams</Link>
  </section></main>;
}

export default async function TeamsCheckoutPage({ searchParams }: { searchParams: Promise<{ session_id?: string; return_url?: string }> }) {
  const { session_id, return_url } = await searchParams;
  if (!session_id || !supabaseAdmin) return <ErrorState message="This checkout link is incomplete. Return to Blue Teams and try again." />;
  const { data: session, error } = await supabaseAdmin.from('checkout_sessions').select('*').eq('id', session_id).single();
  const tier = getBlueTeamsTierFromCheckoutPlan(session?.plan);
  const plan = getBlueTeamsPlan(tier);
  if (error || !session || !tier || !plan || session.billing_cycle !== 'monthly' || session.metadata?.product_kind !== 'blue_teams') {
    return <ErrorState message="This checkout link is invalid. Return to Blue Teams and choose a plan again." />;
  }
  if (session.status === 'completed') return <ErrorState message="This payment has already been processed." />;
  if (session.status !== 'pending' || new Date(session.expires_at).getTime() <= Date.now()) return <ErrorState message="This checkout has expired. Return to Blue Teams to start again." />;
  const sandboxTestMode = session.metadata?.blue_teams_test_mode === true;
  const liveTestMode = session.metadata?.blue_teams_live_test_mode === true;
  if (sandboxTestMode && liveTestMode) return <ErrorState message="This checkout has an invalid test configuration. Return to Blue Teams and try again." />;
  const config = getBlueTeamsCheckoutConfig();
  const methodsAvailable = sandboxTestMode ? config.testMode : (config.payuAvailable || config.paypalAvailable);
  if (!methodsAvailable) return <ErrorState message="The payment configuration changed while this checkout was open. Please return to Blue Teams and try again." />;
  const email = String(session.metadata?.email || '');
  const returnUrl = safeInternalUrl(return_url, paymentSiteOrigin(), '/teams').toString();
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('user_id', session.user_id)
    .single();
  const imrBalance = Number(wallet?.balance || 0);
  let quote;
  try { quote = getBlueTeamsCheckoutQuote(session.metadata); }
  catch { return <ErrorState message="The saved payment quote could not be verified. Return to Teams to create a new checkout." />; }

  return <TeamsCheckoutForm sessionId={session.id} returnUrl={returnUrl} email={email} tier={tier} sandboxTestMode={sandboxTestMode} liveTestMode={liveTestMode}
    imrBalance={imrBalance} quote={quote} />;
}
