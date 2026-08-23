"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Coffee,
  Globe2,
  GraduationCap,
  Loader2,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  EXPERIENCE_OPTIONS,
  JAVA_COURSE,
  JAVA_COURSE_TRACKS,
  STATUS_OPTIONS,
} from "./config";

type RegistrationForm = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  currentStatus: string;
  experience: string;
  consent: boolean;
  website: string;
};

const initialForm: RegistrationForm = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  currentStatus: "",
  experience: "",
  consent: false,
  website: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#d74b2a] focus:ring-4 focus:ring-[#d74b2a]/10";

const faqs = [
  {
    question: "Do I need programming experience?",
    answer:
      "No. The course starts with the foundations and includes guided practice. Familiarity with any programming language is helpful, but not required.",
  },
  {
    question: "Are the sessions live or recorded?",
    answer:
      "The course is taught live online. Session recordings and learning resources will also be shared with registered learners.",
  },
  {
    question: "What do I need to attend?",
    answer:
      "A laptop that can run Java 21, a stable internet connection, and the commitment to practise between sessions. Setup guidance is included.",
  },
  {
    question: "What is the course fee?",
    answer:
      `For payment testing, the course fee is ${JAVA_COURSE.feeLabel}. A ${JAVA_COURSE.gatewayFeeLabel} payment processing charge is added, making the total payable ${JAVA_COURSE.totalPayableLabel}.`,
  },
];

const STORAGE_PREFIX = "java_course_payment_";

function FieldLabel({ children, required = true }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-stone-800">
      {children} {required && <span className="text-[#d74b2a]">*</span>}
    </span>
  );
}

export default function JavaCoursePage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const firstName = useMemo(() => form.fullName.trim().split(/\s+/)[0] || "there", [form.fullName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const txnid = params.get("txnid") || "";
    if ((payment !== "success" && payment !== "failed") || !txnid) return;

    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${txnid}`);
      if (saved) setForm({ ...initialForm, ...JSON.parse(saved), website: "" });
      localStorage.removeItem(`${STORAGE_PREFIX}${txnid}`);
    } catch {
      localStorage.removeItem(`${STORAGE_PREFIX}${txnid}`);
    }

    if (payment === "success") {
      setCheckingPayment(true);
      fetch(`/api/courses/java/payment-status?txnid=${encodeURIComponent(txnid)}`, { method: "POST", cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok || result.status !== "success") {
            throw new Error(result.error || "We could not verify this payment yet. Please contact support with your transaction reference.");
          }
          setRegistrationId(txnid);
        })
        .catch((verificationError) => {
          setError(verificationError instanceof Error ? verificationError.message : "We could not verify this payment yet.");
        })
        .finally(() => setCheckingPayment(false));
    } else {
      setCheckingPayment(true);
      fetch(`/api/courses/java/payment-status?txnid=${encodeURIComponent(txnid)}`, { method: "POST", cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok || result.status !== "success") {
            throw new Error("Payment was not completed. Your details have been restored so you can try again.");
          }
          setRegistrationId(txnid);
        })
        .catch((verificationError) => {
          setError(verificationError instanceof Error ? verificationError.message : "Payment was not completed. Please try again.");
        })
        .finally(() => setCheckingPayment(false));
    }

    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  const update = <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/courses/java/payu/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "We could not initialize payment. Please try again.");
      }

      const requiredFields = ["payuUrl", "key", "txnid", "amount", "productinfo", "firstname", "email", "phone", "surl", "furl", "hash"];
      if (requiredFields.some((field) => !result[field])) {
        throw new Error("The payment gateway returned an incomplete response. Please try again.");
      }

      localStorage.setItem(`${STORAGE_PREFIX}${result.txnid}`, JSON.stringify(form));
      const gatewayForm = document.createElement("form");
      gatewayForm.method = "POST";
      gatewayForm.action = result.payuUrl;

      const gatewayFields: Record<string, string> = {
        key: result.key,
        txnid: result.txnid,
        amount: result.amount,
        productinfo: result.productinfo,
        firstname: result.firstname,
        email: result.email,
        phone: result.phone,
        surl: result.surl,
        furl: result.furl,
        hash: result.hash,
        service_provider: "payu_paisa",
      };

      Object.entries(gatewayFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        gatewayForm.appendChild(input);
      });

      document.body.appendChild(gatewayForm);
      gatewayForm.submit();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f1e8] text-stone-950">
      <header className="sticky top-0 z-50 border-b border-stone-900/10 bg-[#f5f1e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Imergene home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#20201e] text-[#ffb59f]">
              <Coffee size={19} strokeWidth={2.2} />
            </span>
            <span className="font-semibold tracking-tight">Imergene Learning</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Course navigation">
            <a href="#curriculum" className="text-sm font-medium text-stone-600 transition hover:text-stone-950">Curriculum</a>
            <a href="#outcomes" className="text-sm font-medium text-stone-600 transition hover:text-stone-950">Outcomes</a>
            <a href="#faq" className="text-sm font-medium text-stone-600 transition hover:text-stone-950">FAQ</a>
            <button onClick={scrollToForm} className="rounded-full bg-[#20201e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d74b2a]">
              Register now
            </button>
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-stone-800 md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-stone-900/10 bg-[#f5f1e8] px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#curriculum" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">Curriculum</a>
              <a href="#outcomes" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">Outcomes</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">FAQ</a>
              <button onClick={scrollToForm} className="mt-1 rounded-xl bg-[#20201e] px-5 py-3 text-sm font-semibold text-white">Register now</button>
            </div>
          </div>
        )}
      </header>

      <section className="relative border-b border-stone-900/10">
        <div className="pointer-events-none absolute right-[-10rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full border-[80px] border-[#e85d3a]/10" />
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d74b2a]/25 bg-[#d74b2a]/8 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#b83a1d]">
                <Sparkles size={14} /> Registration open
              </span>
              <span className="text-sm font-medium text-stone-500">{JAVA_COURSE.cohort}</span>
            </div>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-[#20201e] sm:text-6xl lg:text-[78px]">
              Learn Java.
              <br />
              <span className="text-[#d74b2a]">Build for real.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-stone-600 sm:text-xl">
              Go from Java fundamentals to a production-ready Spring Boot backend—through live classes, practical builds, and thoughtful mentor feedback.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={scrollToForm} className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#d74b2a] px-7 py-3.5 font-semibold text-white shadow-[0_12px_30px_rgba(215,75,42,0.22)] transition hover:-translate-y-0.5 hover:bg-[#bd3d20]">
                Reserve your seat <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
              <a href="#curriculum" className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/60 px-7 py-3.5 font-semibold text-stone-800 transition hover:border-stone-500">
                Explore curriculum <ChevronDown size={17} />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-stone-600">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#d74b2a]" /> Beginner friendly</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#d74b2a]" /> Live mentor support</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#d74b2a]" /> Capstone certificate</span>
            </div>
          </div>

          <div className="relative z-10 lg:pl-8">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#20201e] p-7 text-white shadow-2xl shadow-stone-900/15 sm:p-9">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[8rem] bg-[#d74b2a] opacity-90" />
              <div className="relative">
                <div className="mb-12 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone-400">Course brief</span>
                  <Code2 size={25} />
                </div>
                <p className="font-mono text-sm text-[#ffb59f]">public class YourCareer &#123;</p>
                <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{JAVA_COURSE.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-400">{JAVA_COURSE.subtitle}</p>
                <p className="mt-7 font-mono text-sm text-[#ffb59f]">&#125;</p>

                <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
                  {[
                    [Clock3, JAVA_COURSE.duration, "Duration"],
                    [Globe2, JAVA_COURSE.format, "Format"],
                    [CalendarDays, JAVA_COURSE.pace, "Pace"],
                    [Users, `${JAVA_COURSE.seats} seats`, "Cohort size"],
                  ].map(([Icon, value, label]) => {
                    const DetailIcon = Icon as typeof Clock3;
                    return (
                      <div key={String(label)} className="bg-[#2a2927] p-4">
                        <DetailIcon size={17} className="mb-3 text-[#ff8e70]" />
                        <p className="text-sm font-semibold">{String(value)}</p>
                        <p className="mt-0.5 text-xs text-stone-500">{String(label)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-1 z-20 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 shadow-xl shadow-stone-900/10 lg:-left-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f4ea] text-[#26733d]"><BadgeCheck size={21} /></span>
              <div><p className="text-sm font-bold text-stone-900">Pay {JAVA_COURSE.totalPayableLabel} total</p><p className="text-xs text-stone-500">Includes {JAVA_COURSE.gatewayFeeLabel} processing charge</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="curriculum" className="scroll-mt-20 bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d74b2a]">What you will learn</span>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#20201e] sm:text-5xl">A clear path from syntax to shipping.</h2>
              <p className="mt-5 max-w-md leading-7 text-stone-600">Every module compounds into a real backend application, so theory never stays abstract for long.</p>
            </div>

            <div className="border-t border-stone-200">
              {JAVA_COURSE_TRACKS.map((track) => (
                <div key={track.number} className="grid gap-3 border-b border-stone-200 py-7 sm:grid-cols-[70px_1fr] sm:py-8">
                  <span className="font-mono text-sm font-bold text-[#d74b2a]">/{track.number}</span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-stone-900">{track.title}</h3>
                    <p className="mt-2 max-w-2xl leading-7 text-stone-600">{track.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="outcomes" className="scroll-mt-20 bg-[#20201e] py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8e70]">Built around outcomes</span>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Leave with proof, not just notes.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [BookOpen, "Practical understanding", "Explain core Java and backend concepts—and know when to use them in a real system."],
              [Code2, "A deployed API", "Build, test, document, and deploy a complete Spring Boot capstone project."],
              [GraduationCap, "Career momentum", "Get code reviews, interview-focused practice, a completion certificate, and a project you can discuss."],
            ].map(([Icon, title, copy], index) => {
              const OutcomeIcon = Icon as typeof BookOpen;
              return (
                <article key={String(title)} className="rounded-3xl border border-white/10 bg-white/[0.045] p-7 sm:p-8">
                  <div className="mb-10 flex items-start justify-between"><OutcomeIcon className="text-[#ff8e70]" size={27} /><span className="font-mono text-xs text-stone-600">0{index + 1}</span></div>
                  <h3 className="text-xl font-semibold">{String(title)}</h3>
                  <p className="mt-3 leading-7 text-stone-400">{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section ref={formRef} id="register" className="scroll-mt-20 bg-[#f5f1e8] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d74b2a]">Registration</span>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Your next build starts here.</h2>
            <p className="mt-5 max-w-md leading-7 text-stone-600">Complete your details and pay the one-time course fee to confirm your place. A payment receipt and enrollment confirmation will be emailed to you.</p>
            <div className="mt-8 space-y-4 text-sm text-stone-700">
              <p className="flex items-start gap-3"><Check className="mt-0.5 shrink-0 text-[#d74b2a]" size={18} /> Test course fee of {JAVA_COURSE.feeLabel}</p>
              <p className="flex items-start gap-3"><Check className="mt-0.5 shrink-0 text-[#d74b2a]" size={18} /> Total {JAVA_COURSE.totalPayableLabel}, including processing charges</p>
              <p className="flex items-start gap-3"><Check className="mt-0.5 shrink-0 text-[#d74b2a]" size={18} /> Your details are used only for this course</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/[0.06] sm:p-9">
            {checkingPayment ? (
              <div className="flex min-h-[540px] flex-col items-center justify-center text-center" aria-live="polite">
                <Loader2 size={38} className="animate-spin text-[#d74b2a]" />
                <h3 className="mt-6 text-2xl font-semibold tracking-tight">Verifying your payment</h3>
                <p className="mt-3 text-sm text-stone-500">Please keep this page open for a moment.</p>
              </div>
            ) : registrationId ? (
              <div className="flex min-h-[540px] flex-col items-center justify-center text-center" aria-live="polite">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e9f4ea] text-[#26733d]"><CheckCircle2 size={38} /></span>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#26733d]">Payment confirmed</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">You&apos;re enrolled, {firstName}.</h3>
                <p className="mt-4 max-w-md leading-7 text-stone-600">We received your total payment of <strong className="text-stone-900">{JAVA_COURSE.totalPayableLabel}</strong>, including {JAVA_COURSE.gatewayFeeLabel} in processing charges. Your receipt and enrollment details have been sent to <strong className="text-stone-900">{form.email || "your registered email"}</strong>.</p>
                <div className="mt-7 rounded-xl bg-stone-50 px-4 py-3 font-mono text-xs text-stone-500">Transaction: {registrationId.toUpperCase()}</div>
                <Link href="/" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#d74b2a] hover:text-[#a8341b]">Back to Imergene <ArrowRight size={17} /></Link>
              </div>
            ) : (
              <form onSubmit={submitRegistration} noValidate>
                <div className="mb-7 flex items-start justify-between gap-4 border-b border-stone-200 pb-6">
                  <div><h3 className="text-2xl font-semibold tracking-tight">Complete enrollment</h3><p className="mt-1 text-sm text-stone-500">{JAVA_COURSE.cohort} · Payment test mode</p></div>
                  <span className="rounded-full bg-[#f8e3dc] p-3 text-[#d74b2a]"><Coffee size={22} /></span>
                </div>

                <div className="mb-7 rounded-2xl border border-stone-200 bg-stone-50 p-4" aria-label="Payment amount breakdown">
                  <div className="flex items-center justify-between text-sm text-stone-600"><span>Course fee</span><span>{JAVA_COURSE.feeLabel}</span></div>
                  <div className="mt-2 flex items-center justify-between text-sm text-stone-600"><span>Payment processing <span className="text-xs text-stone-400">(2% + GST)</span></span><span>{JAVA_COURSE.gatewayFeeLabel}</span></div>
                  <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 font-bold text-stone-950"><span>Total payable</span><span className="text-lg text-[#d74b2a]">{JAVA_COURSE.totalPayableLabel}</span></div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="sm:col-span-2"><FieldLabel>Full name</FieldLabel><input className={inputClass} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} autoComplete="name" maxLength={100} placeholder="Your full name" required /></label>
                  <label><FieldLabel>Email address</FieldLabel><input type="email" className={inputClass} value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" maxLength={150} placeholder="you@example.com" required /></label>
                  <label><FieldLabel>Phone number</FieldLabel><input type="tel" className={inputClass} value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" maxLength={16} placeholder="+91 98765 43210" required /></label>
                  <label><FieldLabel>City</FieldLabel><input className={inputClass} value={form.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={80} placeholder="Pune" required /></label>
                  <label><FieldLabel>Current status</FieldLabel><select className={inputClass} value={form.currentStatus} onChange={(event) => update("currentStatus", event.target.value)} required><option value="">Select one</option>{STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label><FieldLabel>Java experience</FieldLabel><select className={inputClass} value={form.experience} onChange={(event) => update("experience", event.target.value)} required><option value="">Select one</option>{EXPERIENCE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label className="hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} /></label>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300 accent-[#d74b2a]" required />
                  <span className="text-xs leading-5 text-stone-600">I agree to pay {JAVA_COURSE.totalPayableLabel}, including the displayed processing charge, and accept the <Link href="/terms" className="font-semibold text-stone-900 underline underline-offset-2">terms</Link>, <Link href="/refund" className="font-semibold text-stone-900 underline underline-offset-2">refund policy</Link>, and <Link href="/privacy" className="font-semibold text-stone-900 underline underline-offset-2">privacy policy</Link>.</span>
                </label>

                {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <button disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d74b2a] px-6 py-3.5 font-semibold text-white transition hover:bg-[#bd3d20] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> Opening secure payment...</> : <>Pay {JAVA_COURSE.totalPayableLabel} &amp; enroll <ArrowRight size={18} /></>}
                </button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-stone-400"><ShieldCheck size={14} /> Payment processed securely by PayU. Card details never touch our server.</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-stone-900/10 bg-[#f5f1e8] pb-24 pt-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
          <div><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d74b2a]">FAQ</span><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">Good questions, clearly answered.</h2></div>
          <div className="border-t border-stone-300">
            {faqs.map((faq, index) => (
              <div key={faq.question} className="border-b border-stone-300">
                <button className="flex w-full items-center justify-between gap-5 py-6 text-left font-semibold" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
                  {faq.question}<ChevronDown size={18} className={`shrink-0 transition ${openFaq === index ? "rotate-180" : ""}`} />
                </button>
                {openFaq === index && <p className="max-w-2xl pb-6 leading-7 text-stone-600">{faq.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#161614] px-5 py-10 text-stone-400">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center lg:px-3">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#ff8e70]"><Coffee size={18} /></span><div><p className="text-sm font-semibold text-white">Imergene Learning</p><p className="text-xs">Learn by building.</p></div></div>
          <div className="flex flex-wrap items-center gap-5 text-xs"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/contact" className="inline-flex items-center gap-1.5 hover:text-white"><MessageCircle size={14} /> Contact</Link></div>
          <p className="text-xs">© 2026 Imergene</p>
        </div>
      </footer>
    </main>
  );
}
