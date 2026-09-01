import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CheckoutForm } from './checkout-form';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ session_id?: string; return_url?: string }>;
}

function ErrorState({ message, linkHref, linkText }: { message: string; linkHref?: string; linkText?: string }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-line p-8 bg-paper-alt text-center">
        <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl"></i>
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Something went wrong</h2>
        <p className="text-sm text-ink-muted mb-6">{message}</p>
        {linkHref && (
          <Link
            href={linkHref}
            className="inline-block px-5 py-2.5 rounded-lg bg-brand font-semibold text-white text-sm shadow-lg transition duration-200"
          >
            {linkText || 'Go Back'}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function CheckoutBluePage({ searchParams }: Props) {
  const { session_id, return_url } = await searchParams;

  if (!session_id) {
    return (
      <ErrorState
        message="Missing checkout session. Please return to Blue Portal and try subscribing again."
        linkHref="/subscribe"
        linkText="Back to Subscribe Page"
      />
    );
  }

  if (!supabaseAdmin) {
    return (
      <ErrorState
        message="Database connection error. Please try again later."
        linkHref="/subscribe"
      />
    );
  }

  const { data: session, error } = await supabaseAdmin
    .from('checkout_sessions')
    .select('*')
    .eq('id', session_id)
    .single();

  if (error || !session) {
    return (
      <ErrorState
        message="This checkout link is invalid. Please return to Blue Portal and try subscribing again."
        linkHref="/subscribe"
        linkText="Back to Subscribe Page"
      />
    );
  }

  if (session.status === 'completed') {
    return (
      <ErrorState
        message="This subscription has already been processed successfully."
        linkHref="/console"
        linkText="Go to Console"
      />
    );
  }

  if (session.status === 'expired' || new Date(session.expires_at) < new Date()) {
    return (
      <ErrorState
        message="This checkout session has expired. Please return to Blue Portal and try subscribing again."
        linkHref="/subscribe"
        linkText="Back to Subscribe Page"
      />
    );
  }

  let userEmail = (session.metadata as { email?: string } | null)?.email || '';

  if (!userEmail) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
      userEmail = user?.email || '';
    } catch {
      // fallback with empty email
    }
  }

  // Query wallets table securely on server to pass it down to form component
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('user_id', session.user_id)
    .single();

  const imrBalance = Number(wallet?.balance || 0);
  const returnUrl = return_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005'}/console`;

  return (
    <CheckoutForm
      sessionId={session_id}
      returnUrl={returnUrl}
      email={userEmail}
      imrBalance={imrBalance}
    />
  );
}
