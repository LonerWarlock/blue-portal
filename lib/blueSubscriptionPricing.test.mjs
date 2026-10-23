// Render the real pricing component against isolated account fixtures. No auth,
// browser sessions, payment endpoints or real accounts are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as plans from './blueSubscriptionPlans.ts';

const nativeRequire = createRequire(import.meta.url);
const source = await readFile(new URL('../app/pricing/PricingClient.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const wrapper = ({ children }) => React.createElement('div', null, children);
let subscription;
const modules = {
  'next/navigation': { useRouter: () => ({ push() {} }) },
  'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  'lucide-react': new Proxy({}, { get: () => () => null }),
  'motion/react': { MotionConfig: wrapper, useReducedMotion: () => true, motion: { span: 'span' } },
  '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'isolated-user' }, session: null,
    account: { subscription, wallet: { balance: 0 } }, accountLoading: false, accountError: '', invalidateAccount() {} }) },
  '@/app/components/PageLayout': { default: wrapper },
  '@/app/components/ClaimCouponModal': { default: () => null },
  '@/app/components/react-bits/SpotlightCard': { default: wrapper },
  '@/app/components/react-bits/StarBorder': { default: wrapper },
  './BillingCycleSelector': { default: () => null },
  '@/lib/blueSubscriptionPlans': plans,
  './pricing.module.css': { default: new Proxy({}, { get: (_target, name) => String(name) }) },
};
const exports = {};
new Function('require', 'exports', compiled)(name => name in modules ? modules[name] : nativeRequire(name), exports);
function render(next) {
  subscription = next;
  return renderToStaticMarkup(React.createElement(exports.default));
}

test('active prepaid Blue remains visible and extendable alongside Blue Pro model credits', () => {
  const html = render({ plan: 'blue_pro', monthly_plan: 'blue',
    monthly_expires_at: new Date(Date.now() + 15 * 86400000).toISOString(), billing_cycle: 'yearly' });
  assert.match(html, /Active app access/);
  assert.match(html, /Blue app access is active until/);
  assert.match(html, /Last access purchase: Yearly/);
  assert.match(html, /Extend access/);
  assert.match(html, /Blue Pro credits are separate, never expire/);
  assert.match(html, /No auto-renewal/);
});

test('expired or invalid Blue periods do not appear active even with a Blue Pro balance', () => {
  for (const expiry of [new Date(Date.now() - 1000).toISOString(), 'invalid']) {
    const html = render({ plan: 'blue_pro', monthly_plan: 'blue', monthly_expires_at: expiry, billing_cycle: 'monthly' });
    assert.doesNotMatch(html, /Active app access|Extend access|Last access purchase/);
    assert.match(html, /Get Blue/);
  }
});

test('non-expiring legacy Blue is not treated as a monthly recurring subscription', () => {
  const html = render({ plan: 'blue', monthly_plan: 'blue', monthly_expires_at: null, billing_cycle: null });
  assert.match(html, /active with no expiry/);
  assert.match(html, /Extend access/);
  assert.doesNotMatch(html, /Last access purchase/);
});
