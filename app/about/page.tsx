import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import { BLUE_SUBSCRIPTION_PLANS } from "@/lib/blueSubscriptionPlans";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata(
  "/about",
  "About Blue by Imergene | Official Product and Billing Facts",
  "Blue is developed, owned, and operated by Imergene. Learn about Blue Desktop, the VS Code extension, prepaid app subscriptions, BYOK, and Blue Pro model credits.",
);

const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";
const copy = "mt-4 text-base leading-8 text-ink-muted";

export default function AboutBluePage() {
  const { monthly, quarterly, yearly } = BLUE_SUBSCRIPTION_PLANS;
  return <PageLayout>
    <article className="site-container max-w-4xl pb-24 pt-14 sm:pt-20" aria-labelledby="about-blue-title">
      <header>
        <p className="eyebrow text-brand">The official Blue product</p>
        <h1 id="about-blue-title" className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Blue, by Imergene.</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">Blue is an AI coding assistant developed, owned, and operated by Imergene. Made specifically for students, it is available as Blue Desktop for Windows and the Blue Coding Assistant extension for VS Code.</p>
      </header>

      <section id="identity" className="mt-12 scroll-mt-28 border-t border-line pt-8" aria-labelledby="identity-title">
        <h2 id="identity-title" className="text-2xl font-semibold tracking-tight text-ink">Who makes Blue?</h2>
        <p className={copy}>Imergene is the company behind Blue. Our name remains Imergene; it has not been renamed to Emergent AI. Blue by Imergene is not an Emergent AI product.</p>
        <p className={copy}>The official website is <a href="https://blue-by-imergene.vercel.app/" className={link}>blue-by-imergene.vercel.app</a>. Our Windows app is listed on <a href="https://apps.microsoft.com/detail/9NHV6GFJ64C8" target="_blank" rel="noopener noreferrer" className={link}>Microsoft Store</a>, and our extension is listed as <a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer" className={link}>Blue Coding Assistant on Visual Studio Marketplace</a>.</p>
      </section>

      <section id="billing" className="mt-12 scroll-mt-28 border-t border-line pt-8" aria-labelledby="billing-title">
        <h2 id="billing-title" className="text-2xl font-semibold tracking-tight text-ink">How Blue&apos;s billing works</h2>
        <p className={copy}>App-feature access and AI model usage are separate. Not every Blue user needs Blue Credits, and the subscription does not charge a fixed number of credits for each edit, test, or deployment.</p>
        <dl className="mt-6 space-y-6 text-base leading-8">
          <div><dt className="font-semibold text-ink">Blue Lite</dt><dd className="mt-1 text-ink-muted">Free access to the entry-level app features. A paid model provider may still charge for its model usage.</dd></div>
          <div><dt className="font-semibold text-ink">Blue subscription</dt><dd className="mt-1 text-ink-muted">Prepaid access to additional app features: ₹{monthly.priceInr} for {monthly.days} days, ₹{quarterly.priceInr} for {quarterly.days} days, or ₹{yearly.priceInr.toLocaleString("en-IN")} for {yearly.days} days. No auto-renewal. These plans do not include Blue Pro model credits.</dd></div>
          <div><dt className="font-semibold text-ink">Bring your own key (BYOK)</dt><dd className="mt-1 text-ink-muted">Connect a supported model provider with your own key. Model usage is billed by that provider where applicable, not deducted from Blue Credits. Free provider models can have rate limits.</dd></div>
          <div><dt className="font-semibold text-ink">Blue Pro / Blue Credits</dt><dd className="mt-1 text-ink-muted">Use Blue Credits to pay for model usage through Blue Pro. Usage depends on the selected model and the model calls made; a model conversation about a bug, test, or deployment can incur usage charges. Running a local command is not itself a separately priced Blue Credit action.</dd></div>
        </dl>
        <p className={copy}>See the <Link href="/pricing" className={link}>current plans and eligible features</Link> or <Link href="/docs#models" className={link}>model-connection documentation</Link>. For questions about Blue, <Link href="/contact" className={link}>contact the Imergene team</Link>.</p>
      </section>

      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-8">
        <DesktopDownloadLink className={link}>Download Blue Desktop for Windows</DesktopDownloadLink>
        <Link href="/docs" className={link}>Read the setup guide</Link>
      </div>
    </article>
  </PageLayout>;
}
