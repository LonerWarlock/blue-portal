import { createPageMetadata } from "@/lib/seo";
import PricingClient from "./PricingClient";

export const metadata = createPageMetadata("/pricing", "Blue by Imergene Pricing | Subscription Access and Model Usage", "Blue Lite is free. Blue subscriptions start at ₹149 for 30 days, with quarterly and yearly options. BYOK provider charges are separate; Blue Pro uses Blue Credits.");

export default function PricingPage() {
  return <PricingClient />;
}
