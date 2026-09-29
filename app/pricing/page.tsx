import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Blue Pricing and Plans",
  description: "Compare Blue Lite, Blue, and Blue Pro plans. Choose OpenRouter BYOK or Blue Credits for the models you use.",
};

export default function PricingPage() {
  return <PricingClient />;
}
