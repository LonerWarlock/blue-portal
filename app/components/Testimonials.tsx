const testimonials = [
  {
    quote: "Best in the era where coding agents are not affordable. Its affordable, powerful and easy to use.",
    name: "Om Karande",
    role: "AI & DS Engineering Student",
  },
  {
    quote: "A very nice and affordable alternative to all the AI agents out there. Very nice product for students and startup developers.",
    name: "Soham Phatak",
    role: "ZS Associates · PICT Alumni",
  },
  {
    quote: "In the era of Claude and Codex, I prefer Blue. It is cheap and very powerful. Worth using.",
    name: "Om Mali",
    role: "CSE Engineering Student",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            What developers are saying.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Real reviews from the VS Code Marketplace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 rounded-2xl glass border border-gray-800/80 flex flex-col justify-between min-h-[200px]">
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
