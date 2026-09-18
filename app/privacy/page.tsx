import PageLayout from "@/app/components/PageLayout";
import PageBackground3D from "@/app/components/PageBackground3D";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>
        <PageBackground3D theme="privacy" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Privacy & DPDP Compliance
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Privacy
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Policy
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Transparent policy regarding how we collect, process, protect, and handle your data under India&apos;s Digital Personal Data Protection (DPDP) Act, 2023.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <div className="rounded-lg panel border border-line p-8 md:p-12 space-y-10 bg-paper/40">
              
              <div>
                <h2 className="text-xl font-bold text-ink mb-4">1. Introduction & DPDP Act Compliance</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  This Privacy Policy describes how IMERGENE (doing business as &quot;Blue By Imergene&quot;, &quot;Blue Portal&quot;) and its corporate entities (collectively &quot;IMERGENE&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;) act as a <strong>Data Fiduciary</strong> in collecting, processing, storing, and protecting your personal data when you access our Platform at <a href="https://blue-by-imergene.vercel.app" className="text-brand hover:underline">https://blue-by-imergene.vercel.app</a>. We strictly comply with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> of India, the Information Technology Act, 2000, and rules framed thereunder.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">2. Notice & Consent at Point of Collection</h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-3">
                  Before or at the time of collecting your personal data (e.g. hackathon registrations, internship applications, contact queries, or account creation), we provide a clear, itemized notice specifying:
                </p>
                <ul className="list-disc list-inside text-sm text-ink-muted space-y-1.5 ml-2">
                  <li>The precise categories of personal data being collected (name, email, phone number, academic records, payment details).</li>
                  <li>The specific specified purpose for which the data will be processed.</li>
                  <li>The manner in which you may exercise your rights as a Data Principal or withdraw your consent.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">3. Data Processors & Third-Party Services</h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-3">
                  We process data directly or engage contractually bound Data Processors who handle data strictly under our instructions and maintaining reasonable security standards. Third parties include:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-muted">
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <span className="font-bold text-ink block">Payment Gateways</span>
                    PayU India, Cashfree Payments (Payment processing & billing)
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <span className="font-bold text-ink block">Database & Hosting</span>
                    Supabase Inc., Vercel Inc. (Encrypted cloud infrastructure)
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <span className="font-bold text-ink block">Analytics & Pixel (Opt-in only)</span>
                    PostHog Inc., Meta Platforms (Web analytics conditionally activated upon consent)
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <span className="font-bold text-ink block">Communication</span>
                    WhatsApp Business API / Meta, Email gateways (Event & transaction alerts)
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">4. Protection of Children & Minors</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  In accordance with Section 9 of the DPDP Act 2023, we do not knowingly collect or process personal data of individuals under the age of 18 without obtaining verifiable consent from their parent or lawful guardian. If you are under 18 years of age, you must have a parent or guardian review and approve your registration before submitting any personal data on this Platform.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">5. Rights of Data Principals</h2>
                <p className="text-sm text-ink-muted leading-relaxed mb-3">
                  As a Data Principal under the DPDP Act 2023, you have the following rights:
                </p>
                <div className="space-y-3 text-xs text-ink-muted">
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <strong className="text-ink">Right to Access Information:</strong> Request a summary of personal data being processed and identities of Data Processors with whom data was shared.
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <strong className="text-ink">Right to Correction & Erasure:</strong> Request correction, updating, or deletion of inaccurate, incomplete, or unnecessary personal data.
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <strong className="text-ink">Right to Withdraw Consent:</strong> Easily withdraw consent at any time. Withdrawal does not affect lawful processing conducted prior to withdrawal.
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <strong className="text-ink">Right to Grievance Redressal:</strong> Seek resolution of complaints through our designated Grievance Officer and subsequently through the Data Protection Board of India.
                  </div>
                  <div className="p-3 rounded-lg bg-paper-alt border border-line">
                    <strong className="text-ink">Right to Nominate:</strong> Nominate an individual who shall exercise your data principal rights in event of death or incapacity.
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">6. Data Retention & Erasure</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  We retain personal data only for as long as necessary to satisfy the purpose for which it was collected, or to comply with statutory legal, accounting, and audit requirements under Indian law. When data is no longer required or upon valid consent withdrawal/erasure request, personal data is permanently deleted or anonymized.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-4">7. Security & Confidentiality</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  We implement robust technical and organizational security measures, including SSL/TLS encryption, secure database access tokens, and access controls to prevent personal data breaches, loss, or unauthorized access.
                </p>
              </div>

              <div className="pt-8 border-t border-line">
                <h2 className="text-xl font-bold text-ink mb-6">8. Data Protection Officer & Grievance Contact</h2>
                <p className="text-xs text-ink-muted mb-4">
                  For exercising your Data Principal rights, filing grievances, or submitting data deletion requests, please contact our designated Grievance Officers:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-ink-muted">
                  <div className="p-4 rounded-lg bg-paper-alt border border-line">
                    <span className="block font-semibold text-ink">Grievance Officer (1):</span>
                    <span className="text-brand font-medium">Om Karande</span>
                    <span className="block text-xs text-ink-faint">Co-founder & CEO</span>
                  </div>
                  <div className="p-4 rounded-lg bg-paper-alt border border-line">
                    <span className="block font-semibold text-ink">Grievance Officer (2):</span>
                    <span className="text-brand font-medium">Soham Phatak</span>
                    <span className="block text-xs text-ink-faint">Co-founder & CTO</span>
                  </div>
                  <div className="col-span-1 md:col-span-2 p-4 rounded-lg bg-paper-alt border border-line">
                    <span className="block font-semibold text-ink">Registered Office:</span>
                    <span>IMERGENE, Samruddhi Nagar, Punyashri Nagri, Kupwad Road, Miraj, Sangli, Maharashtra – 416416, India</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink">Grievance Email:</span>
                    <a href="mailto:team.imergene@gmail.com" className="text-brand hover:underline">team.imergene@gmail.com</a>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink">Response SLA:</span>
                    <span>Acknowledged within 24 hours, resolved within 7 business days.</span>
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
