"use client";

import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";

const faqs = [
  { q: "How are Blue Credits calculated?", a: "1 Blue Credit covers $1 of actual OpenRouter model usage. If a request costs $0.10 at OpenRouter, Blue deducts 0.10 Blue Credits. Input, output, reasoning, caching and model tool-use costs follow the selected model's actual usage." },
  { q: "When do I pay the platform fee?", a: "A 30% platform fee is added at checkout. Buying 25 Blue Credits costs $25.00 for credits plus a $7.50 platform fee, for a total of $32.50 USD. The fee does not add credits, and there is no additional platform markup when credits are used. INR prices are shown before payment." },
  { q: "How do Blue Credits unlock Teams?", a: "Purchase at least 25 Blue Credits in one payment to activate Teams. Teams uses Blue Models for the main agent and specialists. Access continues while your wallet has credits. When your balance reaches zero, Teams pauses; another purchase of at least 25 credits reactivates it. Your agents, tasks and conversations stay saved." },
  { q: "Can I top up before my credits run out?", a: "Yes. Buy any available pack while Teams is active and its credits are added to your remaining balance. For example, buy 25, use 10, then add 25: you have 40 credits and Teams stays active. No balance is replaced or reset." },
  { q: "Do my credits expire?", a: "No. Blue Credits do not expire and do not reset monthly. They remain in your wallet until used. They are service-usage units, not cash or stored monetary value." },
  { q: "Can I use my own OpenRouter key?", a: "Your OpenRouter connection remains available for ordinary project work. Blue Teams uses Blue Models and your Blue Credit wallet." },
];

export default function BlueProPage() {
  return <PageLayout>
    <section className="relative overflow-hidden py-20">
      <div className="max-w-5xl mx-auto px-6">
        <header className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-brand">Blue Credits · Pay as you go</p>
          <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight text-ink">Model usage at cost.<br /><span className="text-brand">One clear platform fee.</span></h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">1 Blue Credit covers $1 of actual OpenRouter usage. Add credits when you need them, with a 30% platform fee shown separately at checkout.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/blue-pro/checkout?pack=custom&credits=25" className="btn btn-primary min-h-11">Buy 25 Blue Credits</Link><Link href="/teams" className="btn btn-secondary min-h-11">Explore Blue Teams</Link></div>
        </header>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <article className="rounded-xl panel border border-line p-6"><h2 className="text-xl font-bold text-ink">25 credits</h2><p className="mt-3 text-ink-muted">$25.00 for model usage + $7.50 platform fee = <strong className="text-ink">$32.50 USD</strong>. INR payment totals appear at checkout.</p></article>
          <article className="rounded-xl panel border border-line p-6"><h2 className="text-xl font-bold text-ink">Teams included</h2><p className="mt-3 text-ink-muted">A purchase of at least 25 credits activates Teams while your wallet has credits. No separate Teams subscription.</p></article>
          <article className="rounded-xl panel border border-line p-6"><h2 className="text-xl font-bold text-ink">Your balance carries forward</h2><p className="mt-3 text-ink-muted">Top-ups add to your remaining credits. No expiry, monthly reset or automatic repeat charge.</p></article>
        </div>
        <section className="mt-16 max-w-3xl mx-auto" aria-labelledby="credit-usage-title">
          <h2 id="credit-usage-title" className="text-3xl font-bold text-ink">Pay for the usage your task needs.</h2>
          <p className="mt-4 leading-relaxed text-ink-muted">Different models and tasks use different amounts of credits. A short question may cost much less than a long task with reasoning, tools or multiple agents. Blue uses the actual cost reported by OpenRouter and shows your updated wallet balance.</p>
          <div className="mt-6 overflow-hidden rounded-xl border border-line"><table className="w-full text-sm text-left"><caption className="p-4 text-left font-semibold text-ink bg-paper-alt">Usage examples</caption><thead><tr className="border-y border-line text-ink"><th className="p-4" scope="col">Actual OpenRouter cost</th><th className="p-4" scope="col">Blue Credits used</th></tr></thead><tbody className="divide-y divide-line text-ink-muted"><tr><td className="p-4">$0.10</td><td className="p-4">0.10</td></tr><tr><td className="p-4">$1.00</td><td className="p-4">1.00</td></tr><tr><td className="p-4">$5.00</td><td className="p-4">5.00</td></tr></tbody></table></div>
        </section>
        <section className="mt-16 max-w-3xl mx-auto" aria-labelledby="credit-faq-title"><h2 id="credit-faq-title" className="text-3xl font-bold text-ink">Questions about Blue Credits</h2><div className="mt-7 divide-y divide-line">{faqs.map(faq => <details key={faq.q} className="py-5"><summary className="cursor-pointer font-semibold text-ink">{faq.q}</summary><p className="mt-3 text-sm leading-relaxed text-ink-muted">{faq.a}</p></details>)}</div></section>
        <p className="mt-12 text-center text-xs text-ink-faint">Purchases follow our <Link href="/terms" className="underline">Terms</Link> and <Link href="/refund" className="underline">Refund Policy</Link>.</p>
      </div>
    </section>
  </PageLayout>;
}
