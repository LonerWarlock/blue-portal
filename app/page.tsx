import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Testimonials from "./components/Testimonials";
import ModelsShowcase from "./components/ModelsShowcase";
import DemoVideo from "./components/DemoVideo";
import CtaSection from "./components/CtaSection";
import Footer from "./components/Footer";
import ProductShowcase from "./components/ProductShowcase";
import styles from "./components/PremiumLanding.module.css";
import CodingAssistantFaq from "./components/CodingAssistantFaq";
import JsonLd from "./components/JsonLd";
import { createPageMetadata, DESKTOP_APP_SCHEMA, HOME_DESCRIPTION, HOME_TITLE } from "@/lib/seo";

export const metadata = createPageMetadata("/", HOME_TITLE, HOME_DESCRIPTION);

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className={`flex-1 ${styles.landing}`}>
        <JsonLd data={DESKTOP_APP_SCHEMA} />
        <Hero />
        <ProductShowcase />
        <Features />
        <ModelsShowcase />
        <DemoVideo />
        <Testimonials />
        <CodingAssistantFaq />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
