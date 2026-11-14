import DownloadGuide from "@/app/components/DownloadGuide";
import { canonicalUrl, createPageMetadata } from "@/lib/seo";

export const metadata = {
  ...createPageMetadata("/hi/download", "Blue Desktop डाउनलोड और इंस्टॉल कैसे करें? | Imergene", "Windows पर Blue Desktop डाउनलोड और इंस्टॉल करने के आसान कदम। Microsoft से डाउनलोड करें, साइन इन करें, मॉडल कनेक्ट करें और पहला काम शुरू करें।", "hi_IN"),
  alternates: { canonical: canonicalUrl("/hi/download"), languages: { en: canonicalUrl("/download"), hi: canonicalUrl("/hi/download"), "x-default": canonicalUrl("/download") } },
};

export default function HindiDownloadPage() { return <DownloadGuide language="hi" />; }
