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
    <section id="testimonials" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Trusted by world-class builders.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Teams that build world-class software rely on Blue to accelerate their development.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 rounded-2xl glass border border-gray-800/80 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center gap-1 text-amber-400/80 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <i key={j} className="fa-solid fa-star text-xs"></i>
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-800/50">
                <p className="text-sm font-semibold text-gray-100">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
