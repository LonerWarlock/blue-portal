import PageLayout from "@/app/components/PageLayout";
import PageBackground3D from "@/app/components/PageBackground3D";

export default function RefundPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>
        <PageBackground3D theme="refund" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Refunds &amp; Cancellations
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Cancellation &amp;
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Refund Policy
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Understand our guidelines for digital payments, subscription cancellations, and refund processes.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <div className="rounded-lg panel border border-line p-8 md:p-12 space-y-10 bg-paper/40">
              
              <div>
                <h2 className="text-xl font-bold text-ink mb-4">Overview</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  This refund and cancellation policy outlines the terms and guidelines for purchasing digital products, credits, and subscription plans through the Platform (<a href="https://blue-by-imergene.vercel.app" className="text-brand hover:underline">https://blue-by-imergene.vercel.app</a>). Since our Services consist of digital access, API tokens, and cloud completions, all purchases are subject to the policies defined below.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">1. Prepaid Wallet Top-ups</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Blue AI operates on a pay-as-you-go prepaid wallet system. All credit refills, prepaid balances, and token top-ups are added to your account instantly upon transaction approval.
                  <br /><br />
                  Because these credits are made available for immediate consumption on upstream LLM routes, <strong>all wallet top-ups are final, non-refundable, non-transferable, and cannot be exchanged for cash or cash equivalents</strong>.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">2. Token Consumption &amp; Queries</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Credits are deducted from your balance in real-time as your queries consume model input and output tokens. Once a completion request or agent loop is initiated and processed, the corresponding token charges are non-refundable. We do not provide credits or refunds for completed executions or code generation tasks.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">3. Subscription Cancellation</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  If you are subscribed to a recurring monthly or annual plan, you can cancel your subscription at any time through your dashboard:
                </p>
                <ul className="list-disc pl-5 mt-3 text-sm text-ink-muted space-y-2">
                  <li className="leading-relaxed">
                    <strong>Effect of Cancellation:</strong> Cancellation will prevent the subscription from renewing at the end of the current billing cycle. 
                  </li>
                  <li className="leading-relaxed">
                    <strong>Access Period:</strong> You will retain access to your plan benefits and credits until the end of your current active billing cycle.
                  </li>
                  <li className="leading-relaxed">
                    <strong>No Pro-rata Refunds:</strong> We do not offer partial or pro-rated refunds for unused portions of an active billing cycle.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">4. Billing Discrepancies &amp; System Errors</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  In rare cases of transaction failures or system-level issues:
                </p>
                <ul className="list-disc pl-5 mt-3 text-sm text-ink-muted space-y-2">
                  <li className="leading-relaxed">
                    <strong>Charge without Credits:</strong> If your card or payment account is charged but your prepaid wallet fails to reflect the credited amount, please report the issue to our team with your transaction details.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Double Charging:</strong> If you are accidentally charged twice for a single transaction, the extra payment will be refunded.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Resolution Timeline:</strong> Verified billing issues and approved refunds will be processed and credited back to your original payment method within <strong>5 to 7 business days</strong>.
                  </li>
                </ul>
              </div>

              <div className="pt-8 border-t border-line">
                <h2 className="text-xl font-bold text-ink mb-6">Contact &amp; Grievance Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-ink-muted">
                  <div>
                    <span className="block font-semibold text-ink-muted">Grievance Officer (1):</span>
                    <span className="text-ink">Om Karande</span>
                    <span className="block text-xs text-ink-faint">Co-founder and CEO</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink-muted">Grievance Officer (2):</span>
                    <span className="text-ink">Soham Phatak</span>
                    <span className="block text-xs text-ink-faint">Co-founder and CTO</span>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <span className="block font-semibold text-ink-muted">Company Name &amp; Address:</span>
                    <span>IMERGENE, Samruddhi Nagar, Punyashri Nagri, Kupwad Road, Miraj, Sangli, Maharashtra – 416416, India</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink-muted">Email:</span>
                    <a href="mailto:team.imergene@gmail.com" className="text-brand hover:underline">team.imergene@gmail.com</a>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink-muted">Availability:</span>
                    <span>Monday - Friday, 09:00 - 18:00 IST</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
