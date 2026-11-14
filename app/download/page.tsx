import DownloadGuide from "@/app/components/DownloadGuide";
import { canonicalUrl, createPageMetadata } from "@/lib/seo";

export const metadata = {
  ...createPageMetadata("/download", "Download Blue Desktop for Windows | Install & Get Started", "Download Blue Desktop by Imergene from Microsoft. Follow the Windows installation steps, sign in, connect a model and start your first coding task."),
  alternates: { canonical: canonicalUrl("/download"), languages: { en: canonicalUrl("/download"), hi: canonicalUrl("/hi/download"), "x-default": canonicalUrl("/download") } },
};

export default function DownloadPage() { return <DownloadGuide language="en" />; }
