import { permanentRedirect } from "next/navigation";

// Keep old links and emailed checkout links working while /pricing is the
// single canonical page for Blue plans.
export default function SubscribeRedirect() {
  permanentRedirect("/pricing");
}
