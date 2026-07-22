import React, { useState } from 'react';
import { X, Crown, Check, Shield, CreditCard, ArrowRight, Zap, Sparkles, ExternalLink, AlertCircle, Mail } from 'lucide-react';
import confetti from 'canvas-confetti';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { updateUserPremiumStatus } from '../lib/supabase';
import { openPaddleCheckout, paddleClientToken, paddlePriceId } from '../lib/paddle';
import { CONTACT_EMAIL } from '../utils/constants';

interface SubscriptionModalProps {
  isOpen: boolean;
  user?: SupabaseUser | null;
  onClose: () => void;
  onSubscribeSuccess: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  user,
  onClose,
  onSubscribeSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [paddleLoading, setPaddleLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPaddleConfigured = Boolean(paddleClientToken && paddlePriceId);

  React.useEffect(() => {
    if (isOpen && !isPaddleConfigured) {
      console.warn('[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing or not configured.');
    }
  }, [isOpen, isPaddleConfigured]);

  const handlePaddleSubscribe = async () => {
    setPaddleLoading(true);
    setStatusNotice(null);

    const userId = user?.id || 'demo_user_' + Date.now();
    const userEmail = user?.email || undefined;

    const opened = await openPaddleCheckout({
      userId,
      userEmail,
      onSuccess: async () => {
        if (user) {
          await updateUserPremiumStatus(user.id, true, user.email);
        }
        try {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } catch (e) {}
        onSubscribeSuccess();
        onClose();
      },
    });

    setPaddleLoading(false);

    if (!opened) {
      if (!isPaddleConfigured) {
        console.warn('[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing or not configured.');
        setStatusNotice('Showing direct upgrade option below.');
      } else {
        setStatusNotice('Could not open Paddle checkout. Check console or credentials.');
      }
    } else {
      setStatusNotice('Paddle Checkout opened! Complete payment in the overlay window.');
    }
  };

  const handleQuickFillCard = () => {
    setCardNumber('4242 •••• •••• 4242');
    setExpDate('12/28');
    setCvc('888');
    setName(user?.email ? user.email.split('@')[0] : 'Alex Johnson');
  };

  const handleSubscribeDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Update user's is_premium status in Supabase profiles table if logged in
    if (user) {
      await updateUserPremiumStatus(user.id, true, user.email);
    }

    // Simulate payment gateway completion
    setTimeout(() => {
      setLoading(false);

      // Fire victory confetti celebration
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.log('Confetti triggered');
      }

      onSubscribeSuccess();
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Top Header Banner */}
        <div className="relative p-6 bg-gradient-to-br from-indigo-900/80 via-purple-900/60 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Paddle Billing & Premium Tier</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            Upgrade to ScribeSwift Premium
          </h2>
          <p className="text-sm text-indigo-200/80 mt-1">
            Unlimited copy, instant export to SRT/VTT/PDF/TXT, and print features.
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white">$1</span>
            <span className="text-slate-300 text-sm font-medium">/ month</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              Cancel anytime
            </span>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="p-6 space-y-5">
          {statusNotice && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>{statusNotice}</span>
            </div>
          )}

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Included in $1/mo Premium Plan
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-slate-200">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong className="text-white">Copy Text & Keyboard Shortcuts:</strong> Enable Ctrl+C and instant text copying
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-200">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong className="text-white">All Export Formats:</strong> TXT, Subtitle SRT, WebVTT, PDF & JSON
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-200">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong className="text-white">Print-Ready Reports:</strong> One-click formatted print generator
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-200">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>
                  <strong className="text-white">Up to 100MB File API:</strong> Audio & HD Video processing via Gemini File API
                </span>
              </div>
            </div>
          </div>

          {/* Primary Paddle Billing Button */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handlePaddleSubscribe}
              disabled={paddleLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {paddleLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Launching Paddle Checkout...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Upgrade with Paddle Billing ($1/mo)</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Or Instant Demo Upgrade
            </span>
          </div>

          {/* Direct Card Demo Payment Form */}
          <form onSubmit={handleSubscribeDirect} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>Direct Payment Simulation</span>
              </label>
              <button
                type="button"
                onClick={handleQuickFillCard}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                Auto-fill Card
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Cardholder Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Card Number (4242 ...)"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="MM / YY"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="CVC"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Supabase Profile...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  <span>Instant $1/mo Demo Activation</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Encrypted via Paddle & Supabase</span>
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline font-medium"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Support: {CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
