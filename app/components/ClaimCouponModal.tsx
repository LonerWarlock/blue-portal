'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ClaimCouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number, rewardAmount: number) => void;
}

export default function ClaimCouponModal({ isOpen, onClose, onSuccess }: ClaimCouponModalProps) {
  const { invalidateAccount } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!couponCode.trim()) {
      setError('Please enter a coupon code.');
      return;
    }

    setLoading(true);
    setError('');
    let attempted = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session has expired. Please log in again.');
        setLoading(false);
        return;
      }

      attempted = true;
      const res = await fetch('/api/user/claim-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ couponCode: couponCode.trim() })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to claim coupon code');
      }

      setCouponCode('');
      onSuccess(data.newBalance, data.rewardAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      // A response can be lost after the transaction commits. Revalidate even
      // on an uncertain transport failure instead of displaying an old balance.
      if (attempted) void invalidateAccount();
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-terminal/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md rounded-xl panel border border-line p-6 sm:p-7 relative overflow-hidden shadow-2xl transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand via-indigo-500 to-purple-500"></div>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/30 text-brand flex items-center justify-center shrink-0">
              <i className="fa-solid fa-[#000] fa-ticket text-lg"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink tracking-tight">Claim IMR Coupon</h3>
              <p className="text-xs text-ink-muted">Enter your promo code to credit IMR</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-sunken transition"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleClaim} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
              Coupon Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  if (error) setError('');
                }}
                placeholder="e.g. WELCOME100"
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-paper-alt border border-line text-ink font-mono text-sm tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition disabled:opacity-50"
              />
              {couponCode && (
                <button
                  type="button"
                  onClick={() => setCouponCode('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs flex items-start gap-2 animate-shake">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* IMR Plan Usage Notice */}
          <div className="p-3.5 rounded-lg bg-paper-alt border border-line text-xs text-ink-muted space-y-1">
            <div className="flex items-center gap-1.5 text-brand font-semibold">
              <i className="fa-solid fa-circle-info text-[11px]"></i>
              <span>IMR Usage Note</span>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              IMR credits are exclusively valid towards <strong className="text-ink font-semibold">Blue&apos;s ₹149/month subscription plan</strong> (not applicable for Blue Pro PAYG). Max 100 IMR (₹50 discount) per subscription billing.
            </p>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-line text-xs font-semibold text-ink-muted hover:text-ink hover:bg-paper-sunken transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !couponCode.trim()}
              className="flex-1 py-2.5 rounded-lg bg-brand text-xs font-semibold text-white shadow-md hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                  <span>Claiming…</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-gift text-xs"></i>
                  <span>Claim IMR Credits</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
