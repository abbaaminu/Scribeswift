import React, { useState } from 'react';
import { X, Crown, Check, Shield, Lock, CreditCard, Sparkles, ArrowRight, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribeSuccess: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribeSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'card' | 'quick'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleQuickFillCard = () => {
    setCardNumber('4242 •••• •••• 4242');
    setExpDate('12/28');
    setCvc('888');
    setName('Alex Johnson');
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate payment processing delay
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
    }, 1200);
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
            <span>Unlock Premium Access</span>
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

          {/* Payment Form (Stripe / Payment Gateway Simulation) */}
          <form onSubmit={handleSubscribe} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span>Payment Details (Stripe / Card Gateway)</span>
              </label>
              <button
                type="button"
                onClick={handleQuickFillCard}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline"
              >
                Auto-fill Demo Card
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Cardholder Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Card Number (e.g. 4242 4242 4242 4242)"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="MM / YY"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
                <input
                  type="text"
                  placeholder="CVC"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing $1.00 Subscription...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Subscribe Now for $1/Month</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>256-bit SSL Encrypted Payment Simulation</span>
          </p>
        </div>
      </div>
    </div>
  );
};
