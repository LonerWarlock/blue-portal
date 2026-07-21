'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { INTERNSHIP_FEE_STR } from './config';

type PaymentResult = 'success' | 'failed' | null;

const DEGREES = [
  'B.Tech', 'B.E.', 'BCA', 'B.Sc', 'BCS', 'B.Com', 'BBA', 'BA', 'B.Design', 'B.Pharm',
  'M.Tech', 'M.E.', 'MCA', 'M.Sc', 'MCS', 'M.Com', 'MBA', 'MA', 'M.Design',
  'Ph.D', 'Diploma', 'Other',
];

const TERMS = (fee: string) => [
  `A non-refundable registration fee of ${fee} is required to confirm your internship registration with Imergene.`,
  "The registration fee is strictly non-refundable under all circumstances, including voluntary withdrawal, failure to complete the internship, termination due to misconduct, or any other reason.",
  "The total internship duration is 60 hours, divided into structured lectures and self-paced project work to be completed at your own end.",
  "You must complete all 60 hours, attend scheduled lectures, and submit all assigned project work to be eligible for a completion certificate.",
  "Early termination or failure to complete the internship will not entitle you to any refund.",
  "All information provided during registration must be true and accurate. False or misleading information may result in termination.",
  "You agree to abide by all rules, regulations, and code of conduct prescribed by Imergene during the internship.",
  "You agree to maintain confidentiality of all proprietary information, data, and trade secrets encountered during the internship.",
  "All work product, code, designs, and deliverables created during the internship shall be the intellectual property of Imergene.",
  "This internship does not guarantee or imply any promise of future employment with Imergene.",
  "A completion certificate will be issued only upon successful completion of the full 60-hour internship duration, attendance of lectures, and satisfactory performance.",
  "Any disputes arising from this registration shall be subject to the jurisdiction of courts in India.",
];

const STEPS = ['Personal', 'Address', 'Academics', 'Skills', 'Declaration'];

const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition placeholder:text-gray-600';
const labelClass = 'block text-sm font-medium text-gray-400 mb-1.5';
const reqMark = <span className="text-red-400 ml-0.5">*</span>;

interface FormData {
  firstName: string; lastName: string; dateOfBirth: string; gender: string;
  email: string; phone: string; alternatePhone: string;
  fatherName: string; motherName: string;
  currentAddress: string; currentCity: string; currentState: string; currentPin: string;
  permanentAddress: string; permanentCity: string; permanentState: string; permanentPin: string;
  degree: string; branch: string; collegeName: string; universityName: string;
  yearStart: string; yearEnd: string; cgpa: string; backlogs: string;
  technicalSkills: string; programmingLanguages: string; previousInternships: string;
  githubUrl: string; portfolioUrl: string;
  declarationAccepted: boolean; termsAccepted: boolean;
}

const initial: FormData = {
  firstName: '', lastName: '', dateOfBirth: '2005-01-01', gender: '',
  email: '', phone: '', alternatePhone: '',
  fatherName: '', motherName: '',
  currentAddress: '', currentCity: '', currentState: '', currentPin: '',
  permanentAddress: '', permanentCity: '', permanentState: '', permanentPin: '',
  degree: '', branch: '', collegeName: '', universityName: '',
  yearStart: '', yearEnd: '', cgpa: '', backlogs: '0',
  technicalSkills: '', programmingLanguages: '', previousInternships: '',
  githubUrl: '', portfolioUrl: '',
  declarationAccepted: false, termsAccepted: false,
};

const STORAGE_KEY = 'imergene_intern_registrations';

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
  return 'int_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export default function InternshipsPage() {
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get('payment') as PaymentResult;
  const txnid = searchParams.get('txnid');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyPermAddr, setCopyPermAddr] = useState(false);
  const [resultData, setResultData] = useState<{ name: string; email: string } | null>(null);

  // On success, read from localStorage to show confirmation
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

  useEffect(() => {
    if (copyPermAddr) {
      setForm(f => ({
        ...f,
        permanentAddress: f.currentAddress,
        permanentCity: f.currentCity,
        permanentState: f.currentState,
        permanentPin: f.currentPin,
      }));
    }
  }, [copyPermAddr, form.currentAddress, form.currentCity, form.currentState, form.currentPin]);

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!form.firstName.trim()) return 'First name is required.';
        if (form.firstName.trim().length < 2) return 'First name must be at least 2 characters.';
        if (!form.lastName.trim()) return 'Last name is required.';
        if (form.lastName.trim().length < 2) return 'Last name must be at least 2 characters.';
        if (!form.dateOfBirth) return 'Date of birth is required.';
        const dob = new Date(form.dateOfBirth);
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 16 || age > 30) return 'Age must be between 16 and 30 years.';
        if (!form.gender) return 'Please select your gender.';
        if (!form.email.trim()) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
        if (!form.phone.trim()) return 'Phone number is required.';
        if (!/^\d{10}$/.test(form.phone.trim())) return 'Phone number must be exactly 10 digits.';
        if (form.alternatePhone && !/^\d{10}$/.test(form.alternatePhone.trim())) return 'Alternate phone must be exactly 10 digits.';
        if (!form.fatherName.trim()) return "Father's name is required.";
        if (!form.motherName.trim()) return "Mother's name is required.";
        return null;
      case 1:
        if (!form.currentAddress.trim()) return 'Current street address is required.';
        if (!form.currentCity.trim()) return 'Current city is required.';
        if (!form.currentState.trim()) return 'Current state is required.';
        if (!/^\d{6}$/.test(form.currentPin.trim())) return 'Current PIN code must be exactly 6 digits.';
        if (!form.permanentAddress.trim()) return 'Permanent street address is required.';
        if (!form.permanentCity.trim()) return 'Permanent city is required.';
        if (!form.permanentState.trim()) return 'Permanent state is required.';
        if (!/^\d{6}$/.test(form.permanentPin.trim())) return 'Permanent PIN code must be exactly 6 digits.';
        return null;
      case 2:
        if (!form.degree) return 'Please select your degree.';
        if (!form.branch.trim()) return 'Branch / specialization is required.';
        if (!form.collegeName.trim()) return 'College name is required.';
        if (form.collegeName.trim().length < 5) return 'Please enter the complete college name (e.g., "Indian Institute of Technology, Mumbai").';
        if (!form.universityName.trim()) return 'University name is required.';
        if (!form.yearStart) return 'Year of starting is required.';
        if (!form.yearEnd) return 'Year of completion is required.';
        if (Number(form.yearStart) >= Number(form.yearEnd)) return 'Year of completion must be after year of starting.';
        if (!form.cgpa.trim()) return 'CGPA / percentage is required.';
        if (form.backlogs === '' || form.backlogs === null) return 'Please enter the number of backlogs (0 if none).';
        return null;
      case 3:
        if (!form.technicalSkills.trim()) return 'Technical skills are required.';
        if (form.technicalSkills.trim().length < 3) return 'Please enter at least one technical skill.';
        if (form.githubUrl && !/^https:\/\/.+/.test(form.githubUrl.trim())) return 'GitHub URL must start with https://';
        if (form.portfolioUrl && !/^https:\/\/.+/.test(form.portfolioUrl.trim())) return 'Portfolio URL must start with https://';
        return null;
      case 4:
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
    setStep(s => Math.min(s + 1, 4));
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
      const hashRes = await fetch('/api/internships/payu/create-hash', {
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
        phone: form.phone,
        surl: `${window.location.origin}/api/internships/payu/callback`,
        furl: `${window.location.origin}/api/internships/payu/callback`,
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
      <div className="min-h-screen bg-[#030712] flex items-center justify-center px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
        </div>
        <div className="rounded-2xl glass border border-gray-800/80 p-10 max-w-lg w-full text-center relative z-10 shadow-2xl">
          {paymentResult === 'success' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-950/60 border border-green-800/60 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-check text-3xl text-green-400"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-100 mb-3">Registration Complete!</h1>
              <p className="text-gray-400 text-sm mb-6">
                Your internship registration with <span className="text-blue-400 font-semibold">Imergene</span> has been confirmed.
                You will receive further details at your registered email address.
              </p>
              <div className="rounded-xl bg-gray-900/40 border border-gray-800/80 p-4 text-left text-xs text-gray-400 space-y-1 mb-6">
                {resultData && (
                  <>
                    <p><span className="text-gray-500">Name:</span> <span className="text-gray-200">{resultData.name}</span></p>
                    <p><span className="text-gray-500">Email:</span> <span className="text-gray-200">{resultData.email}</span></p>
                  </>
                )}
                <p><span className="text-gray-500">Amount Paid:</span> <span className="text-green-400 font-semibold">{INTERNSHIP_FEE_STR}</span></p>
              </div>
              <a href="/internships" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition">
                <i className="fa-solid fa-arrow-left"></i> Register Another Intern
              </a>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-xmark text-3xl text-red-400"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-100 mb-3">Payment Failed</h1>
              <p className="text-gray-400 text-sm mb-6">
                Your payment could not be processed. No amount has been deducted.
                Please try again or contact support if the issue persists.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setStep(4); setForm(f => ({ ...f, declarationAccepted: false, termsAccepted: false })); window.history.replaceState({}, '', '/internships'); }}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition">
                  Try Again
                </button>
                <a href="/" className="px-6 py-3 rounded-xl border border-gray-800 text-gray-400 text-sm hover:text-gray-200 hover:border-gray-600 transition">
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
          <h2 className="text-lg font-bold text-gray-100 mb-1">Personal Details</h2>
          <p className="text-xs text-gray-500 mb-4">Tell us about yourself.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date of Birth {reqMark}</label>
              <input type="date" className={inputClass} value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className={labelClass}>Gender {reqMark}</label>
              <select className={inputClass} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Personal Email {reqMark}</label>
            <p className="text-[12px] text-gray-300 mt-1">Please provide correct email address. Form confirmation details will be sent here.</p>
            <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" maxLength={100} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone Number {reqMark}</label>
              <input type="tel" className={inputClass} value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Alternate Phone</label>
              <input type="tel" className={inputClass} value={form.alternatePhone} onChange={e => set('alternatePhone', e.target.value.replace(/\D/g, ''))} placeholder="Optional" maxLength={10} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Father&apos;s Name {reqMark}</label>
              <input className={inputClass} value={form.fatherName} onChange={e => set('fatherName', e.target.value)} placeholder="Father's full name" maxLength={100} />
            </div>
            <div>
              <label className={labelClass}>Mother&apos;s Name {reqMark}</label>
              <input className={inputClass} value={form.motherName} onChange={e => set('motherName', e.target.value)} placeholder="Mother's full name" maxLength={100} />
            </div>
          </div>
        </div>
      );

      case 1: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-100 mb-1">Address Details</h2>
          <p className="text-xs text-gray-500 mb-4">Your current and permanent address.</p>

          <div className="rounded-xl bg-gray-900/40 border border-gray-800/80 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Current Address</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Street Address {reqMark}</label>
                <textarea rows={2} className={inputClass} value={form.currentAddress} onChange={e => set('currentAddress', e.target.value)} placeholder="House No, Street, Locality" maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>City {reqMark}</label>
                  <input className={inputClass} value={form.currentCity} onChange={e => set('currentCity', e.target.value)} maxLength={50} />
                </div>
                <div>
                  <label className={labelClass}>State {reqMark}</label>
                  <input className={inputClass} value={form.currentState} onChange={e => set('currentState', e.target.value)} maxLength={50} />
                </div>
              </div>
              <div>
                <label className={labelClass}>PIN Code {reqMark}</label>
                <input className={inputClass} value={form.currentPin} onChange={e => set('currentPin', e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="6 digits" />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={copyPermAddr} onChange={e => setCopyPermAddr(e.target.checked)}
              className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/30" />
            <span className="text-xs text-gray-400">Permanent address is the same as current</span>
          </label>

          <div className="rounded-xl bg-gray-900/40 border border-gray-800/80 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Permanent Address</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Street Address {reqMark}</label>
                <textarea rows={2} className={inputClass} value={form.permanentAddress} onChange={e => set('permanentAddress', e.target.value)} placeholder="House No, Street, Locality" maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>City {reqMark}</label>
                  <input className={inputClass} value={form.permanentCity} onChange={e => set('permanentCity', e.target.value)} maxLength={50} />
                </div>
                <div>
                  <label className={labelClass}>State {reqMark}</label>
                  <input className={inputClass} value={form.permanentState} onChange={e => set('permanentState', e.target.value)} maxLength={50} />
                </div>
              </div>
              <div>
                <label className={labelClass}>PIN Code {reqMark}</label>
                <input className={inputClass} value={form.permanentPin} onChange={e => set('permanentPin', e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="6 digits" />
              </div>
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-100 mb-1">UG Academic Details</h2>
          <p className="text-xs text-gray-500 mb-4">Your undergraduate education information.</p>
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
            <label className={labelClass}>College Name {reqMark}</label>
            <p className="text-[12px] text-gray-300 mt-1">Please write the complete college name including city</p>
            <input className={inputClass} value={form.collegeName} onChange={e => set('collegeName', e.target.value)} placeholder="e.g., Indian Institute of Technology, Mumbai" maxLength={200} />
            
          </div>
          <div>
            <label className={labelClass}>University Name {reqMark}</label>
            <p className="text-[12px] text-gray-300 mt-1">Please write the complete university name including city</p>
            <input className={inputClass} value={form.universityName} onChange={e => set('universityName', e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Year of Starting {reqMark}</label>
              <input type="number" min="2000" max="2030" className={inputClass} value={form.yearStart} onChange={e => set('yearStart', e.target.value)} placeholder="2022" />
            </div>
            <div>
              <label className={labelClass}>Year of Completion {reqMark}</label>
              <input type="number" min="2000" max="2035" className={inputClass} value={form.yearEnd} onChange={e => set('yearEnd', e.target.value)} placeholder="2026" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CGPA / Percentage {reqMark}</label>
              <input className={inputClass} value={form.cgpa} onChange={e => set('cgpa', e.target.value)} placeholder="8.5 or 85%" maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Backlogs {reqMark}</label>
              <input type="number" min="0" className={inputClass} value={form.backlogs} onChange={e => set('backlogs', e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-100 mb-1">Skills & Experience</h2>
          <p className="text-xs text-gray-500 mb-4">Tell us about your technical skills and background.</p>
          <div>
            <label className={labelClass}>Technical Skills {reqMark} <span className="text-gray-300 font-normal">(comma-separated)</span></label>
            <input className={inputClass} value={form.technicalSkills} onChange={e => set('technicalSkills', e.target.value)} placeholder="React, Python, Node.js, MongoDB" maxLength={500} />
          </div>
          <div>
            <label className={labelClass}>Programming Languages <span className="text-gray-300 font-normal">(comma-separated)</span></label>
            <input className={inputClass} value={form.programmingLanguages} onChange={e => set('programmingLanguages', e.target.value)} placeholder="JavaScript, Python, Java, C++, TypeScript" maxLength={500} />
            <p className="text-[12px] text-gray-300 mt-1">List programming languages you know</p>
          </div>
          <div>
            <label className={labelClass}>Previous Internships</label>
            <textarea rows={3} className={inputClass} value={form.previousInternships} onChange={e => set('previousInternships', e.target.value)} placeholder="Briefly describe any previous internship experience (company, role, duration)..." maxLength={1000} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>GitHub Profile</label>
              <input type="url" className={inputClass} value={form.githubUrl} onChange={e => set('githubUrl', e.target.value)} placeholder="https://github.com/username" maxLength={200} />
            </div>
            <div>
              <label className={labelClass}>Portfolio / Website</label>
              <input type="url" className={inputClass} value={form.portfolioUrl} onChange={e => set('portfolioUrl', e.target.value)} placeholder="https://yoursite.com" maxLength={200} />
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-100 mb-1">Declaration & Payment</h2>
          <p className="text-[11px] font-semibold text-yellow-400/90 bg-yellow-950/30 border border-yellow-800/40 rounded-lg px-4 py-2.5 mb-1">
            <i className="fa-solid fa-circle-info mr-1.5"></i>
            Please read and accept the terms below before proceeding to payment.
          </p>

          <div className="rounded-xl bg-gray-900/40 border border-gray-800/80 overflow-hidden">
            <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/80 px-4 py-2.5">
              <h3 className="text-sm font-bold text-gray-200">Imergene — Internship Registration Terms & Conditions</h3>
            </div>
            <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2">
              <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1.5">
                {TERMS(INTERNSHIP_FEE_STR).map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.declarationAccepted} onChange={e => set('declarationAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/30 shrink-0" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition">
                I hereby declare that all the information provided by me is true and correct to the best of my knowledge and belief. {reqMark}
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={form.termsAccepted} onChange={e => set('termsAccepted', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/30 shrink-0" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition">
                I have read, understood, and agree to the Terms & Conditions mentioned above. {reqMark}
              </span>
            </label>
          </div>

          
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Imergene Internship Program
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">Register for </span>
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Internship</span>
          </h1>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-1 mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  i < step ? 'bg-green-950/60 border border-green-800/60 text-green-400'
                  : i === step ? 'bg-blue-950/60 border border-blue-800/60 text-blue-400 shadow-lg shadow-blue-500/20'
                  : 'bg-gray-900/60 border border-gray-800 text-gray-600'
                }`}>
                  {i < step ? <i className="fa-solid fa-check text-[10px]"></i> : i + 1}
                </div>
                <span className={`text-[10px] mt-1.5 font-medium hidden sm:block ${
                  i <= step ? 'text-gray-400' : 'text-gray-700'
                }`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-2 mt-[-14px] sm:mt-0 transition-all duration-300 ${
                  i < step ? 'bg-green-800/60' : 'bg-gray-800/60'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl glass border border-gray-800/80 p-6 sm:p-8 shadow-2xl">
          {renderStep()}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-800/50 text-red-400 text-xs flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-800/80">
            {step > 0 ? (
              <button onClick={prevStep} className="px-5 py-2.5 rounded-xl border border-gray-800 text-gray-400 text-sm font-medium hover:text-gray-200 hover:border-gray-600 transition flex items-center gap-2">
                <i className="fa-solid fa-arrow-left text-xs"></i> Back
              </button>
            ) : <div></div>}

            {step < 4 ? (
              <button onClick={nextStep} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition flex items-center gap-2">
                Next <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            ) : (
              <button onClick={handlePayment} disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white text-sm shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i> Pay {INTERNSHIP_FEE_STR} &amp; Register
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-4">
          Secured by <span className="text-gray-500 font-semibold">PayU Payments</span>. Your data is encrypted.
        </p>
      </div>
    </div>
  );
}
