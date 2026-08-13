import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { TranscriptView } from './components/TranscriptView';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HistoryDrawer } from './components/HistoryDrawer';
import { Toast } from './components/Toast';
import { SubscriptionTier, TranscriptionData } from './types';
import { Sparkles, Shield, Zap, FileAudio, Lock, Crown, ArrowLeft, Mail } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, fetchUserProfile, isSupabaseConfigured, fetchUserHistory, saveTranscriptionToHistory, clearUserHistory, updateUserPremiumStatus } from './lib/supabase';
import { CONTACT_EMAIL, PREMIUM_PRICE_TEXT } from './utils/constants';

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);

  const [tier, setTier] = useState<SubscriptionTier>(() => {
    const savedTier = localStorage.getItem('scribeswift_tier');
    return (savedTier as SubscriptionTier) || 'free';
  });

  const [history, setHistory] = useState<TranscriptionData[]>(() => {
    try {
      const savedHistory = localStorage.getItem('scribeswift_history');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeTranscription, setActiveTranscription] = useState<TranscriptionData | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: 'lock' | 'success' | 'info' | 'error';
  } | null>(null);

  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser && syncedUserIdRef.current !== currentUser.id) {
        syncedUserIdRef.current = currentUser.id;
        setIsAuthModalOpen(false);
        syncProfileTier(currentUser.id);
        syncHistoryForUser(currentUser.id);
      }
    });

    // We only want to (re)fetch profile/history on an actual new sign-in —
    // re-syncing on every background token refresh would overwrite
    // locally-added history with a possibly-stale Supabase read while a
    // save is still in flight.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setIsAuthModalOpen(false);
        if (syncedUserIdRef.current !== currentUser.id) {
          syncedUserIdRef.current = currentUser.id;
          await syncProfileTier(currentUser.id);
          await syncHistoryForUser(currentUser.id);
        }
      } else {
        syncedUserIdRef.current = null;
        const savedTier = (localStorage.getItem('scribeswift_tier') as SubscriptionTier) || 'free';
        setTier(savedTier);
        setHistory([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncProfileTier = async (userId: string) => {
    const profile = await fetchUserProfile(userId);
    if (profile && typeof profile.is_premium === 'boolean') {
      const userTier: SubscriptionTier = profile.is_premium ? 'premium' : 'free';
      setTier(userTier);
    }
  };

  // Load this account's transcription history from Supabase. If the account
  // has no saved history yet but this browser has guest history sitting in
  // localStorage, migrate it into the account once so nothing gets lost.
  const syncHistoryForUser = async (userId: string) => {
    const remoteHistory = await fetchUserHistory(userId);

    if (remoteHistory.length === 0) {
      let localHistory: TranscriptionData[] = [];
      try {
        const saved = localStorage.getItem('scribeswift_history');
        localHistory = saved ? JSON.parse(saved) : [];
      } catch (e) {
        localHistory = [];
      }

      if (localHistory.length > 0) {
        for (const item of localHistory) {
          await saveTranscriptionToHistory(userId, item);
        }
        setHistory(localHistory);
        localStorage.removeItem('scribeswift_history');
        return;
      }
    }

    setHistory(remoteHistory);
  };

  useEffect(() => {
    localStorage.setItem('scribeswift_tier', tier);
  }, [tier]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('scribeswift_history', JSON.stringify(history));
    }
  }, [history, user]);

  const handleToggleTier = async () => {
    const newTier: SubscriptionTier = tier === 'free' ? 'premium' : 'free';
    setTier(newTier);
    
    // If user is logged in, sync tier change to Supabase
    if (user && isSupabaseConfigured) {
      const isPremium = newTier === 'premium';
      await updateUserPremiumStatus(user.id, isPremium, user.email);
    }
    
    setToast({
      message: `Tier switched to ${newTier === 'premium' ? `Premium (${PREMIUM_PRICE_TEXT})` : 'Free Plan'}.`,
      type: newTier === 'premium' ? 'success' : 'info',
    });
  };

  const handleSubscribeSuccess = async () => {
    setTier('premium');
    
    // If user is logged in, sync premium status to Supabase
    if (user && isSupabaseConfigured) {
      await updateUserPremiumStatus(user.id, true, user.email);
    }
    
    setToast({
      message: `Congratulations! You are now subscribed to ScribeSwift Premium (${PREMIUM_PRICE_TEXT.replace('/mo', '/month')}). All copy, print, and export features unlocked!`,
      type: 'success',
    });
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setTier('free');
    setToast({ message: 'Signed out of ScribeSwift.', type: 'info' });
  };

  const handleLockedActionClick = (actionName: string) => {
    setToast({
      message: `${actionName} is locked on the Free Plan. Upgrade to Premium (${PREMIUM_PRICE_TEXT}) for full export & copy rights!`,
      type: 'lock',
    });
    setIsUpgradeModalOpen(true);
  };

  const handleTranscriptionComplete = (data: TranscriptionData) => {
    setActiveTranscription(data);
    setHistory((prev) => [data, ...prev.filter((h) => h.id !== data.id)]);
    if (user) {
      saveTranscriptionToHistory(user.id, data);
    }
    setToast({
      message: `Transcription complete for "${data.title}"!`,
      type: 'success',
    });
  };

  const handleClearHistory = async () => {
    if (user) {
      await clearUserHistory(user.id);
    } else {
      localStorage.removeItem('scribeswift_history');
    }
    setHistory([]);
    setToast({ message: 'Transcription history cleared.', type: 'info' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header
        tier={tier}
        user={user}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onToggleHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onToggleTier={handleToggleTier}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeTranscription ? (
          <div className="space-y-6 animate-fadeIn">
            <button
              onClick={() => setActiveTranscription(null)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Transcribe Another File</span>
            </button>

            <TranscriptView
              data={activeTranscription}
              tier={tier}
              onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
              onLockedActionClick={handleLockedActionClick}
              onCopySuccess={() => setToast({ message: 'Text copied to clipboard!', type: 'success' })}
            />
          </div>
        ) : (
          <div className="space-y-12 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Advanced AI Transcription (Up to 100MB)</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                AI Speech-to-Text & Transcript Summarizer
              </h1>

              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
                Upload podcasts, keynote lectures, meeting recordings, and videos up to <strong className="text-indigo-300">100MB</strong>. Get time-stamped text, multi-speaker recognition, and action items in seconds.
              </p>
            </div>

            {user || !isSupabaseConfigured ? (
              <FileUpload
                onTranscriptionComplete={handleTranscriptionComplete}
                onError={(msg) => setToast({ message: msg, type: 'error' })}
              />
            ) : (
              <div className="max-w-2xl mx-auto text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl p-10 sm:p-14 space-y-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-indigo-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Sign in to start transcribing
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Create a free account to upload audio and video, keep your transcription
                  history, and unlock the {PREMIUM_PRICE_TEXT} Premium plan whenever you're ready.
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Sign In / Sign Up - It's Free
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-900">
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">100MB Capacity Upgrade</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Built to process large 100MB audio and video files asynchronously without memory caps.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Free vs {PREMIUM_PRICE_TEXT} Premium Tier</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Free tier users preview full transcriptions. Upgrade for {PREMIUM_PRICE_TEXT} to unlock copy-paste, print formatting, and TXT/SRT/VTT downloads.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Time-Coded & Speakers</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Interactive timestamp synchronization jumps playback to exact moments, with multi-speaker detection and executive action item summaries.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>ScribeSwift AI Engine</span>
            <span className="hidden sm:inline text-slate-800">-</span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Support: {CONTACT_EMAIL}</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="text-indigo-400 hover:underline cursor-pointer"
              >
                Subscription Tier ({PREMIUM_PRICE_TEXT})
              </button>
            )}
            {!(import.meta as any).env?.PROD && (
              <button
                onClick={handleToggleTier}
                className="text-slate-400 hover:text-white underline cursor-pointer"
                title="Dev-only: bypasses payment for local testing"
              >
                Toggle Tier ({tier === 'premium' ? 'Premium' : 'Free'})
              </button>
            )}
          </div>
        </div>
      </footer>

      <ErrorBoundary fallbackTitle="Subscription Upgrade Notice" onReset={() => setIsUpgradeModalOpen(false)}>
        <SubscriptionModal
          isOpen={isUpgradeModalOpen}
          user={user}
          onClose={() => setIsUpgradeModalOpen(false)}
          onSubscribeSuccess={handleSubscribeSuccess}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Authentication Notice" onReset={() => setIsAuthModalOpen(false)}>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(msg) =>
            setToast({
              message: msg,
              type: 'success',
            })
          }
        />
      </ErrorBoundary>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectTranscription={(data) => setActiveTranscription(data)}
        onClearHistory={handleClearHistory}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          onUpgradeClick={() => setIsUpgradeModalOpen(true)}
        />
      )}
    </div>
  );
}
