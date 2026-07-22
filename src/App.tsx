import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { TranscriptView } from './components/TranscriptView';
import { SubscriptionModal } from './components/SubscriptionModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { Toast } from './components/Toast';
import { SubscriptionTier, TranscriptionData } from './types';
import { Sparkles, Shield, Zap, FileAudio, Lock, Crown, ArrowLeft } from 'lucide-react';

export default function App() {
  // Persistence state
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: 'lock' | 'success' | 'info' | 'error';
  } | null>(null);

  // Sync tier & history with localStorage
  useEffect(() => {
    localStorage.setItem('scribeswift_tier', tier);
  }, [tier]);

  useEffect(() => {
    localStorage.setItem('scribeswift_history', JSON.stringify(history));
  }, [history]);

  const handleToggleTier = () => {
    const newTier: SubscriptionTier = tier === 'free' ? 'premium' : 'free';
    setTier(newTier);
    setToast({
      message: `Test mode switched to ${newTier === 'premium' ? 'Premium ($1/mo)' : 'Free Plan'}.`,
      type: newTier === 'premium' ? 'success' : 'info',
    });
  };

  const handleSubscribeSuccess = () => {
    setTier('premium');
    setToast({
      message: '🎉 Congratulations! You are now subscribed to ScribeSwift Premium ($1/month). All copy, print, and export features unlocked!',
      type: 'success',
    });
  };

  const handleLockedActionClick = (actionName: string) => {
    setToast({
      message: `${actionName} is locked on the Free Plan. Upgrade to Premium ($1/mo) for full export & copy rights!`,
      type: 'lock',
    });
    setIsUpgradeModalOpen(true);
  };

  const handleTranscriptionComplete = (data: TranscriptionData) => {
    setActiveTranscription(data);
    setHistory((prev) => [data, ...prev.filter((h) => h.id !== data.id)]);
    setToast({
      message: `Transcription complete for "${data.title}"!`,
      type: 'success',
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('scribeswift_history');
    setToast({ message: 'Transcription history cleared.', type: 'info' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        tier={tier}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onToggleHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onToggleTier={handleToggleTier}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeTranscription ? (
          /* Active Transcript View */
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
          /* Landing & Upload View */
          <div className="space-y-12 animate-fadeIn">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Powered by Gemini 3.6 Flash & File API (Up to 100MB)</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                AI Speech-to-Text & Transcript Summarizer
              </h1>

              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
                Upload podcasts, keynote lectures, meeting recordings, and videos up to <strong className="text-indigo-300">100MB</strong>. Get time-stamped text, multi-speaker recognition, and action items in seconds.
              </p>
            </div>

            {/* Drag & Drop File Uploader */}
            <FileUpload
              onTranscriptionComplete={handleTranscriptionComplete}
              onError={(msg) => setToast({ message: msg, type: 'error' })}
            />

            {/* Feature Value Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-900">
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">100MB Capacity Upgrade</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Refactored with Google AI Studio File API to process large 100MB audio and video files asynchronously without memory caps.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Free vs $1/mo Premium Tier</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Free tier users preview full transcriptions. Upgrade for $1/mo to unlock copy-paste, print formatting, and TXT/SRT/VTT downloads.
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

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ScribeSwift AI Engine • Built with Google AI Studio File API & Gemini 3.6</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-indigo-400 hover:underline"
            >
              Subscription Tier ($1/mo)
            </button>
            <button
              onClick={handleToggleTier}
              className="text-slate-400 hover:text-white underline"
            >
              Toggle Test Tier ({tier === 'premium' ? 'Premium' : 'Free'})
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <SubscriptionModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSubscribeSuccess={handleSubscribeSuccess}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectTranscription={(data) => setActiveTranscription(data)}
        onClearHistory={handleClearHistory}
      />

      {/* Notifications Toast */}
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
