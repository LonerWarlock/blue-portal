import type { PostHog } from 'posthog-js';

type AnalyticsClient = Pick<PostHog, 'init' | 'capture' | 'opt_in_capturing' | 'opt_out_capturing'>;
type Properties = Record<string, unknown>;

/** Analytics is best-effort: it must never participate in rendering a page. */
export function createOptionalAnalytics({ key, host, loadClient }: {
  key?: string;
  host?: string;
  loadClient: () => Promise<AnalyticsClient>;
}) {
  let allowed = false;
  let consentVersion = 0;
  let client: AnalyticsClient | null = null;
  let loading: Promise<AnalyticsClient | null> | null = null;
  let initialized = false;
  let optedIn = false;
  let requestedPage: string | null = null;
  let capturedPage: string | null = null;

  function setConsent(next: boolean) {
    if (next === allowed) return;
    allowed = next;
    consentVersion += 1;
    requestedPage = capturedPage = null;
    if (!next && initialized && client) {
      optedIn = false;
      try { client.opt_out_capturing(); } catch { /* Optional SDK failure. */ }
    }
  }

  async function getClient() {
    if (client) return client;
    if (!loading) {
      // Catch both a synchronous loader exception and an async chunk failure.
      loading = Promise.resolve().then(loadClient).then(loaded => {
        client = loaded;
        return loaded;
      }).catch(() => null).finally(() => { loading = null; });
    }
    return loading;
  }

  async function send(event: string, properties?: Properties, isCurrent = () => true, onSent = () => {}) {
    if (!allowed || !key) return false;
    const version = consentVersion;
    try {
      const loaded = await getClient();
      // A slow import must not initialize or emit after consent was withdrawn.
      if (!loaded || !allowed || version !== consentVersion || !isCurrent()) return false;
      if (!initialized) {
        loaded.init(key, {
          api_host: host || 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false,
          capture_pageleave: false,
          autocapture: false,
          opt_out_capturing_by_default: true,
          opt_out_persistence_by_default: true,
        });
        initialized = true;
      }
      if (!optedIn) {
        loaded.opt_in_capturing({ captureEventName: false });
        optedIn = true;
      }
      loaded.capture(event, properties);
      onSent();
      return true;
    } catch {
      // No rejected promise or React state update may escape into the app.
      return false;
    }
  }

  async function trackPageView(url: string) {
    if (!allowed || !key) return false;
    requestedPage = url;
    return send('$pageview', { $current_url: url },
      () => requestedPage === url && capturedPage !== url,
      () => { capturedPage = url; });
  }

  return { setConsent, capture: (event: string, properties?: Properties) => send(event, properties), trackPageView };
}

// Native import runs only for an explicitly consented event. In particular,
// posthog-js/react must not wrap the route or put its SDK on the layout path.
export const analytics = createOptionalAnalytics({
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  loadClient: async () => (await import('posthog-js')).default,
});
