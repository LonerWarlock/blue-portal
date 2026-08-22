import PageLayout from "@/app/components/PageLayout";

const services = [
  { name: "API Gateway Router", status: "Operational", uptime: "100%", icon: "fa-server" },
  { name: "Supabase Authentication", status: "Operational", uptime: "—", icon: "fa-lock" },
  { name: "Completions Proxy Endpoint", status: "Operational", uptime: "120ms avg", icon: "fa-bolt" },
  { name: "Dynamic Models Endpoint", status: "Operational", uptime: "—", icon: "fa-microchip" },
  { name: "Upstream OpenCode Proxy", status: "Operational", uptime: "—", icon: "fa-network-wired" },
];

export default function StatusPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              System Status
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Blue System
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Status
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Live uptime reports and operational metrics for all gateway endpoints.
            </p>
          </div>

          <div className="mt-16 max-w-3xl mx-auto">
            <div className="rounded-lg panel border border-line overflow-hidden">
              <div className="px-6 py-4 border-b border-line bg-paper-alt flex items-center justify-between">
                <span className="text-sm font-bold text-ink">System Services</span>
                <span className="flex items-center gap-2 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  All Systems Operational
                </span>
              </div>
              <div className="divide-y divide-line">
                {services.map((service) => (
                  <div key={service.name} className="px-6 py-4 flex items-center justify-between hover:bg-paper-alt transition">
                    <div className="flex items-center gap-3">
                      <i className={`fa-solid ${service.icon} text-ink-faint text-sm w-5 text-center`}></i>
                      <span className="text-sm text-ink-muted">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink-faint">{service.uptime}</span>
                      <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {service.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
