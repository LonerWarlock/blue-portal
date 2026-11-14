import { createPageMetadata } from "@/lib/seo";
import PricingClient from "./PricingClient";

export const metadata = createPageMetadata("/pricing", "Blue Pricing: Plans & Pay-As-You-Go Credits | Imergene", "Compare Blue app plans and pay-as-you-go Blue Credits. Subscriptions start at ₹149 for 30 days with no Blue Credits included. Provider usage is separate.");

export default function PricingPage() {
  return <PricingClient />;
}
