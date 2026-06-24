import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Testimonials from "./components/Testimonials";
import ModelsShowcase from "./components/ModelsShowcase";
import CtaSection from "./components/CtaSection";
import Footer from "./components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <ModelsShowcase />
        <Testimonials />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
