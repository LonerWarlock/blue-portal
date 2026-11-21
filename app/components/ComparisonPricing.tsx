import Link from "next/link";
import { BLUE_SUBSCRIPTION_PLANS } from "@/lib/blueSubscriptionPlans";
import { BLUE_CREDIT_PRICE_INR, BLUE_CREDIT_PRICE_USD, quoteBlueCredits } from "@/lib/blueCreditPricing";

export default function ComparisonPricing({ product }: { product: "codex" | "emergent" }) {
  const monthly = BLUE_SUBSCRIPTION_PLANS.monthly;
  const activation = quoteBlueCredits(25);
  const name = product === "codex" ? "Codex" : "Emergent";
  const sources = product === "codex" ? "https://learn.chatgpt.com/docs/pricing" : "https://emergent.sh/pricing";
  const rows = product === "codex" ? [
    ["Free", "$0/month", "Entry access is listed; available models and limits depend on the current rollout."],
    ["Plus", "$20/month", "Includes a usage allowance. Check current limits and additional-credit options."],
    ["Pro", "From $100/month", "Several Pro tiers are listed. Their allowances and features differ."],
  ] : [
    ["Free", "$0/month", "10 monthly build credits are listed."],
    ["Standard", "$20/month, billed annually", "100 monthly build credits are listed; additional credits can be purchased."],
    ["Pro", "$200/month, billed annually", "750 monthly build credits are listed."],
  ];
  const teamsPrice = <div><dt className="font-semibold text-ink">Personal Teams access</dt><dd>Buy at least 25 personal Blue Credits to unlock Desktop Team mode. 25 credits cost ₹{activation.priceINR.toLocaleString("en-IN")} or ${activation.priceUSD.toFixed(2)}. The full purchase adds usable model credits to your wallet. Team mode uses Blue Models and draws from your available credits.</dd></div>;
  return <section aria-labelledby="price-comparison" className="mt-12 border-t border-line pt-10">
    <h2 id="price-comparison" className="text-3xl font-semibold tracking-tight text-ink">{product === "emergent" ? "Blue Teams: credits instead of a separate subscription." : "Compare the price and what it includes."}</h2>
    <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">{product === "emergent" ? "Activate Blue Teams with a qualifying credit purchase, then pay for actual model usage. Unused Blue Credits carry forward without a monthly reset. Compare that with Emergent's published plans and included build-credit allowances below." : "App access, model usage and included allowances are different things. These are published prices, not an estimate of what the same task will cost in each product. Regional pricing and taxes can vary."}</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-paper-alt p-6 sm:p-8"><h3 className="text-xl font-semibold text-ink">Blue Desktop</h3><dl className="mt-5 space-y-5 text-sm leading-7 text-ink-muted">
        {product === "emergent" && teamsPrice}
        <div><dt className="font-semibold text-ink">Blue Lite: free app access</dt><dd>Paid model use can still incur provider or Blue Credit charges.</dd></div>
        <div><dt className="font-semibold text-ink">Blue app subscription: ₹{monthly.priceInr} / ${monthly.priceUsd.toFixed(2)} for {monthly.days} days</dt><dd>Prepaid app-feature access, with no auto-renewal and <strong className="text-ink">0 Blue Credits included</strong>. BYOK usage is billed separately by your provider.</dd></div>
        <div><dt className="font-semibold text-ink">Blue Credits: ₹{BLUE_CREDIT_PRICE_INR} or ${BLUE_CREDIT_PRICE_USD.toFixed(2)} per credit</dt><dd>Pay-as-you-go model usage. One Blue Credit covers $1 of actual model usage through Blue&apos;s provider. Model choice, context and tool use affect consumption.</dd></div>
        {product === "codex" && teamsPrice}
      </dl><Link href="/pricing" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4">Check current Blue pricing</Link></div>
      <div className="rounded-xl border border-line p-6 sm:p-8"><h3 className="text-xl font-semibold text-ink">{name}</h3><dl className="mt-5 space-y-5 text-sm leading-7 text-ink-muted">{rows.map(([plan, price, note]) => <div key={plan}><dt className="font-semibold text-ink">{plan}: {price}</dt><dd>{note}</dd></div>)}</dl>
        <p className="mt-6 text-sm leading-7 text-ink-muted">{product === "codex" ? "OpenAI also documents API-key billing, which is separate from subscription allowances. Verify the method you intend to use." : "Emergent build credits and Blue Credits are different units. A larger credit count does not establish a lower cost for your project."}</p>
        <a href={sources} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4">Official {name} pricing source</a>
      </div>
    </div>
    <p className="mt-4 text-xs leading-6 text-ink-muted">Competitor prices checked on <time dateTime="2026-11-14">14 November 2026</time>. The INR and USD prices are separate checkout options, not a live currency conversion. Regional pricing and taxes can vary. Check official pricing again before purchasing.</p>
  </section>;
}
