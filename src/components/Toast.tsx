import React, { useEffect } from 'react';
import { Lock, Sparkles, AlertCircle, X, CheckCircle2, Mail } from 'lucide-react';
import { CONTACT_EMAIL, PREMIUM_PRICE_TEXT } from '../utils/constants';

interface ToastProps {
  message: string;
  type?: 'lock' | 'success' | 'info' | 'error';
  onClose: () => void;
  onUpgradeClick?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  onUpgradeClick,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md animate-slideUp">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
          type === 'lock'
            ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
            : type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
            : type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
            : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-100'
        }`}
      >
        <div className="mt-0.5 flex-shrink-0">
          {type === 'lock' && <Lock className="w-5 h-5 text-amber-400" />}
          {type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
          {type === 'info' && <Sparkles className="w-5 h-5 text-indigo-400" />}
        </div>

        <div className="flex-1 text-xs sm:text-sm font-medium leading-normal">
          <p>{message}</p>
          {type === 'error' && (
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 text-xs font-semibold text-rose-200 hover:text-white underline inline-flex items-center gap-1 block"
            >
              <Mail className="w-3 h-3" />
              <span>Contact Support: {CONTACT_EMAIL}</span>
            </a>
          )}
          {type === 'lock' && onUpgradeClick && (
            <button
              onClick={() => {
                onUpgradeClick();
                onClose();
              }}
              className="mt-2 text-xs font-bold text-amber-300 hover:text-white underline block cursor-pointer"
            >
              Upgrade to Premium ({PREMIUM_PRICE_TEXT}) Now →
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
