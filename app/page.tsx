"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Testimonials from "./components/Testimonials";
import ModelsShowcase from "./components/ModelsShowcase";
import CtaSection from "./components/CtaSection";
import Footer from "./components/Footer";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/console");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (user) {
    return null;
  }

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
