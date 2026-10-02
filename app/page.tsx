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

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className={`flex-1 ${styles.landing}`}>
        <Hero />
        <ProductShowcase />
        <Features />
        <ModelsShowcase />
        <DemoVideo />
        <Testimonials />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
