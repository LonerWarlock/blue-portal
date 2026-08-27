// The Pricing nav item must open the Pricing page itself (not navigate to
// /subscribe). It reuses the existing Subscribe page's plans/content so the
// two routes stay visually and functionally identical while remaining
// distinct pages — "Pricing" no longer redirects to "Subscription".
import SubscribePage from "@/app/subscribe/page";

export default function PricingPage() {
  return <SubscribePage />;
}
