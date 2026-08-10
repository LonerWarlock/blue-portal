'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { COURSE_FEE_STR } from './config';

type PaymentResult = 'success' | 'failed' | null;

const DEGREES = [
  'B.Tech', 'B.E.', 'BCA', 'B.Sc', 'BCS', 'B.Com', 'BBA', 'BA', 'B.Design', 'B.Pharm',
  'M.Tech', 'M.E.', 'MCA', 'M.Sc', 'MCS', 'M.Com', 'MBA', 'MA', 'M.Design',
  'Ph.D', 'Diploma', 'Other',
];

const STATUS_OPTIONS = ['Student', 'Working Professional', 'Freelancer', 'Other'];

const YEAR_OPTIONS = [
  '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year',
  '2023 Graduate', '2024 Graduate', '2025 Graduate', '2026 Graduate', '2027 Graduate',
];

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const TERMS = (fee: string) => [
  `A non-refundable registration fee of ${fee} is required to confirm your registration for the Python & Data Science Bootcamp 2026. If 50+ registrations are received, every enrolled student will receive a \u20B9500 refund (effective fee: \u20B91,500).`,
  'The registration fee is strictly non-refundable under all circumstances, including voluntary withdrawal or failure to complete the bootcamp.',
  'The bootcamp runs from 13 August 2026 to 30 September 2026 (45 days). Participants must attend scheduled sessions and complete all projects.',
  'Course materials, recordings, and resources shared during the program are for personal use only and may not be redistributed.',
  'All assignments and projects must be submitted by the given deadlines to qualify for the completion certificate.',
  'A completion certificate will be issued only upon successful completion of the bootcamp, including attendance and project submission.',
  'All information provided during registration must be true and accurate. False or misleading information may result in termination without refund.',
  'You agree to maintain the confidentiality of all proprietary content, datasets, and materials shared during the bootcamp.',
  'Imergene reserves the right to modify the schedule, content, or instructors with reasonable notice to participants.',
];

const STEPS = ['Personal', 'Background', 'Experience', 'Declaration'];

const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition placeholder:text-gray-400';
const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';
const reqMark = <span className="text-red-400 ml-0.5">*</span>;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  degree: string;
  branch: string;
  collegeName: string;
  yearOfStudy: string;
  currentStatus: string;
  programmingExperience: string;
  declarationAccepted: boolean;
  termsAccepted: boolean;
}

const initial: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  degree: '',
  branch: '',
  collegeName: '',
  yearOfStudy: '',
  currentStatus: '',
  programmingExperience: '',
  declarationAccepted: false,
  termsAccepted: false,
};

const STORAGE_KEY = 'imergene_course_registrations';

function getPendingRegistrations(): Record<string, FormData> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function savePendingRegistration(id: string, data: FormData) {
  const all = getPendingRegistrations();
  all[id] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function removePendingRegistration(id: string) {
  const all = getPendingRegistrations();
  delete all[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateSessionId(): string {
  return 'course_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export default function CoursesPage() {
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get('payment') as PaymentResult;
  const txnid = searchParams.get('txnid');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (paymentResult === 'success' && txnid) {
      const all = getPendingRegistrations();
      const record = all[`pending_${txnid}`];
      if (record) {
        setResultData({ name: `${record.firstName} ${record.lastName}`, email: record.email });
        removePendingRegistration(`pending_${txnid}`);
      }
    }
    if (paymentResult === 'failed' && txnid) {
      removePendingRegistration(`pending_${txnid}`);
    }
  }, [paymentResult, txnid]);

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!form.firstName.trim()) return 'First name is required.';
        if (form.firstName.trim().length < 2) return 'First name must be at least 2 characters.';
        if (!form.lastName.trim()) return 'Last name is required.';
        if (form.lastName.trim().length < 2) return 'Last name must be at least 2 characters.';
        if (!form.email.trim()) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
        if (!form.phone.trim()) return 'Phone number is required.';
        if (!/^\d{10}$/.test(form.phone.trim())) return 'Phone number must be exactly 10 digits.';
        return null;
      case 1:
        if (!form.degree) return 'Please select your degree.';
        if (!form.branch.trim()) return 'Branch / specialization is required.';
        if (!form.collegeName.trim()) return 'College / Organization name is required.';
        if (form.collegeName.trim().length < 3) return 'Please enter the complete name.';
        if (!form.yearOfStudy.trim()) return 'Year of study / graduation is required.';
        if (!form.currentStatus) return 'Please select your current status.';
        return null;
      case 2:
        if (!form.programmingExperience) return 'Please select your programming experience level.';
        return null;
      case 3:
        if (!form.declarationAccepted) return 'You must accept the declaration.';
        if (!form.termsAccepted) return 'You must agree to the terms and conditions.';
        return null;
      default:
        return null;
    }
  };

  const nextStep = () => {
    setError('');
    const err = validateStep();
    if (err) { setError(err); return; }
    setStep(s => Math.min(s + 1, 3));
  };

  const prevStep = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handlePayment = async () => {
    setError('');
    const err = validateStep();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const sessionId = generateSessionId();

      savePendingRegistration(`pending_${sessionId}`, form);

      const hashRes = await fetch('/api/courses/payu/create-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, formData: form }),
      });
      const hashData = await hashRes.json();
      if (!hashRes.ok || hashData.error) {
        removePendingRegistration(`pending_${sessionId}`);
        throw new Error(hashData.error || 'Failed to generate payment signature');
      }

      const payuForm = document.createElement('form');
      payuForm.action = hashData.payuUrl;
      payuForm.method = 'POST';

      const params: Record<string, string> = {
        key: hashData.key,
        txnid: hashData.txnid,
        amount: hashData.amount,
        productinfo: hashData.productinfo,
        firstname: hashData.firstname,
        email: hashData.email,
        phone: form.phone,
        surl: `${window.location.origin}/api/courses/payu/callback`,
        furl: `${window.location.origin}/api/courses/payu/callback`,
        hash: hashData.hash,
        service_provider: 'payu_paisa',
      };

      for (const [k, v] of Object.entries(params)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        payuForm.appendChild(input);
      }

      document.body.appendChild(payuForm);
      payuForm.submit();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // ---------- RESULT SCREEN ----------
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center px-6">
        <div className="rounded-2xl bg-white border border-gray-200 p-10 max-w-lg w-full text-center shadow-lg">
          {paymentResult === 'success' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-check text-3xl text-violet-500"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-3">Registration Complete!</h1>
              <p className="text-gray-500 text-sm mb-6">
                Your registration for the <span className="text-purple-500 font-semibold">Python & Data Science Bootcamp 2026</span> has been confirmed.
                You will receive further details at your registered email address.
              </p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-left text-xs text-gray-500 space-y-1 mb-6">
                {resultData && (
                  <>
                    <p><span className="text-gray-400">Name:</span> <span className="text-gray-700 font-medium">{resultData.name}</span></p>
                    <p><span className="text-gray-400">Email:</span> <span className="text-gray-700">{resultData.email}</span></p>
                  </>
                )}
                <p><span className="text-gray-400">Amount Paid:</span> <span className="text-violet-500 font-semibold">{COURSE_FEE_STR}</span></p>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-6">
                <p className="text-sm font-semibold text-green-800 mb-1">
                  <i className="fa-brands fa-whatsapp mr-1.5"></i> Join the WhatsApp Group Now!
                </p>
                <p className="text-xs text-green-700">
                  All bootcamp updates, session links, and materials will be shared in the WhatsApp group. You must join to stay updated.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/courses" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-400 to-purple-400 font-semibold text-white text-sm shadow hover:from-violet-500 hover:to-purple-500 transition">
                  <i className="fa-solid fa-arrow-left"></i> Register Another Participant
                </a>
                <a href="https://chat.whatsapp.com/CIdlgkTxklS7I3kZ6RqNcg" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-green-300 bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition">
                  <i className="fa-brands fa-whatsapp"></i> Join WhatsApp Group
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-xmark text-3xl text-red-400"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-3">Payment Failed</h1>
              <p className="text-gray-500 text-sm mb-6">
                Your payment could not be processed. No amount has been deducted.
                Please try again or contact support if the issue persists.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setStep(3); setForm(f => ({ ...f, declarationAccepted: false, termsAccepted: false })); window.history.replaceState({}, '', '/courses'); }}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-400 to-purple-400 font-semibold text-white text-sm shadow hover:from-violet-500 hover:to-purple-500 transition">
                  Try Again
                </button>
                <a href="/" className="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:text-gray-700 hover:border-gray-300 transition">
                  Go Home
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- WIZARD ----------
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Personal Details</h2>
          <p className="text-xs text-gray-400 mb-4">Tell us about yourself.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name {reqMark}</label>
              <input className={inputClass} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="John" maxLength={50} />
            </div>
            <div>
              <label className={labelClass}>Last Name {reqMark}</label>
              <input className={inputClass} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Doe" maxLength={50} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Personal Email {reqMark}</label>
            <p className="text-[12px] text-gray-400 mt-1">Confirmation details will be sent here.</p>
            <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" maxLength={100} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone Number {reqMark}</label>
              <input type="tel" className={inputClass} value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" className={inputClass} value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                max={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select className={inputClass} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">Select (optional)</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      );

      case 1: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Academic / Professional Background</h2>
          <p className="text-xs text-gray-400 mb-4">Your education and current status.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Degree {reqMark}</label>
              <select className={inputClass} value={form.degree} onChange={e => set('degree', e.target.value)}>
                <option value="">Select Degree</option>
                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Branch / Specialization {reqMark}</label>
              <input className={inputClass} value={form.branch} onChange={e => set('branch', e.target.value)} placeholder="Computer Science" maxLength={100} />
            </div>
          </div>
          <div>
            <label className={labelClass}>College / Organization {reqMark}</label>
            <p className="text-[12px] text-gray-400 mt-1">College name if student, company name if working</p>
            <input className={inputClass} value={form.collegeName} onChange={e => set('collegeName', e.target.value)} placeholder="e.g., Indian Institute of Technology, Mumbai" maxLength={200} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Year of Study / Graduation {reqMark}</label>
              <select className={inputClass} value={form.yearOfStudy} onChange={e => set('yearOfStudy', e.target.value)}>
                <option value="">Select Year</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Current Status {reqMark}</label>
              <select className={inputClass} value={form.currentStatus} onChange={e => set('currentStatus', e.target.value)}>
                <option value="">Select Status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Experience</h2>
          <p className="text-xs text-gray-400 mb-4">Help us understand your background.</p>
          <div>
            <label className={labelClass}>Programming Experience {reqMark}</label>
            <select className={inputClass} value={form.programmingExperience} onChange={e => set('programmingExperience', e.target.value)}>
              <option value="">Select Level</option>
              {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <p className="text-[12px] text-gray-400 mt-1">
              Beginner = no experience &bull; Intermediate = can write basic programs &bull; Advanced = comfortable with multiple languages
            </p>
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Declaration & Payment</h2>
          <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-1">
            <i className="fa-solid fa-circle-info mr-1.5"></i>
            Please read and accept the terms below before proceeding to payment.
          </p>

          <div className="rounded-xl bg-gray-50 border border-gray-200 overflow-hidden">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5">
              <h3 className="text-sm font-bold text-gray-700">Python & Data Science Course &mdash; Terms & Conditions</h3>
            </div>
            <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2">
              <ol className="text-xs text-gray-500 list-decimal list-inside space-y-1.5">
                {TERMS(COURSE_FEE_STR).map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.declarationAccepted} onChange={e => set('declarationAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-white text-purple-500 focus:ring-purple-100 shrink-0" />
              <span className="text-xs text-gray-500 group-hover:text-gray-600 transition">
                I hereby declare that all the information provided by me is true and correct to the best of my knowledge and belief. {reqMark}
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.termsAccepted} onChange={e => set('termsAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-white text-purple-500 focus:ring-purple-100 shrink-0" />
              <span className="text-xs text-gray-500 group-hover:text-gray-600 transition">
                I have read, understood, and agree to the Terms & Conditions mentioned above. {reqMark}
              </span>
            </label>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafb] px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
            Register for Bootcamp
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-800">
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">Python & Data Science Bootcamp 2026</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Learn Python, Data Analytics &amp; AI by Building Real Projects!</p>
        </div>

        {/* Course Info Section */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-graduation-cap text-violet-400"></i> About the Bootcamp
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            Want to kickstart your journey into programming, data science, and AI? Join our beginner-friendly
            <strong> Python & Data Science Bootcamp</strong>, where you&apos;ll learn industry-relevant skills through
            hands-on sessions and practical projects.
          </p>

          {/* Course Timeline */}
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 mb-4">
            <h3 className="text-sm font-bold text-violet-700 mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-days text-xs"></i> Course Timeline
            </h3>
            <ul className="text-xs text-gray-600 space-y-1.5">
              <li><span className="font-medium text-gray-700">Duration:</span> 13 August 2026 &ndash; 30 September 2026 (45 days)</li>
              <li><span className="font-medium text-gray-700">Fee:</span> {COURSE_FEE_STR} per student</li>
              <li><span className="font-medium text-gray-700">Certificate:</span> Yes, on completion</li>
            </ul>
            <div className="mt-3 rounded-lg bg-violet-100/60 border border-violet-200 px-3 py-2">
              <p className="text-[11px] font-semibold text-violet-800">
                <i className="fa-solid fa-tag mr-1"></i>
                Special Batch Offer: If we receive 50+ registrations, every enrolled student will receive a &#8377;500 refund.
                <span className="block mt-0.5">Effective Course Fee: &#8377;1,500</span>
              </p>
            </div>
          </div>

          {/* Curriculum */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <i className="fa-solid fa-book-open text-xs text-violet-500"></i> Course Curriculum
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <h4 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <span className="text-green-500">&#128013;</span> Basic Python
                </h4>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li>Python Fundamentals</li>
                  <li>Variables, Data Types &amp; Operators</li>
                  <li>Conditional Statements &amp; Loops</li>
                  <li>Functions &amp; File Handling</li>
                  <li>Object-Oriented Programming (Basics)</li>
                </ul>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <h4 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <span className="text-blue-500">&#128202;</span> Data Analytics
                </h4>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li>Data Analysis Fundamentals</li>
                  <li>Working with Excel &amp; CSV Files</li>
                  <li>Data Cleaning &amp; Processing</li>
                  <li>Data Visualization Basics</li>
                </ul>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <h4 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <span className="text-purple-500">&#127760;</span> Flask Fundamentals
                </h4>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li>Introduction to Flask</li>
                  <li>Creating Web Applications</li>
                  <li>Routing &amp; Templates</li>
                  <li>Forms &amp; Basic Database Integration</li>
                </ul>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-3">
                <h4 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <span className="text-orange-500">&#129302;</span> Using AI Tools
                </h4>
                <ul className="text-[11px] text-gray-500 space-y-1 list-disc pl-4">
                  <li>AI for Developers</li>
                  <li>Prompt Engineering Basics</li>
                  <li>Using AI for Coding &amp; Productivity</li>
                  <li>AI-Assisted Debugging &amp; Development</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Projects & What You'll Gain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
              <h3 className="text-sm font-bold text-teal-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-laptop-code text-xs"></i> Projects
              </h3>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>Build <strong>2 real-world projects</strong> using Blue AI</li>
                <li>Gain practical development experience</li>
                <li>Understand AI-assisted software development</li>
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
              <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-trophy text-xs"></i> What You&apos;ll Gain
              </h3>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                <li>Strong foundation in Python</li>
                <li>Introduction to Data Analytics</li>
                <li>Flask web development basics</li>
                <li>Practical use of modern AI tools</li>
                <li>Two portfolio-ready projects</li>
                <li>Certificate of Completion</li>
              </ul>
            </div>
          </div>

          {/* Who Can Join & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
              <h3 className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-users text-xs"></i> Who Can Join?
              </h3>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>School &amp; College Students</li>
                <li>Beginners in Programming</li>
                <li>Anyone interested in Python, Data Analytics, AI, or Software Development</li>
              </ul>
              <p className="text-[11px] text-gray-400 mt-2 italic">No prior programming knowledge is required.</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
              <h3 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-phone text-xs"></i> Contact
              </h3>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>Om Karande: +91 93226 11145</li>
                <li>Soham Phatak: +91 74987 87848</li>
                <li>Email: team@imergene.in</li>
                <li>
                  Website: <a href="https://www.imergene.in" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-600 underline">
                    imergene.in
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-1 mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  i < step ? 'bg-violet-100 border border-violet-300 text-violet-600'
                  : i === step ? 'bg-purple-100 border border-purple-300 text-purple-600 shadow-lg shadow-purple-100'
                  : 'bg-gray-100 border border-gray-200 text-gray-400'
                }`}>
                  {i < step ? <i className="fa-solid fa-check text-[10px]"></i> : i + 1}
                </div>
                <span className={`text-[10px] mt-1.5 font-medium hidden sm:block ${
                  i <= step ? 'text-gray-600' : 'text-gray-400'
                }`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 mt-[-14px] sm:mt-0 transition-all duration-300 ${
                  i < step ? 'bg-violet-300' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 sm:p-8 shadow-lg">
          {renderStep()}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
            {step > 0 ? (
              <button onClick={prevStep} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:text-gray-700 hover:border-gray-300 transition flex items-center gap-2">
                <i className="fa-solid fa-arrow-left text-xs"></i> Back
              </button>
            ) : <div></div>}

            {step < 3 ? (
              <button onClick={nextStep} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-400 to-purple-400 font-semibold text-white text-sm shadow hover:from-violet-500 hover:to-purple-500 transition flex items-center gap-2">
                Next <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            ) : (
              <button onClick={handlePayment} disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-400 to-purple-400 font-semibold text-white text-sm shadow hover:from-violet-500 hover:to-purple-500 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> Pay {COURSE_FEE_STR} &amp; Register
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-4">
          Secured by <span className="text-gray-500 font-semibold">PayU Payments</span>. Your data is encrypted.
        </p>
      </div>
    </div>
  );
}
