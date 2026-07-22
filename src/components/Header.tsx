import React, { useState } from 'react';
import {
  Sparkles,
  Crown,
  ShieldCheck,
  History,
  Zap,
  Lock,
  User,
  LogOut,
  LogIn,
  ChevronDown,
} from 'lucide-react';
import { SubscriptionTier } from '../types';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  tier: SubscriptionTier;
  user: SupabaseUser | null;
  onOpenUpgradeModal: () => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
  onToggleHistory: () => void;
  historyCount: number;
  onToggleTier: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tier,
  user,
  onOpenUpgradeModal,
  onOpenAuthModal,
  onSignOut,
  onToggleHistory,
  historyCount,
  onToggleTier,
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const isPremium = tier === 'premium';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                ScribeSwift
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                100MB File API
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">AI Audio & Video Transcription Engine</p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Demo Tier Switcher (For testing/evaluating both modes easily) */}
          <button
            onClick={onToggleTier}
            title="Click to toggle between Free & $1/mo Premium test modes"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 transition cursor-pointer"
          >
            <span className="text-slate-500">Tier:</span>
            <span className={isPremium ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isPremium ? 'Premium ($1)' : 'Free'}
            </span>
          </button>

          {/* User Tier Status Badge & Upgrade Button */}
          {isPremium ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold hidden sm:inline">Premium Member</span>
            </div>
          ) : (
            <button
              onClick={onOpenUpgradeModal}
              className="group relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Upgrade to Premium</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">$1/mo</span>
            </button>
          )}

          {/* Supabase User Auth State / Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[100px] truncate hidden sm:inline">{user.email}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 animate-fadeIn text-slate-200">
                  <div className="px-3.5 py-2 border-b border-slate-800 space-y-0.5">
                    <p className="text-[11px] text-slate-400 font-medium">Signed in as</p>
                    <p className="text-xs font-bold text-white truncate">{user.email}</p>
                    <div className="pt-1 flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                        {isPremium ? 'Premium Plan ($1/mo)' : 'Free Tier'}
                      </span>
                    </div>
                  </div>

                  {!isPremium && (
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        onOpenUpgradeModal();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-800 flex items-center gap-2 transition"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upgrade Account ($1/mo)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      onSignOut();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-rose-300 hover:bg-slate-800 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sign In / Sign Up</span>
            </button>
          )}

          {/* History Button */}
          <button
            onClick={onToggleHistory}
            className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-800 hover:border-slate-700 cursor-pointer"
            title="Transcription History"
          >
            <History className="w-5 h-5" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
