const testimonials = [
  {
    quote: "Best in the era where coding agents are not affordable. its affordable, powerful and easy to use.",
    name: "Om Karande",
    date: "August 6, 2026",
    rating: 5,
  },
  {
    quote: "A very nice and affordable alternative to all the AI agents out there. Very nice product for students and startup developers.",
    name: "Soham Phatak",
    date: "July 20, 2026",
    rating: 5,
  },
  {
    quote: "In the era of claude and codex, i prefer blue. It is cheap and very powerful. Worth using.",
    name: "Om Mali",
    date: "July 17, 2026",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-paper-alt border-y border-line">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="eyebrow">// testimonials</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-ink">
            What Blue users are saying.
          </h2>
          <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
            Feedback from developers using Blue for affordable, agent-powered coding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="panel bg-paper p-6 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="mb-4 flex items-center gap-2" aria-label={`${t.rating} out of 5 stars`}>
                  <span className="text-sm tracking-[0.18em] text-amber-500" aria-hidden="true">
                    {"★".repeat(t.rating)}
                  </span>
                  <span className="text-xs text-ink-muted">{t.rating}.0</span>
                </div>
                <p className="text-sm text-ink leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line">
                <p className="text-sm font-semibold text-ink">{t.name}</p>
                <p className="text-xs text-ink-muted">{t.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
