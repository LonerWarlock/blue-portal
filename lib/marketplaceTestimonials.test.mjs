import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { marketplaceTestimonials as reviews, MARKETPLACE_REVIEW_URL, MARKETPLACE_REVIEW_API, MARKETPLACE_REVIEW_CHECKED_ON } from './marketplaceTestimonials.ts';

test('the snapshot contains all eight real Marketplace reviews without duplicates', () => {
  assert.deepEqual(reviews.map(review => [review.id, review.name]), [
    [343212, 'Shivani Patil'], [343210, 'Vaishnavi Chavare'],
    [343209, 'sanika Chabuk'], [343208, 'Shruti Chougule'],
    [343182, 'deepakpatilt8123'], [337847, 'Om Karande'],
    [340114, 'Soham Phatak'], [339963, 'Om Mali'],
  ]);
  assert.equal(new Set(reviews.map(review => review.id)).size, 8);
  assert.ok(reviews.every(review => review.rating === 5));
  assert.equal(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length, 5);
});

test('dates match the public snapshot and long reviews are clearly excerpts', () => {
  assert.deepEqual(reviews.map(review => review.dateISO), [
    '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-10',
    '2026-08-06', '2026-07-20', '2026-07-17',
  ]);
  assert.deepEqual(reviews.filter(review => review.excerpt).map(review => review.id), [343212, 343210, 343209]);
  for (const review of reviews) {
    assert.ok(review.quote.trim());
    assert.ok(review.quote.trim().split(/\s+/).length <= 25, 'Keep quotations short and source-linked');
    assert.equal('role' in review, false, 'No invented reviewer role');
    assert.equal('company' in review, false, 'No invented company');
    assert.equal('verifiedPurchase' in review, false, 'No unsupported verification badge');
  }
});

test('both source links belong to the correct public extension', () => {
  const source = new URL(MARKETPLACE_REVIEW_URL);
  assert.equal(source.hostname, 'marketplace.visualstudio.com');
  assert.equal(source.searchParams.get('itemName'), 'om-mali.blue-coding-assistant');
  assert.equal(source.hash, '#review-details');
  assert.match(MARKETPLACE_REVIEW_API, /\/_apis\/public\/gallery\/publishers\/om-mali\/extensions\/blue-coding-assistant\/reviews/);
  assert.equal(MARKETPLACE_REVIEW_CHECKED_ON, '2026-09-29');
});

test('Stack preserves the supplied animation instead of adding a custom flip', async () => {
  const stack = await readFile(new URL('../app/components/react-bits/Stack.jsx', import.meta.url), 'utf8');
  const usage = await readFile(new URL('../app/components/Testimonials.tsx', import.meta.url), 'utf8');
  assert.match(stack, /\(stack\.length - index - 1\) \* 4 \+ randomRotate/);
  assert.match(stack, /1 \+ index \* 0\.06 - stack\.length \* 0\.06/);
  assert.match(stack, /transformOrigin: '90% 90%'/);
  assert.match(stack, /stiffness: 260, damping: 20/);
  assert.match(stack, /\[-100, 100\], \[60, -60\]/);
  assert.match(stack, /\[-100, 100\], \[-60, 60\]/);
  assert.match(stack, /dragElastic=\{0\.6\}/);
  assert.match(usage, /randomRotation sensitivity=\{180\}/);
  assert.match(usage, /animationConfig=\{\{ stiffness: 260, damping: 20 \}\}/);
  assert.doesNotMatch(stack, /AnimatePresence|ReviewSlide|rotateY: 65|exit=/);
});
