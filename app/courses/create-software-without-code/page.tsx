'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type PaymentResult = 'success' | 'failed' | null;

const COURSE_FEE = 2000;
const COURSE_FEE_STR = `\u20B9${COURSE_FEE.toLocaleString('en-IN')}`;

const DEGREES = [
  'B.Tech', 'B.E.', 'BCA', 'B.Sc', 'BCS', 'B.Com', 'BBA', 'BA', 'B.Design', 'B.Pharm',
  'M.Tech', 'M.E.', 'MCA', 'M.Sc', 'MCS', 'M.Com', 'MBA', 'MA', 'M.Design',
  'Ph.D', 'Diploma', 'Other / Professional',
];

const STATUS_OPTIONS = ['Student', 'Working Professional', 'Freelancer', 'Founder / Entrepreneur', 'Other'];

const YEAR_OPTIONS = [
  '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year',
  '2023 Graduate', '2024 Graduate', '2025 Graduate', '2026 Graduate', '2027 Graduate', 'Working Professional',
];

const EXPERIENCE_LEVELS = ['Beginner (No Code)', 'Intermediate (Knows basics)', 'Advanced (Experienced Developer)'];

const TERMS = (fee: string) => [
  `A registration fee of ${fee} is required to confirm your registration for the "Create Softwares Without Writing A Single Line Of Code" workshop. If 50+ total registrations are received, every enrolled participant will receive a \u20B9500 refund back (effective fee: \u20B91,500).`,
  'The registration fee is strictly non-refundable under standard conditions, including voluntary withdrawal or failure to attend live sessions.',
  'Participants will receive access to live sessions, recordings, AI prompt toolkits, and software build resources.',
  'Course materials, prompt templates, and software resources shared during the program are for personal learning only and may not be redistributed.',
  'All hands-on software build tasks must be completed to qualify for the completion certificate.',
  'A completion certificate will be issued upon successful attendance and project submission.',
  'All information provided during registration must be true and accurate.',
  'You agree to maintain the confidentiality of proprietary templates and internal workflows shared during the workshop.',
  'Imergene reserves the right to modify schedule or session mentors with advance notice to participants.',
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

const STORAGE_KEY = 'imergene_nocode_course_registrations';

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
  return 'nocode_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export default function NoCodeCoursePage() {
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
        if (!form.degree) return 'Please select your degree / background.';
        if (!form.collegeName.trim()) return 'College / Organization name is required.';
        if (form.collegeName.trim().length < 2) return 'Please enter the complete name.';
        if (!form.yearOfStudy.trim()) return 'Year of study / status is required.';
        if (!form.currentStatus) return 'Please select your current status.';
        return null;
      case 2:
        if (!form.programmingExperience) return 'Please select your experience level.';
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
        body: JSON.stringify({
          sessionId,
          formData: form,
          productName: 'Create Softwares Without Writing A Single Line Of Code',
          customAmount: 2000,
          redirectPath: '/courses/create-software-without-code',
        }),
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
                Your registration for <span className="text-purple-600 font-semibold">Create Softwares Without Writing A Single Line Of Code</span> has been confirmed.
              </p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-left text-xs text-gray-500 space-y-1 mb-6">
                {resultData && (
                  <>
                    <p><span className="text-gray-400">Name:</span> <span className="text-gray-700 font-medium">{resultData.name}</span></p>
                    <p><span className="text-gray-400">Email:</span> <span className="text-gray-700">{resultData.email}</span></p>
                  </>
                )}
                <p><span className="text-gray-400">Amount Paid:</span> <span className="text-violet-600 font-semibold">{COURSE_FEE_STR}</span></p>
              </div>
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 mb-6 text-left">
                <p className="text-xs font-semibold text-purple-900 mb-1">
                  <i className="fa-solid fa-gift mr-1.5 text-purple-600"></i> Milestone Refund Offer:
                </p>
                <p className="text-[11px] text-purple-700">
                  If 50+ total registrations are received, every enrolled student will receive a <strong>&#8377;500 refund back</strong> directly! (Effective Fee: &#8377;1,500). Share with friends to help hit the milestone!
                </p>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-6">
                <p className="text-sm font-semibold text-green-800 mb-1">
                  <i className="fa-brands fa-whatsapp mr-1.5"></i> Join the WhatsApp Group Now!
                </p>
                <p className="text-xs text-green-700">
                  All session links, prompt blueprints, and workshop resources will be shared in the WhatsApp group.
                </p>
              </div>
              <a href="https://chat.whatsapp.com/KqjIjm2YhlkJNKZR6ObCoE" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#25D366] text-white font-semibold text-sm shadow hover:bg-[#20bd5a] transition">
                <i className="fa-brands fa-whatsapp text-lg"></i> Join WhatsApp Group
              </a>
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
                <button onClick={() => { setStep(3); setForm(f => ({ ...f, declarationAccepted: false, termsAccepted: false })); window.history.replaceState({}, '', '/courses/create-software-without-code'); }}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 font-semibold text-white text-sm shadow hover:from-violet-600 hover:to-purple-700 transition">
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
            <p className="text-[12px] text-gray-400 mt-1">Confirmation details & session links will be sent here.</p>
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
          <p className="text-xs text-gray-400 mb-4">Your background helps us tailor the workshop pace.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Degree / Profession {reqMark}</label>
              <select className={inputClass} value={form.degree} onChange={e => set('degree', e.target.value)}>
                <option value="">Select Degree / Profession</option>
                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Branch / Field</label>
              <input className={inputClass} value={form.branch} onChange={e => set('branch', e.target.value)} placeholder="e.g. CS, Marketing, Business" maxLength={100} />
            </div>
          </div>
          <div>
            <label className={labelClass}>College / Organization Name {reqMark}</label>
            <p className="text-[12px] text-gray-400 mt-1">College name if student, company/startup if working</p>
            <input className={inputClass} value={form.collegeName} onChange={e => set('collegeName', e.target.value)} placeholder="e.g. College Name or Company / Self-Employed" maxLength={200} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Year of Study / Status {reqMark}</label>
              <select className={inputClass} value={form.yearOfStudy} onChange={e => set('yearOfStudy', e.target.value)}>
                <option value="">Select Year / Status</option>
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
          <h2 className="text-lg font-bold text-gray-800 mb-1">Coding / Technical Background</h2>
          <p className="text-xs text-gray-400 mb-4">No coding experience is required for this workshop!</p>
          <div>
            <label className={labelClass}>Prior Programming Experience {reqMark}</label>
            <select className={inputClass} value={form.programmingExperience} onChange={e => set('programmingExperience', e.target.value)}>
              <option value="">Select Level</option>
              {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <p className="text-[12px] text-gray-400 mt-1">
              Beginner = zero coding experience &bull; Intermediate = tried HTML/Python before &bull; Advanced = active coder looking for AI speed boost
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
              <h3 className="text-sm font-bold text-gray-700">Workshop &mdash; Terms & Conditions</h3>
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
    <div className="min-h-screen bg-[#f8fafb] px-4 py-8 sm:py-12">
      <div className="w-full max-w-3xl mx-auto">
        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Live AI Software Creation Workshop
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              CREATE SOFTWARES WITHOUT WRITING A SINGLE LINE OF CODE
            </span>
          </h1>
          <p className="text-gray-600 text-sm mt-2 max-w-xl mx-auto font-medium">
            Learn to build full apps &amp; website UIs visually using <strong className="text-blue-600 font-bold">Blue AI</strong>.
          </p>
        </div>

        {/* Demo Video Section */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-2 sm:p-3 shadow-xl mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 rounded-t-xl mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
              <span className="text-[11px] text-slate-400 font-mono ml-2 hidden sm:inline">Blue AI UI Creation Demo</span>
            </div>
            <span className="text-[11px] font-semibold text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-800/50">
              <i className="fa-solid fa-play mr-1 text-[9px]"></i> Live Preview
            </span>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              src="/videos/ui-demo.mp4"
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-center text-xs text-slate-400 mt-2.5 py-1">
            ✨ <span className="text-slate-200 font-medium">See how easily website UIs &amp; app features are created visually using Blue AI!</span>
          </p>
        </div>

        {/* Main Highlights Grid */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm mb-8 space-y-6">
          {/* Pricing Banner */}
          <div className="rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/60 pb-3 mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Workshop Fee</span>
                <div className="text-2xl font-extrabold text-gray-900">{COURSE_FEE_STR} <span className="text-xs font-normal text-gray-500">/ seat</span></div>
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-indigo-600 text-white font-bold text-xs">
                  SPECIAL CASHBACK OFFER
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white/90 border border-indigo-200 p-3">
              <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <i className="fa-solid fa-gift text-indigo-600"></i> Get &#8377;500 Refund Back!
              </p>
              <p className="text-xs text-indigo-800 mt-0.5">
                If <strong>50+ total registrations</strong> are reached, every participant receives a <strong>&#8377;500 refund back</strong>!
                <span className="block mt-0.5 font-bold text-indigo-950">Effective Workshop Fee: &#8377;1,500</span>
              </p>
            </div>
          </div>

          {/* Key Takeaways - Strong Bullet Points */}
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-bolt text-amber-500"></i> Key Workshop Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-800">Primary AI Tool</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Master <strong>Blue AI</strong> to build and deploy software applications without manual coding.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  <i className="fa-solid fa-laptop-code"></i>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-800">Website UI Creation</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Generate &amp; refine website UIs visually in minutes without writing CSS/HTML by hand.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  <i className="fa-solid fa-database"></i>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-800">No-Code Databases</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Store data, manage logins, &amp; connect backend logic visually.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-800">Deployment &amp; Hosting</h3>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Deploy websites to Vercel using Blue and learn how to deploy without using AI.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-gray-700">
              <i className="fa-solid fa-check text-green-500 font-bold"></i>
              <span><strong>Who Can Join:</strong> Beginners, Founders, Students, Creators</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <i className="fa-solid fa-award text-amber-500"></i>
              <span><strong>Certificate:</strong> Provided on completion</span>
            </div>
          </div>
        </div>

        {/* Wizard Progress Bar */}
        <div className="flex items-center gap-1 mb-6 px-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  i < step ? 'bg-blue-100 border border-blue-300 text-blue-600'
                  : i === step ? 'bg-indigo-100 border border-indigo-300 text-indigo-600 shadow-lg shadow-indigo-100'
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
                  i < step ? 'bg-blue-300' : 'bg-gray-200'
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

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
            {step > 0 ? (
              <button onClick={prevStep} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:text-gray-700 hover:border-gray-300 transition flex items-center gap-2">
                <i className="fa-solid fa-arrow-left text-xs"></i> Back
              </button>
            ) : <div></div>}

            {step < 3 ? (
              <button onClick={nextStep} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-2">
                Next <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            ) : (
              <button onClick={handlePayment} disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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
          Secured by <span className="text-gray-500 font-semibold">PayU Payments</span>. Data encrypted.
        </p>
      </div>
    </div>
  );
}
