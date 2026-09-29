// Public Marketplace snapshot checked 2026-09-29. No runtime review/API call.
// Short verbatim excerpts only; use the source link for complete reviews.
export const MARKETPLACE_REVIEW_URL = "https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant&ssr=false#review-details";
export const MARKETPLACE_REVIEW_API = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/om-mali/extensions/blue-coding-assistant/reviews?count=100";
export const MARKETPLACE_REVIEW_CHECKED_ON = "2026-09-29";

export const marketplaceTestimonials = [
  { id: 343212, name: "Shivani Patil", date: "September 10, 2026", dateISO: "2026-09-10", rating: 5, excerpt: true, quote: "Blue AI Coding Assistant is a very helpful and easy-to-use tool for coding." },
  { id: 343210, name: "Vaishnavi Chavare", date: "September 10, 2026", dateISO: "2026-09-10", rating: 5, excerpt: true, quote: "Blue AI Coding Assistant is a very helpful and easy-to-use tool. It makes coding, debugging, and understanding programs much easier." },
  { id: 343209, name: "sanika Chabuk", date: "September 10, 2026", dateISO: "2026-09-10", rating: 5, excerpt: true, quote: "It provides helpful suggestions, saves time, and makes coding easier and more efficient." },
  { id: 343208, name: "Shruti Chougule", date: "September 10, 2026", dateISO: "2026-09-10", rating: 5, excerpt: false, quote: "It is very useful and integrates perfectly into my daily workflow." },
  { id: 343182, name: "deepakpatilt8123", date: "September 10, 2026", dateISO: "2026-09-10", rating: 5, excerpt: false, quote: "I am a student, and i have to say..\nthis coding agent is worth using." },
  { id: 337847, name: "Om Karande", date: "August 6, 2026", dateISO: "2026-08-06", rating: 5, excerpt: false, quote: "Best in the era where coding agents are not affordable. its affordable, powerful and easy to use." },
  { id: 340114, name: "Soham Phatak", date: "July 20, 2026", dateISO: "2026-07-20", rating: 5, excerpt: false, quote: "A very nice and affordable alternative to all the AI agents out there. Very nice product for students and startup developers." },
  { id: 339963, name: "Om Mali", date: "July 17, 2026", dateISO: "2026-07-17", rating: 5, excerpt: false, quote: "In the era of claude and codex, i prefer blue. It is cheap and very powerful. Worth using." },
] as const;
export type MarketplaceTestimonial = (typeof marketplaceTestimonials)[number];
