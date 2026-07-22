import React from 'react';
import { X, History, Trash2, Clock, FileAudio, FileVideo, ChevronRight } from 'lucide-react';
import { TranscriptionData } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: TranscriptionData[];
  onSelectTranscription: (data: TranscriptionData) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectTranscription,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg text-white">Saved Transcriptions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm space-y-2">
              <History className="w-8 h-8 mx-auto opacity-40" />
              <p>No saved transcriptions yet.</p>
              <p className="text-xs text-slate-600">Transcribed audio or video files will appear here automatically.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectTranscription(item);
                  onClose();
                }}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 cursor-pointer transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.fileType?.startsWith('video/') ? (
                      <FileVideo className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    ) : (
                      <FileAudio className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-sm text-slate-200 group-hover:text-indigo-300 truncate">
                      {item.title}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <span>
                    {Math.floor(item.durationSeconds / 60)}m {Math.floor(item.durationSeconds % 60)}s
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={onClearHistory}
              className="w-full py-2 px-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
