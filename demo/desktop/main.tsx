import React from "react";
import { createRoot } from "react-dom/client";
import App from "blue-desktop-renderer";
import "blue-desktop-styles";
import "./responsive.css";

// The build injects the isolated bridge before the original App is evaluated.
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

function openModelPicker() {
  if (!document.querySelector(".model-popover")) (document.querySelector(".model-button") as HTMLButtonElement | null)?.click();
}
// A single, harmless presentation command from the owning website. No text,
// credentials, file paths or executable instructions are accepted here.
window.addEventListener("message", event => {
  if (event.source !== window.parent || event.data?.type !== "blue-demo-view") return;
  if (event.data.view === "models") openModelPicker();
  if (event.data.view === "workspace") (document.querySelector('.model-search button') as HTMLButtonElement | null)?.click();
});
if (document.documentElement.dataset.previewView === "models") setTimeout(openModelPicker, 200);

function notice(text: string) {
  const status = document.getElementById("demo-notice");
  if (status) status.textContent = text;
}
document.addEventListener("click", event => {
  const button = (event.target as Element | null)?.closest("button");
  if (button && /^(attach file|setup wizard|set up models)$/i.test(button.textContent?.trim() || "")) {
    event.preventDefault(); event.stopImmediatePropagation();
    notice("Preview only. Attachments, API keys and account setup are disabled.");
  }
}, true);
document.addEventListener("click", event => {
  const button = (event.target as Element | null)?.closest("button");
  if (matchMedia("(max-width: 767px)").matches && button?.closest(".sidebar") && button.matches(".chat-link, .project-button, .primary-nav button, .recent-list button")) {
    requestAnimationFrame(() => (document.querySelector('button[aria-label="Toggle sidebar"]') as HTMLButtonElement | null)?.click());
  }
});
document.addEventListener("paste", event => {
  if (event.clipboardData?.files.length) {
    event.preventDefault(); event.stopImmediatePropagation();
    notice("Preview only. File and image attachments are not read.");
  }
}, true);
