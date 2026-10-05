import { createPageMetadata } from "@/lib/seo";
import PricingClient from "./PricingClient";

export const metadata = createPageMetadata("/pricing", "Blue Pricing | AI Coding Assistant Plans for Students", "Start with free Blue Lite or choose Blue from ₹149 for 30 days, quarterly and yearly plans. Compare BYOK, integrations and Blue Pro model credits.");

export default function PricingPage() {
  return <PricingClient />;
}
