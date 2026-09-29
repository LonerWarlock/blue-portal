"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Quote, Star } from "lucide-react";
import Stack from "./react-bits/Stack";
import { MARKETPLACE_REVIEW_URL, marketplaceTestimonials, type MarketplaceTestimonial } from "@/lib/marketplaceTestimonials";
import styles from "./Testimonials.module.css";

function ReviewCard({ review }: { review: MarketplaceTestimonial }) {
  const initials = review.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <article className={styles.review} data-review-id={review.id}>
      <div className={styles.cardTop}>
        <span className={styles.stars} role="img" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }, (_, i) => <Star key={i} size={16} fill="currentColor" aria-hidden="true" />)}</span>
        <Quote size={27} className={styles.quoteIcon} aria-hidden="true" />
      </div>
      <blockquote className={styles.quote}>&ldquo;{review.quote}&rdquo;</blockquote>
      <div className={styles.author}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div><p>{review.name}</p><time dateTime={review.dateISO}>{review.date}</time></div>
        {review.excerpt && <span className={styles.excerpt}>Review excerpt</span>}
      </div>
    </article>
  );
}

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reviews = marketplaceTestimonials;
  const cards = useMemo(() => reviews.map(review => <ReviewCard key={review.id} review={review} />), [reviews]);
  const average = (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1);
  const current = reviews[activeIndex];
  const change = (delta: number) => setActiveIndex(index => (index + delta + reviews.length) % reviews.length);

  return (
    <section id="testimonials" className={styles.section} aria-labelledby="testimonials-heading">
      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <span className="eyebrow">// testimonials</span>
            <h2 id="testimonials-heading">What Blue users are saying.</h2>
            <p className={styles.description}>Real feedback from developers on the Visual Studio Marketplace.</p>
            <div className={styles.summary}>
              <strong>{average}<span> / 5</span></strong>
              <div><span className={styles.stars} aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill="currentColor" />)}</span><p>{reviews.length} public Marketplace reviews</p></div>
            </div>
            <a className={styles.source} href={MARKETPLACE_REVIEW_URL} target="_blank" rel="noopener noreferrer">Read the original reviews <ExternalLink size={14} aria-hidden="true" /></a>
            <p className={styles.checked}>Checked September 29, 2026. Longer reviews are shown as excerpts.</p>
          </div>

          <div className={styles.carousel}>
            <div className={styles.stackFrame}>
              <Stack cards={cards} activeIndex={activeIndex} onActiveIndexChange={setActiveIndex} randomRotation sensitivity={180} sendToBackOnClick mobileClickOnly autoplay={false} animationConfig={{ stiffness: 260, damping: 20 }} ariaLabel="Blue Marketplace reviews" describedBy="reviews-instructions" />
            </div>
            <p id="reviews-instructions" className={styles.instructions}>Click a card or use the arrows to read the next review.<span className={styles.desktopHint}> You can drag, too.</span><span className="sr-only">When the stack has focus, use left and right arrow keys.</span></p>
            <div className={styles.controls}>
              <button type="button" className={styles.arrow} onClick={() => change(-1)} aria-label="Previous review"><ArrowLeft size={18} aria-hidden="true" /></button>
              <div className={styles.dots} aria-label="Choose a review">{reviews.map((review, index) => <button type="button" key={review.id} aria-label={`Show review by ${review.name}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => setActiveIndex(index)}><span /></button>)}</div>
              <button type="button" className={styles.arrow} onClick={() => change(1)} aria-label="Next review"><ArrowRight size={18} aria-hidden="true" /></button>
            </div>
            <p className={styles.position} aria-live="polite" aria-atomic="true">{activeIndex + 1} / {reviews.length} <span>— {current.name}</span></p>
          </div>
        </div>
        <details className={styles.allReviews}>
          <summary>Read all {reviews.length} reviews</summary>
          <div className={styles.reviewList}>{reviews.map(review => <ReviewCard key={review.id} review={review} />)}</div>
        </details>
      </div>
    </section>
  );
}
