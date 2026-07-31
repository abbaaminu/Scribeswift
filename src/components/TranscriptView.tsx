import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Search,
  Sparkles,
  Lock,
  UserCheck,
  FileText,
  ListChecks,
  Tag,
  Clock,
  Layers,
  Edit2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { TranscriptionData, SubscriptionTier, TimestampSegment } from '../types';
import { ExportMenu } from './ExportMenu';

interface TranscriptViewProps {
  data: TranscriptionData;
  tier: SubscriptionTier;
  onOpenUpgradeModal: () => void;
  onLockedActionClick: (actionName: string) => void;
  onCopySuccess: () => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  data,
  tier,
  onOpenUpgradeModal,
  onLockedActionClick,
  onCopySuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actionItems'>('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [segments, setSegments] = useState<TimestampSegment[]>(data.segments);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerInput, setSpeakerInput] = useState('');

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const isPremium = tier === 'premium';

  // Update internal segments if data changes
  useEffect(() => {
    setSegments(data.segments);
  }, [data]);

  // Client-Side Copy/Highlight Protections for Free Tier Users
  useEffect(() => {
    if (isPremium) return;

    const container = transcriptContainerRef.current;
    if (!container) return;

    const handleCopyAttempt = (e: Event) => {
      e.preventDefault();
      onLockedActionClick('Copying Text');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onLockedActionClick(e.key.toLowerCase() === 'p' ? 'Printing Document' : 'Copying Text');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent right click copy option
      e.preventDefault();
      onLockedActionClick('Right Click Copy Menu');
    };

    container.addEventListener('copy', handleCopyAttempt);
    container.addEventListener('cut', handleCopyAttempt);
    container.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('copy', handleCopyAttempt);
      container.removeEventListener('cut', handleCopyAttempt);
      container.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPremium, onLockedActionClick]);

  // Jump to segment timestamp in audio/video player
  const handleJumpToTimestamp = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSpeakerRename = (speakerToRename: string, newName: string) => {
    if (!newName.trim()) return;
    setSegments((prev) =>
      prev.map((seg) => (seg.speaker === speakerToRename ? { ...seg, speaker: newName.trim() } : seg))
    );
    setEditingSpeakerId(null);
  };

  // Filter segments by search query
  const filteredSegments = segments.filter(
    (seg) =>
      seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner / Controls Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {data.language || 'English'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {Math.floor(data.durationSeconds / 60)}m {Math.floor(data.durationSeconds % 60)}s
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1.5">{data.title}</h2>
          </div>

          {/* Export Menu */}
          <ExportMenu
            data={{ ...data, segments }}
            tier={tier}
            onLockedActionClick={onLockedActionClick}
            onCopySuccess={onCopySuccess}
          />
        </div>

        {/* Media Player (If media URL available or HTML5 audio fallback) */}
        {data.mediaUrl ? (
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80">
            {data.fileType.startsWith('video/') ? (
              <video
                ref={(el) => {
                  mediaRef.current = el;
                }}
                src={data.mediaUrl}
                controls
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full max-h-64 rounded-lg bg-black mx-auto"
              />
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (mediaRef.current) {
                      if (isPlaying) mediaRef.current.pause();
                      else mediaRef.current.play();
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition flex-shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div className="flex-1">
                  <audio
                    ref={(el) => {
                      mediaRef.current = el;
                    }}
                    src={data.mediaUrl}
                    onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-8"
                  />
                </div>

                {/* Speed Controls */}
                <select
                  value={playbackSpeed}
                  onChange={(e) => {
                    const spd = parseFloat(e.target.value);
                    setPlaybackSpeed(spd);
                    if (mediaRef.current) mediaRef.current.playbackRate = spd;
                  }}
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Interactive Time-Coded Transcript ({segments.length} segments)</span>
            </span>
            <span className="font-mono text-slate-500">{data.fileName}</span>
          </div>
        )}

        {/* Free Plan Lock Indicator Warning Banner */}
        {!isPremium && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Free Tier Active:</strong> Copying, selecting text, printing, and file downloads are restricted on the Free plan.
              </span>
            </div>
            <button
              onClick={onOpenUpgradeModal}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold whitespace-nowrap transition cursor-pointer shadow-sm"
            >
              Unlock Premium - $1/mo
            </button>
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'transcript'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Full Transcript</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'summary'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI Executive Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('actionItems')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'actionItems'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ListChecks className="w-4 h-4 text-emerald-400" />
            <span>Action Items ({data.summary?.actionItems?.length || 0})</span>
          </button>
        </div>

        {/* Search Input for Transcript */}
        {activeTab === 'transcript' && (
          <div className="relative hidden sm:block w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Main Tab Content Display */}
      {activeTab === 'transcript' && (
        <div
          ref={transcriptContainerRef}
          className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 ${
            !isPremium ? 'select-none pointer-events-auto' : 'select-text'
          }`}
          style={!isPremium ? { WebkitUserSelect: 'none', userSelect: 'none' } : {}}
        >
          {/* Mobile Search */}
          <div className="block sm:hidden mb-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {filteredSegments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No matching segments found for "{searchQuery}".
            </div>
          ) : (
            filteredSegments.map((seg) => {
              const isActiveTime = currentTime >= seg.startTime && currentTime <= seg.endTime;

              return (
                <div
                  key={seg.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isActiveTime
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {/* Timestamp Tag */}
                    <button
                      onClick={() => handleJumpToTimestamp(seg.startTime)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-medium transition cursor-pointer"
                      title="Click to jump audio player to timestamp"
                    >
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>{seg.timestamp}</span>
                    </button>

                    {/* Speaker Tag / Speaker Rename */}
                    {editingSpeakerId === seg.speaker ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={speakerInput}
                          onChange={(e) => setSpeakerInput(e.target.value)}
                          placeholder="New Speaker Name"
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSpeakerRename(seg.speaker, speakerInput)}
                          className="p-1 rounded bg-emerald-600 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingSpeakerId(seg.speaker);
                          setSpeakerInput(seg.speaker);
                        }}
                        className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1 hover:bg-purple-500/10 px-2 py-0.5 rounded transition"
                        title="Click to rename speaker"
                      >
                        <span>{seg.speaker}</span>
                        <Edit2 className="w-3 h-3 text-slate-500 hover:text-purple-300" />
                      </button>
                    )}
                  </div>

                  {/* Segment Text */}
                  <p className="text-sm text-slate-200 leading-relaxed font-normal">
                    {seg.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* AI Summary Tab */}
      {activeTab === 'summary' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Overview & Narrative Summary</span>
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              {data.summary?.overview || 'No overview summary generated.'}
            </p>
          </div>

          {/* Key Takeaways */}
          {data.summary?.keyPoints && data.summary.keyPoints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Key Takeaways
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {data.summary.keyPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs sm:text-sm text-slate-200"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                      {idx + 1}
                    </div>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {data.summary?.keywords && data.summary.keywords.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Topics & Keywords
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.summary.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Items Tab */}
      {activeTab === 'actionItems' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-emerald-400" />
            <span>Extracted Action Items & Deliverables</span>
          </h3>

          {!data.summary?.actionItems || data.summary.actionItems.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No specific action items detected in this transcript.
            </p>
          ) : (
            <div className="space-y-2.5">
              {data.summary.actionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex-1 leading-normal">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
