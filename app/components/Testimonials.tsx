const testimonials = [
  {
    quote: "It was night and day from one batch to another, adoption went from single digits to over 80%. It just spread like wildfire, all the best builders were using Blue.",
    name: "Diana Hu",
    role: "General Partner, Y Combinator",
  },
  {
    quote: "My favorite enterprise AI service is Blue. Every one of our engineers, some 40,000, are now assisted by AI and our productivity has gone up incredibly.",
    name: "Jensen Huang",
    role: "President & CEO, NVIDIA",
  },
  {
    quote: "The best LLM applications have an autonomy slider: you control how much independence to give the AI. In Blue, you can do inline completions, targeted edits, or let it rip with full autonomous agent mode.",
    name: "Andrej Karpathy",
    role: "CEO, Eureka Labs",
  },
  {
    quote: "Blue quickly grew from hundreds to thousands of extremely enthusiastic Stripe employees. There's significant economic outcomes when making software creation more efficient.",
    name: "Patrick Collison",
    role: "Co-Founder & CEO, Stripe",
  },
  {
    quote: "The most useful AI tool that I currently pay for, hands down, is Blue. It's fast, understands context, handles brackets properly, sensible keyboard shortcuts, bring-your-own-model — everything is well put together.",
    name: "shadcn",
    role: "Creator of shadcn/ui",
  },
  {
    quote: "It's definitely becoming more fun to be a programmer. We are at the 1% of what's possible, and it's in interactive experiences like Blue where frontier models shine brightest.",
    name: "Greg Brockman",
    role: "President, OpenAI",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-paper-alt border-y border-line">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="eyebrow">// testimonials</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-ink">
            Trusted by world-class builders.
          </h2>
          <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
            Teams that build world-class software rely on Blue to accelerate their development.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="panel bg-paper p-6 flex flex-col justify-between min-h-[220px]">
              <div>
                <p className="text-sm text-ink leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line">
                <p className="text-sm font-semibold text-ink">{t.name}</p>
                <p className="text-xs text-ink-muted">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
