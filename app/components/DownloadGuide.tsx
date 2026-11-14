import Link from "next/link";
import { ArrowRight, Download, Monitor, Terminal } from "lucide-react";
import PageLayout from "./PageLayout";
import DesktopDownloadLink from "./DesktopDownloadLink";
import JsonLd from "./JsonLd";
import { canonicalUrl } from "@/lib/seo";

const copy = {
  en: {
    title: "Download and install Blue Desktop for Windows",
    intro: "Get Blue Desktop by Imergene from Microsoft, sign in, and choose a model connection. This guide takes you from the download to a first task in your own project.",
    language: "हिन्दी में पढ़ें", alternate: "/hi/download", download: "Download Blue for Windows", store: "Open Microsoft Store",
    requirements: "You need a Windows computer, an internet connection and a model connection. Blue Desktop is currently available for Windows. The VS Code extension is a separate installation.",
    stepsTitle: "From download to your first task",
    steps: [
      ["Download from Microsoft", "Use the download button above. It opens Microsoft's official installer or Store listing, depending on your browser and device. Follow Microsoft's installation prompts; you do not need to download Blue from an unofficial file-sharing site."],
      ["Open Blue and sign in", "Launch Blue Desktop from the Windows Start menu. Sign in to your Blue account and enter the email code when prompted."],
      ["Choose how to connect a model", "Complete Setup Wizard and select an available model. Blue Models uses Blue Credits; OpenRouter BYOK uses your own provider key and its billing. Enter a provider key only in Setup Wizard, never in a chat message."],
      ["Start with a small task", "Use New chat for a question, or add a local project folder for coding work. Try: “Explain what this project does. Do not change any files yet.” Review the answer and tool activity before asking for changes."],
    ],
    teamsTitle: "Want an AI team?",
    teams: "Open Team in Blue Desktop when you need specialist agents. A qualifying purchase of at least 25 Blue Credits activates Teams while your wallet has credits. Teams uses Blue Models; it is not included in the VS Code extension. Keep Blue open and your computer awake and online while work runs.",
    extensionTitle: "Looking for the Blue VS Code extension?",
    extension: "Install Blue Coding Assistant from the official Visual Studio Marketplace, open its sidebar and follow Setup Wizard. A VSIX extension package is not the Windows desktop installer.",
    extensionLink: "Open Blue on Visual Studio Marketplace",
    helpTitle: "If the download or setup does not work",
    help: ["If the download does not start, open the Microsoft Store listing and follow the install option shown for your device.", "After an app update, restart Blue before retrying. Check the model connection and internet access if your first task cannot start.", "Keep Windows security protections on. If setup reports a problem, contact Imergene with the error text and your Windows version; never share API keys or sign-in codes."],
    next: "Continue with Blue", docs: "Read the setup docs", pricing: "Understand Blue pricing", teamsLink: "Explore Team mode", contact: "Get setup help",
  },
  hi: {
    title: "Blue Desktop डाउनलोड और इंस्टॉल कैसे करें?",
    intro: "Imergene का Blue Desktop Microsoft से डाउनलोड करें, साइन इन करें और मॉडल कनेक्ट करें। इस गाइड में डाउनलोड से लेकर अपने प्रोजेक्ट में पहला काम शुरू करने तक के आसान कदम हैं।",
    language: "Read in English", alternate: "/download", download: "Windows के लिए Blue डाउनलोड करें", store: "Microsoft Store खोलें",
    requirements: "इसके लिए Windows कंप्यूटर, इंटरनेट और मॉडल कनेक्शन चाहिए। Blue Desktop अभी Windows पर उपलब्ध है। VS Code extension अलग से इंस्टॉल किया जाता है।",
    stepsTitle: "डाउनलोड से पहले काम तक",
    steps: [
      ["Microsoft से डाउनलोड करें", "ऊपर दिया डाउनलोड बटन दबाएँ। आपके ब्राउज़र और डिवाइस के अनुसार Microsoft का आधिकारिक इंस्टॉलर या Store पेज खुलेगा। Microsoft के निर्देशों के अनुसार इंस्टॉल करें। किसी अनजान वेबसाइट से Blue की फ़ाइल डाउनलोड करने की ज़रूरत नहीं है।"],
      ["Blue खोलें और साइन इन करें", "Windows के Start menu से Blue Desktop खोलें। अपने Blue खाते में साइन इन करें और पूछे जाने पर ईमेल पर आया कोड डालें।"],
      ["मॉडल कनेक्शन चुनें", "Setup Wizard पूरा करें और उपलब्ध मॉडल चुनें। Blue Models में Blue Credits इस्तेमाल होते हैं। OpenRouter BYOK में आपकी अपनी provider key और उस provider की billing इस्तेमाल होती है। API key केवल Setup Wizard में डालें, चैट में कभी नहीं।"],
      ["पहले छोटा काम दें", "सवाल पूछने के लिए New chat खोलें। कोड पर काम करवाने के लिए अपना project folder जोड़ें। पहले पूछें: “यह प्रोजेक्ट क्या करता है, समझाओ। अभी किसी फ़ाइल को बदलना मत।” बदलाव करवाने से पहले जवाब और काम की जानकारी देखें।"],
    ],
    teamsTitle: "अपनी AI Team बनानी है?",
    teams: "अलग-अलग जिम्मेदारियों के लिए Blue Desktop में Team खोलें। कम से कम 25 Blue Credits की योग्य खरीद से Teams चालू होता है और wallet में credits रहने तक इस्तेमाल किया जा सकता है। Teams में Blue Models इस्तेमाल होते हैं; यह VS Code extension का हिस्सा नहीं है। काम चलते समय Blue खुला रखें और कंप्यूटर चालू, जागता हुआ और इंटरनेट से जुड़ा रखें।",
    extensionTitle: "Blue का VS Code extension चाहिए?",
    extension: "आधिकारिक Visual Studio Marketplace से Blue Coding Assistant इंस्टॉल करें, उसका sidebar खोलें और Setup Wizard पूरा करें। VSIX extension की फ़ाइल Windows desktop app का इंस्टॉलर नहीं है।",
    extensionLink: "Visual Studio Marketplace पर Blue खोलें",
    helpTitle: "डाउनलोड या सेटअप में दिक्कत आए तो",
    help: ["डाउनलोड शुरू न हो तो Microsoft Store का पेज खोलकर अपने डिवाइस के लिए दिख रहे install विकल्प का इस्तेमाल करें।", "अपडेट के बाद दोबारा कोशिश करने से पहले Blue को बंद करके खोलें। पहला काम शुरू न हो तो इंटरनेट और मॉडल कनेक्शन जाँचें।", "Windows की सुरक्षा बंद न करें। समस्या बनी रहे तो error message और Windows version के साथ Imergene से संपर्क करें। API key या sign-in code कभी साझा न करें।"],
    next: "आगे क्या करें?", docs: "सेटअप के दस्तावेज़ पढ़ें", pricing: "Blue की कीमत समझें", teamsLink: "Team mode की जानकारी", contact: "सेटअप में मदद लें",
  },
};

export default function DownloadGuide({ language }: { language: "en" | "hi" }) {
  const c = copy[language];
  const path = language === "hi" ? "/hi/download" : "/download";
  return <PageLayout>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: language === "hi" ? "Blue डाउनलोड" : "Download Blue", item: canonicalUrl(path) },
    ] }} />
    <article lang={language} className="site-container max-w-5xl pb-24 pt-10 sm:pt-16" aria-labelledby="download-title">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-brand">Blue by Imergene</Link>
        <Link href={c.alternate} hrefLang={language === "hi" ? "en" : "hi"} className="min-h-11 py-3 text-brand underline underline-offset-4">{c.language}</Link>
      </nav>
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow text-brand">Blue Desktop · Windows</p>
        <h1 id="download-title" className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">{c.title}</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">{c.intro}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <DesktopDownloadLink className="btn btn-primary min-h-12 gap-2"><Download size={17} aria-hidden="true" />{c.download}</DesktopDownloadLink>
          <DesktopDownloadLink variant="store" className="btn btn-secondary min-h-12 gap-2"><Monitor size={17} aria-hidden="true" />{c.store}</DesktopDownloadLink>
        </div>
        <p className="mt-5 text-sm leading-7 text-ink-muted">{c.requirements}</p>
      </header>
      <section className="mt-12 border-t border-line pt-10" aria-labelledby="download-steps">
        <h2 id="download-steps" className="text-2xl font-semibold text-ink">{c.stepsTitle}</h2>
        <ol className="mt-7 grid gap-5 sm:grid-cols-2">
          {c.steps.map(([title, body], index) => <li key={title} className="rounded-xl border border-line bg-paper-alt p-6">
            <span className="font-mono text-sm text-brand">0{index + 1}</span><h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{body}</p>
          </li>)}
        </ol>
      </section>
      <section className="mt-10 rounded-xl border border-line p-6 sm:p-8"><h2 className="text-2xl font-semibold text-ink">{c.teamsTitle}</h2><p className="mt-4 text-base leading-8 text-ink-muted">{c.teams}</p><Link href="/teams" className="mt-4 inline-flex min-h-11 items-center gap-2 text-brand underline underline-offset-4">{c.teamsLink}<ArrowRight size={15} aria-hidden="true" /></Link></section>
      <section className="mt-10 border-t border-line pt-8"><h2 className="flex items-center gap-3 text-2xl font-semibold text-ink"><Terminal size={23} aria-hidden="true" />{c.extensionTitle}</h2><p className="mt-4 text-base leading-8 text-ink-muted">{c.extension}</p><a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-brand underline underline-offset-4">{c.extensionLink}</a></section>
      <section className="mt-10 border-t border-line pt-8"><h2 className="text-2xl font-semibold text-ink">{c.helpTitle}</h2><ul className="mt-5 list-disc space-y-3 pl-5 text-base leading-8 text-ink-muted">{c.help.map(line => <li key={line}>{line}</li>)}</ul><Link href="/contact" className="mt-4 inline-flex min-h-11 items-center text-brand underline underline-offset-4">{c.contact}</Link></section>
      <nav aria-label={c.next} className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm font-medium text-brand">
        <Link href="/docs" className="min-h-11 py-3 hover:underline">{c.docs}</Link><Link href="/pricing" className="min-h-11 py-3 hover:underline">{c.pricing}</Link><Link href="/guides/ai-agent-teams" className="min-h-11 py-3 hover:underline">{c.teamsLink}</Link>
      </nav>
    </article>
  </PageLayout>;
}
