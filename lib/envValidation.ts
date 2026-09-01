const CRITICAL_SERVER_ENV = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MANAGEMENT_API_KEY',
  'OPENROUTER_WORKSPACE_ID',
  'BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYU_MERCHANT_KEY',
  'PAYU_MERCHANT_SALT',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL'
] as const;

export function productionEnvironmentStatus(): {
  ready: boolean;
  missing: string[];
} {
  if (process.env.NODE_ENV !== 'production') return { ready: true, missing: [] };
  const missing = CRITICAL_SERVER_ENV.filter(name => !String(process.env[name] || '').trim());
  return { ready: missing.length === 0, missing: [...missing] };
}

export function reportProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const status = productionEnvironmentStatus();
  if (!status.ready) {
    console.error('[startup] production environment is incomplete', {
      missing: status.missing
    });
  }
}
