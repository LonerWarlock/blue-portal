'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { HACKATHON_FEE_STR, REGISTRATION_DEADLINE } from './config';

type PaymentResult = 'success' | 'failed' | null;

const STEPS = ['Leader', 'Team', 'Payment'];

const BRANCHES = [
  'Computer Science and Engg', 'Artificial Intelligence and Data Science', 'Electronics and Telecommunication Engg', 'Electronics and Computer Science',
  'Electrical and Computer Engg', 'Mechanical Engg', 'Civil Engg', 'Chemical Engg', 'Instrumentation and Control Engg',
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition placeholder:text-ink-muted';
const labelClass = 'block text-sm font-medium text-ink-faint mb-1.5';
const reqMark = <span className="text-red-400 ml-0.5">*</span>;

interface TeamMember {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  branch: string;
  year: string;
}

interface FormData {
  leaderFirstName: string;
  leaderLastName: string;
  leaderEmail: string;
  leaderPhone: string;
  leaderBranch: string;
  leaderYear: string;
  teamName: string;
  teamSize: number;
  teamMembers: TeamMember[];
  degree: string;
  declarationAccepted: boolean;
  termsAccepted: boolean;
}

const initial: FormData = {
  leaderFirstName: '',
  leaderLastName: '',
  leaderEmail: '',
  leaderPhone: '',
  leaderBranch: '',
  leaderYear: '',
  teamName: '',
  teamSize: 2,
  teamMembers: [],
  degree: 'B.Tech',
  declarationAccepted: false,
  termsAccepted: false,
};

const createEmptyMember = (): TeamMember => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  branch: '',
  year: '',
});

const STORAGE_KEY = 'imergene_hackathon_registrations';

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
  return 'hack_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

const TERMS = [
  'A non-refundable registration fee of \u20B9100 per team is required to confirm your registration for IGNITE PVPIT 2026.',
  'The registration fee is strictly non-refundable under all circumstances.',
  'The hackathon is open exclusively to students of PVPIT.',
  'Team size must be between 2 and 5 members. Only one registration per group is required.',
  'The hackathon is online mode. Participants must build from their respective homes.',
  'Participants must submit a public GitHub repository link and a screen recording demonstrating the working website.',
  'The problem statement will be shared at the start of the hackathon (1 August 2026, 9:00 PM).',
  'All team members must be currently enrolled at PVPIT.',
  'The use of AI tools, LLMs, and AI coding agents is permitted.',
  'Judging criteria: effectiveness in solving the problem statement, originality and innovation, UI/UX and overall user experience.',
  'Prizes: 1st Place \u20B91,500 | 2nd Place \u20B91,000 | 3rd Place \u20B9500.',
  'All information provided during registration must be true and accurate. False or misleading information may result in disqualification.',
];

export default function HackathonPage() {
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get('payment') as PaymentResult;
  const txnid = searchParams.get('txnid');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState<{ teamName: string; leaderName: string; email: string } | null>(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

  useEffect(() => {
    setIsDeadlinePassed(Date.now() >= REGISTRATION_DEADLINE.getTime());
    const timer = setInterval(() => {
      setIsDeadlinePassed(Date.now() >= REGISTRATION_DEADLINE.getTime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // On success, read from localStorage to show confirmation
  useEffect(() => {
    if (paymentResult === 'success' && txnid) {
      const all = getPendingRegistrations();
      const record = all[`pending_${txnid}`];
      if (record) {
        setResultData({
          teamName: record.teamName,
          leaderName: `${record.leaderFirstName} ${record.leaderLastName}`,
          email: record.leaderEmail,
        });
        removePendingRegistration(`pending_${txnid}`);
      }
    }
    if (paymentResult === 'failed' && txnid) {
      removePendingRegistration(`pending_${txnid}`);
    }
  }, [paymentResult, txnid]);

  // Initialize team members array when team size changes
  useEffect(() => {
    setForm(f => {
      const members = [...f.teamMembers];
      while (members.length < f.teamSize - 1) {
        members.push(createEmptyMember());
      }
      return { ...f, teamMembers: members.slice(0, f.teamSize - 1) };
    });
  }, [form.teamSize]);

  const set = (field: keyof FormData, value: string | boolean | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const setMember = (index: number, field: keyof TeamMember, value: string) =>
    setForm(f => {
      const members = [...f.teamMembers];
      members[index] = { ...members[index], [field]: value };
      return { ...f, teamMembers: members };
    });

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!form.leaderFirstName.trim()) return 'First name is required.';
        if (form.leaderFirstName.trim().length < 2) return 'First name must be at least 2 characters.';
        if (!form.leaderLastName.trim()) return 'Last name is required.';
        if (form.leaderLastName.trim().length < 2) return 'Last name must be at least 2 characters.';
        if (!form.leaderEmail.trim()) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.leaderEmail.trim())) return 'Please enter a valid email address.';
        if (!form.leaderPhone.trim()) return 'Phone number is required.';
        if (!/^\d{10}$/.test(form.leaderPhone.trim())) return 'Phone number must be exactly 10 digits.';
        if (!form.leaderBranch) return 'Please select your branch.';
        if (!form.leaderYear) return 'Please select your year of study.';
        return null;
      case 1:
        if (!form.teamName.trim()) return 'Team name is required.';
        if (form.teamName.trim().length < 2) return 'Team name must be at least 2 characters.';
        if (form.teamSize < 2 || form.teamSize > 5) return 'Team size must be between 2 and 5.';
        for (let i = 0; i < form.teamMembers.length; i++) {
          const m = form.teamMembers[i];
          if (!m.firstName.trim()) return `Member ${i + 1}: First name is required.`;
          if (!m.lastName.trim()) return `Member ${i + 1}: Last name is required.`;
          if (!m.email.trim()) return `Member ${i + 1}: Email is required.`;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim())) return `Member ${i + 1}: Invalid email address.`;
          if (!m.phone.trim()) return `Member ${i + 1}: Phone number is required.`;
          if (!/^\d{10}$/.test(m.phone.trim())) return `Member ${i + 1}: Phone must be exactly 10 digits.`;
          if (!m.branch) return `Member ${i + 1}: Please select branch.`;
          if (!m.year) return `Member ${i + 1}: Please select year.`;
        }
        return null;
      case 2:
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
    setStep(s => Math.min(s + 1, 2));
  };

  const prevStep = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handlePayment = async () => {
    setError('');
    const err = validateStep();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const sessionId = generateSessionId();

      // Store in localStorage with pending key
      savePendingRegistration(`pending_${sessionId}`, form);

      // Get PayU hash
      const hashRes = await fetch('/api/hackathon/payu/create-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, formData: form }),
      });
      const hashData = await hashRes.json();
      if (!hashRes.ok || hashData.error) {
        removePendingRegistration(`pending_${sessionId}`);
        throw new Error(hashData.error || 'Failed to generate payment signature');
      }

      // Build PayU form and submit
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
        phone: form.leaderPhone,
        surl: `${window.location.origin}/api/hackathon/payu/callback`,
        furl: `${window.location.origin}/api/hackathon/payu/callback`,
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
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="rounded-lg bg-white border border-gray-200 p-10 max-w-lg w-full text-center shadow-lg">
          {paymentResult === 'success' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-check text-3xl text-green-500"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-3">Registration Complete!</h1>
              <p className="text-ink-faint text-sm mb-6">
                Your team has been successfully registered for <span className="text-brand font-semibold">IGNITE PVPIT 2026</span>.
                
              </p>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-left text-xs text-ink-faint space-y-1 mb-6">
                {resultData && (
                  <>
                    <p><span className="text-ink-muted">Team:</span> <span className="text-gray-700 font-medium">{resultData.teamName}</span></p>
                    <p><span className="text-ink-muted">Leader:</span> <span className="text-gray-700">{resultData.leaderName}</span></p>
                    <p><span className="text-ink-muted">Email:</span> <span className="text-gray-700">{resultData.email}</span></p>
                  </>
                )}
                <p><span className="text-ink-muted">Amount Paid:</span> <span className="text-green-500 font-semibold">{HACKATHON_FEE_STR}</span></p>
              </div>
              <a href="/hackathon" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand font-semibold text-white text-sm shadow transition">
                <i className="fa-solid fa-arrow-left"></i> Register Another Team
              </a>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-xmark text-3xl text-red-400"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-3">Payment Failed</h1>
              <p className="text-ink-faint text-sm mb-6">
                Your payment could not be processed. No amount has been deducted.
                Please try again or contact support if the issue persists.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setStep(2); setForm(f => ({ ...f, declarationAccepted: false, termsAccepted: false })); window.history.replaceState({}, '', '/hackathon'); }}
                  className="px-6 py-3 rounded-lg bg-brand font-semibold text-white text-sm shadow transition">
                  Try Again
                </button>
                <a href="/" className="px-6 py-3 rounded-lg border border-gray-200 text-ink-faint text-sm hover:text-gray-700 hover:border-gray-300 transition">
                  Go Home
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- DEADLINE PASSED ----------
  if (isDeadlinePassed) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="rounded-lg bg-white border border-gray-200 p-10 max-w-lg w-full text-center shadow-lg">
          <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-clock text-3xl text-amber-400"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Registration Closed</h1>
          <p className="text-ink-faint text-sm mb-6">
            The registration deadline for <span className="text-brand font-semibold">IGNITE PVPIT 2026</span> has been reached.
            We are no longer accepting new registrations.
          </p>
          <p className="text-xs text-ink-muted mb-6">
            If you have already registered, your participation is confirmed. For any queries, contact the organizers.
          </p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand font-semibold text-white text-sm shadow transition">
            <i className="fa-solid fa-arrow-left"></i> Go Home
          </a>
        </div>
      </div>
    );
  }

  // ---------- WIZARD ----------
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Team Leader Details</h2>
          <p className="text-xs text-ink-muted mb-4">Tell us about the team leader.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name {reqMark}</label>
              <input className={inputClass} value={form.leaderFirstName} onChange={e => set('leaderFirstName', e.target.value)} placeholder="John" maxLength={50} />
            </div>
            <div>
              <label className={labelClass}>Last Name {reqMark}</label>
              <input className={inputClass} value={form.leaderLastName} onChange={e => set('leaderLastName', e.target.value)} placeholder="Doe" maxLength={50} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Personal Email {reqMark}</label>
            <p className="text-[12px] text-ink-muted mt-1">Confirmation details will be sent here.</p>
            <input type="email" className={inputClass} value={form.leaderEmail} onChange={e => set('leaderEmail', e.target.value)} placeholder="john@example.com" maxLength={100} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone Number {reqMark}</label>
              <input type="tel" className={inputClass} value={form.leaderPhone} onChange={e => set('leaderPhone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Branch {reqMark}</label>
              <select className={inputClass} value={form.leaderBranch} onChange={e => set('leaderBranch', e.target.value)}>
                <option value="">Select Branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Year of Study {reqMark}</label>
            <select className={inputClass} value={form.leaderYear} onChange={e => set('leaderYear', e.target.value)}>
              <option value="">Select Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      );

      case 1: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Team Details</h2>
          <p className="text-xs text-ink-muted mb-4">Add your team name and member details.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Team Name {reqMark}</label>
              <input className={inputClass} value={form.teamName} onChange={e => set('teamName', e.target.value)} placeholder="Team Alpha" maxLength={100} />
            </div>
            <div>
              <label className={labelClass}>Team Size {reqMark}</label>
              <select className={inputClass} value={form.teamSize} onChange={e => set('teamSize', Number(e.target.value))}>
                {[2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} members</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-paper-alt border border-line p-4 text-xs text-brand">
            <i className="fa-solid fa-circle-info mr-1.5"></i>
            Only one registration per group is required. Fill in details for all {form.teamSize} members including yourself as team leader.
          </div>

          {form.teamMembers.slice(0, form.teamSize - 1).map((member, i) => (
            <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Member {i + 2}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First Name {reqMark}</label>
                  <input className={inputClass} value={member.firstName} onChange={e => setMember(i, 'firstName', e.target.value)} placeholder="First name" maxLength={50} />
                </div>
                <div>
                  <label className={labelClass}>Last Name {reqMark}</label>
                  <input className={inputClass} value={member.lastName} onChange={e => setMember(i, 'lastName', e.target.value)} placeholder="Last name" maxLength={50} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Email {reqMark}</label>
                  <input type="email" className={inputClass} value={member.email} onChange={e => setMember(i, 'email', e.target.value)} placeholder="member@example.com" maxLength={100} />
                </div>
                <div>
                  <label className={labelClass}>Phone {reqMark}</label>
                  <input type="tel" className={inputClass} value={member.phone} onChange={e => setMember(i, 'phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Branch {reqMark}</label>
                  <select className={inputClass} value={member.branch} onChange={e => setMember(i, 'branch', e.target.value)}>
                    <option value="">Select Branch</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Year {reqMark}</label>
                  <select className={inputClass} value={member.year} onChange={e => setMember(i, 'year', e.target.value)}>
                    <option value="">Select Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

      case 2: return (
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Declaration & Payment</h2>
          <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-1">
            <i className="fa-solid fa-circle-info mr-1.5"></i>
            Please read and accept the terms below before proceeding to payment.
          </p>

          <div className="rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
            <div className="sticky top-0 z-10 bg-white/95 border-b border-gray-200 px-4 py-2.5">
              <h3 className="text-sm font-bold text-gray-700">IGNITE PVPIT 2026 &mdash; Terms & Conditions</h3>
            </div>
            <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2">
              <ol className="text-xs text-ink-faint list-decimal list-inside space-y-1.5">
                {TERMS.map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.declarationAccepted} onChange={e => set('declarationAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-white text-brand focus:ring-brand/20 shrink-0" />
              <span className="text-xs text-ink-faint group-hover:text-ink-faint transition">
                I hereby declare that all the information provided by our team is true and correct to the best of our knowledge and belief. {reqMark}
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.termsAccepted} onChange={e => set('termsAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-white text-brand focus:ring-brand/20 shrink-0" />
              <span className="text-xs text-ink-faint group-hover:text-ink-faint transition">
                I have read, understood, and agree to the Terms & Conditions mentioned above. {reqMark}
              </span>
            </label>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-paper-alt border border-line text-brand text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
            Register for Hackathon
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-800">
            <span className="bg-brand bg-clip-text text-transparent">IGNITE PVPIT 2026</span>
          </h1>
          <p className="text-ink-faint text-sm mt-2">48-Hour Online Hackathon &mdash; Build Solutions for Real-Life Problems</p>
        </div>

        {/* Hackathon Info Section */}
        <div className="rounded-lg bg-white border border-gray-200 p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-fire text-orange-400"></i> About IGNITE PVPIT 2026
          </h2>
          <p className="text-sm text-ink-faint mb-5">
            Think you have what it takes to turn an idea into a working product? Participate in <strong>IGNITE PVPIT 2026</strong>, a 48-hour online hackathon where you&apos;ll solve real-world problems by building innovative web applications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Timeline */}
            <div className="rounded-lg bg-paper-alt border border-line p-4">
              <h3 className="text-sm font-bold text-brand mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-calendar-days text-xs"></i> Timeline
              </h3>
              <ul className="text-xs text-ink-faint space-y-1.5">
                <li><span className="font-medium text-gray-700">Last Date to Register:</span> 01/08/2026, 8:00 PM</li>
                <li><span className="font-medium text-gray-700">Hackathon Starts:</span> 01/08/2026, 9:00 PM</li>
                <li><span className="font-medium text-gray-700">Hackathon Ends:</span> 03/08/2026, 9:00 PM</li>
                <li><span className="font-medium text-gray-700">Submission Deadline:</span> 03/08/2026, 11:59 PM</li>
              </ul>
            </div>

            {/* Eligibility & Team */}
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-users text-xs"></i> Eligibility & Team
              </h3>
              <ul className="text-xs text-ink-faint space-y-1.5">
                <li><span className="font-medium text-gray-700">Mode:</span> Online (Build from Home)</li>
                <li><span className="font-medium text-gray-700">Eligibility:</span> Open to all branches & years, exclusively for PVPIT students</li>
                <li><span className="font-medium text-gray-700">Team Size:</span> 2 to 5 members</li>
                <li><span className="font-medium text-gray-700">Fee:</span> ₹100 per group (non-refundable)</li>
              </ul>
            </div>

            {/* Theme & Submissions */}
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-4">
              <h3 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-code text-xs"></i> Theme & Submissions
              </h3>
              <ul className="text-xs text-ink-faint space-y-1.5">
                <li>Develop a <span className="font-medium text-gray-700">web application</span> that solves the given problem statement</li>
                <li><span className="font-medium text-gray-700">Submit:</span> Public GitHub repo + screen recording</li>
                <li><span className="font-medium text-gray-700">AI Policy:</span> AI tools, LLMs, and AI coding agents are permitted</li>
              </ul>
            </div>

            {/* Prizes */}
            <div className="rounded-lg bg-paper-alt border border-line p-4">
              <h3 className="text-sm font-bold text-brand mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-trophy text-xs"></i> Prize Pool
              </h3>
              <ul className="text-xs text-ink-faint space-y-1.5">
                <li><span className="text-yellow-500 font-bold">1st Place</span> &mdash; ₹1,500</li>
                <li><span className="text-ink-muted font-bold">2nd Place</span> &mdash; ₹1,000</li>
                <li><span className="text-orange-400 font-bold">3rd Place</span> &mdash; ₹500</li>
              </ul>
            </div>
          </div>

          {/* Judging Criteria */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-5">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-star text-xs text-yellow-400"></i> Judging Criteria
            </h3>
            <ul className="text-xs text-ink-faint space-y-1">
              <li>1. How effectively the project solves the given problem statement</li>
              <li>2. Originality and innovation</li>
              <li>3. UI/UX and overall user experience</li>
            </ul>
          </div>

          {/* Contact & Links */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 rounded-lg bg-white border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-phone text-xs text-green-500"></i> Contact
              </h3>
              <ul className="text-xs text-ink-faint space-y-1">
                <li>Om Karande: +91 93226 11145</li>
                <li>Soham Phatak: +91 74987 87848</li>
                <li>Email: team@imergene.in</li>
              </ul>
            </div>
            <div className="flex-1 rounded-lg bg-white border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-link text-xs text-brand"></i> Links
              </h3>
              <ul className="text-xs text-ink-faint space-y-1.5">
                <li>
                  <a href="https://chat.whatsapp.com/HHRjpE4pPH61nwDVTvDw2B" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand underline">
                    Join the WhatsApp Group
                  </a>
                </li>
                <li>
                  <a href="https://www.imergene.in" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand underline">
                    Checkout the Imergene Website
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
                  i < step ? 'bg-green-100 border border-green-300 text-green-600'
                  : i === step ? 'bg-paper-alt border border-brand text-brand shadow-lg shadow-sm'
                  : 'bg-paper-alt border border-gray-200 text-ink-muted'
                }`}>
                  {i < step ? <i className="fa-solid fa-check text-[10px]"></i> : i + 1}
                </div>
                <span className={`text-[10px] mt-1.5 font-medium hidden sm:block ${
                  i <= step ? 'text-ink-faint' : 'text-ink-muted'
                }`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 mt-[-14px] sm:mt-0 transition-all duration-300 ${
                  i < step ? 'bg-green-300' : 'bg-paper-sunken'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-lg bg-white border border-gray-200 p-6 sm:p-8 shadow-lg">
          {renderStep()}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
            {step > 0 ? (
              <button onClick={prevStep} className="px-5 py-2.5 rounded-lg border border-gray-200 text-ink-faint text-sm font-medium hover:text-gray-700 hover:border-gray-300 transition flex items-center gap-2">
                <i className="fa-solid fa-arrow-left text-xs"></i> Back
              </button>
            ) : <div></div>}

            {step < 2 ? (
              <button onClick={nextStep} className="px-6 py-2.5 rounded-lg bg-brand font-semibold text-white text-sm shadow transition flex items-center gap-2">
                Next <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            ) : (
              <button onClick={handlePayment} disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-brand font-semibold text-white text-sm shadow transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> Pay {HACKATHON_FEE_STR} &amp; Register
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-ink-muted mt-4">
          Secured by <span className="text-ink-faint font-semibold">PayU Payments</span>. Your data is encrypted.
        </p>
      </div>
    </div>
  );
}
