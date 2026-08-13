import React, { useState, useRef, useEffect } from 'react';
import { Download, Copy, Printer, FileText, Subtitles, FileJson, Lock, Sparkles, Check, ChevronDown } from 'lucide-react';
import { TranscriptionData, SubscriptionTier } from '../types';
import { exportToTxt, exportToSrt, exportToVtt, exportToJson, triggerPrintTranscript } from '../utils/exportUtils';
import { PREMIUM_PRICE_TEXT } from '../utils/constants';

interface ExportMenuProps {
  data: TranscriptionData;
  tier: SubscriptionTier;
  onLockedActionClick: (actionName: string) => void;
  onCopySuccess: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  data,
  tier,
  onLockedActionClick,
  onCopySuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPremium = tier === 'premium';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (!isPremium) {
      onLockedActionClick('Copy Text');
      return;
    }

    const fullTextToCopy = `${data.title}\n\n` + data.segments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(fullTextToCopy);
    setCopied(true);
    onCopySuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: 'txt' | 'srt' | 'vtt' | 'json' | 'print') => {
    if (!isPremium) {
      onLockedActionClick(`Export (${format.toUpperCase()})`);
      setIsOpen(false);
      return;
    }

    switch (format) {
      case 'txt':
        exportToTxt(data);
        break;
      case 'srt':
        exportToSrt(data);
        break;
      case 'vtt':
        exportToVtt(data);
        break;
      case 'json':
        exportToJson(data);
        break;
      case 'print':
        triggerPrintTranscript(data);
        break;
    }
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2 relative" ref={menuRef}>
      {/* Direct Copy Button */}
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          copied
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : isPremium
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
        }`}
        title={isPremium ? 'Copy complete transcription text' : `Upgrade to ${PREMIUM_PRICE_TEXT} Premium to unlock text copy`}
      >
        {!isPremium && <Lock className="w-3.5 h-3.5 text-amber-400" />}
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? 'Copied!' : 'Copy Text'}</span>
      </button>

      {/* Direct Print Button */}
      <button
        onClick={() => handleExport('print')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        title={isPremium ? 'Print-ready transcript view' : `Upgrade to ${PREMIUM_PRICE_TEXT} Premium to unlock printing`}
      >
        {!isPremium && <Lock className="w-3.5 h-3.5 text-amber-400" />}
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Print</span>
      </button>

      {/* Export Options Dropdown Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export / Download</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-40 py-1.5 animate-fadeIn text-slate-200">
            {!isPremium && (
              <div className="px-3 py-2 bg-amber-500/10 border-b border-slate-800 text-[11px] text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Exports locked on Free Plan ({PREMIUM_PRICE_TEXT} to unlock)</span>
              </div>
            )}

            <button
              onClick={() => handleExport('txt')}
              className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Text File (.txt)</span>
              </div>
              {!isPremium && <Lock className="w-3 h-3 text-amber-400" />}
            </button>

            <button
              onClick={() => handleExport('srt')}
              className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-purple-400" />
                <span>Subtitles (.srt)</span>
              </div>
              {!isPremium && <Lock className="w-3 h-3 text-amber-400" />}
            </button>

            <button
              onClick={() => handleExport('vtt')}
              className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-pink-400" />
                <span>WebVTT (.vtt)</span>
              </div>
              {!isPremium && <Lock className="w-3 h-3 text-amber-400" />}
            </button>

            <button
              onClick={() => handleExport('json')}
              className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <span>JSON Data (.json)</span>
              </div>
              {!isPremium && <Lock className="w-3 h-3 text-amber-400" />}
            </button>

            <div className="border-t border-slate-800 my-1" />

            <button
              onClick={() => handleExport('print')}
              className="w-full px-3.5 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>Print Report</span>
              </div>
              {!isPremium && <Lock className="w-3 h-3 text-amber-400" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
