import React, { useState, useRef } from 'react';
import { Upload, FileAudio, FileVideo, AlertTriangle, CheckCircle2, Sparkles, Music, Film, ArrowUpRight } from 'lucide-react';
import { TranscriptionData, UploadProgress } from '../types';

interface FileUploadProps {
  onTranscriptionComplete: (data: TranscriptionData) => void;
  onError: (msg: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onTranscriptionComplete,
  onError,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    percent: 0,
    message: '',
  });
  const [selectedLanguage, setSelectedLanguage] = useState('Auto-detect');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_MB = 100;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024; // 100MB

  const handleFileSelection = (file: File) => {
    if (file.size > MAX_SIZE_BYTES) {
      onError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed limit of 100MB. Please select a smaller file.`);
      setSelectedFile(null);
      return;
    }

    const isAudioOrVideo = file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|mp4|wav|m4a|aac|ogg|mov|webm|mkv|flac)$/i.test(file.name);
    if (!isAudioOrVideo) {
      onError('Unsupported file format. Please select an audio or video file (MP3, MP4, WAV, M4A, AAC, MOV, WEBM, MKV).');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const processFileUpload = (fileToUpload: File) => {
    setProgress({
      stage: 'uploading',
      percent: 0,
      message: 'Uploading media file to server...',
    });

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('language', selectedLanguage);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/transcribe', true);

    // Track real-time upload progress (0% - 100%)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress({
          stage: 'uploading',
          percent: percentComplete,
          message: `Uploading file (${(event.loaded / (1024 * 1024)).toFixed(1)}MB / ${(event.total / (1024 * 1024)).toFixed(1)}MB)...`,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result: TranscriptionData = JSON.parse(xhr.responseText);
          // Attach local media blob URL so player can play original audio/video file directly!
          const mediaBlobUrl = URL.createObjectURL(fileToUpload);
          result.mediaUrl = mediaBlobUrl;

          setProgress({
            stage: 'completed',
            percent: 100,
            message: 'Transcription completed successfully!',
          });

          setTimeout(() => {
            onTranscriptionComplete(result);
            setProgress({ stage: 'idle', percent: 0, message: '' });
            setSelectedFile(null);
          }, 600);
        } catch (err) {
          onError('Failed to parse server transcription result.');
          setProgress({ stage: 'idle', percent: 0, message: '' });
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          onError(errRes.error || 'Server error during transcription.');
        } catch (e) {
          onError(`Server error (Status ${xhr.status}) during transcription.`);
        }
        setProgress({ stage: 'idle', percent: 0, message: '' });
      }
    };

    xhr.onerror = () => {
      onError('Network connection error during file upload.');
      setProgress({ stage: 'idle', percent: 0, message: '' });
    };

    // Update message when upload finishes and server begins AI Studio File API processing
    xhr.upload.onload = () => {
      setProgress({
        stage: 'processing',
        percent: 95,
        message: 'Processing file with Google AI Studio File API & Gemini 3.6 Flash...',
      });
    };

    xhr.send(formData);
  };

  const handleStartTranscribing = () => {
    if (!selectedFile) return;
    processFileUpload(selectedFile);
  };

  const handleLoadSample = async (sampleType: 'keynote' | 'podcast') => {
    setProgress({
      stage: 'processing',
      percent: 50,
      message: `Loading sample ${sampleType === 'keynote' ? 'Video Keynote (48MB)' : 'Podcast Episode (18MB)'}...`,
    });

    try {
      const res = await fetch(`/api/sample-transcription?type=${sampleType}`);
      if (!res.ok) throw new Error('Failed to load sample');
      const sampleData: TranscriptionData = await res.json();

      setProgress({
        stage: 'completed',
        percent: 100,
        message: 'Sample loaded successfully!',
      });

      setTimeout(() => {
        onTranscriptionComplete(sampleData);
        setProgress({ stage: 'idle', percent: 0, message: '' });
      }, 400);
    } catch (e: any) {
      onError(e.message || 'Error loading sample transcription.');
      setProgress({ stage: 'idle', percent: 0, message: '' });
    }
  };

  const isUploadingOrProcessing = progress.stage === 'uploading' || progress.stage === 'processing';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Upload Box */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 ${
          dragActive
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : selectedFile
            ? 'border-indigo-500/50 bg-slate-900/80'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.aac,.mov,.webm,.mkv"
          onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
          className="hidden"
        />

        {isUploadingOrProcessing ? (
          /* Processing State View */
          <div className="space-y-6 py-4 animate-fadeIn">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-white">{progress.message}</h3>
              <p className="text-xs text-slate-400">
                Google AI Studio File API handling large binary stream & multi-speaker recognition
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden shadow-inner mt-4">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1">
                <span>{progress.percent}% Completed</span>
                <span>Max 100MB</span>
              </div>
            </div>
          </div>
        ) : selectedFile ? (
          /* File Selected View */
          <div className="space-y-6 py-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-2">
              {selectedFile.type.startsWith('video/') ? (
                <FileVideo className="w-8 h-8" />
              ) : (
                <FileAudio className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-white max-w-xl mx-auto truncate">
                {selectedFile.name}
              </h3>
              <p className="text-sm text-slate-400 mt-1 font-mono">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Media File'}
              </p>
            </div>

            {/* Language Picker */}
            <div className="max-w-xs mx-auto flex items-center justify-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Spoken Language:</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="Auto-detect">Auto-detect (Recommended)</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Japanese">Japanese</option>
                <option value="Arabic">Arabic</option>
                <option value="Chinese">Chinese</option>
              </select>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Change File
              </button>

              <button
                onClick={handleStartTranscribing}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-white" />
                <span>Transcribe with Gemini 3.6</span>
              </button>
            </div>
          </div>
        ) : (
          /* Default File Drag & Drop Prompt */
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">
                Drag & Drop Audio or Video File
              </h3>
              <p className="text-sm text-slate-400">
                Supports up to <strong className="text-indigo-300">100MB</strong> media files via Google AI Studio File API
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                Browse File (Up to 100MB)
              </button>
            </div>

            <p className="text-xs text-slate-500 pt-2">
              Formats: MP3, WAV, M4A, AAC, MP4, MOV, WEBM, MKV
            </p>
          </div>
        )}
      </div>

      {/* Instant Demo Samples Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Or Try ScribeSwift Instantly With Pre-Loaded Demo Media
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">1-Click Transcription Demo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Keynote Sample */}
          <button
            onClick={() => handleLoadSample('keynote')}
            disabled={isUploadingOrProcessing}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/80 text-left transition group disabled:opacity-50"
          >
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition">
              <Film className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200 group-hover:text-indigo-300 truncate">
                  Product Launch Keynote
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 flex-shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                48MB Video File • 100MB File API Demo
              </p>
            </div>
          </button>

          {/* Podcast Sample */}
          <button
            onClick={() => handleLoadSample('podcast')}
            disabled={isUploadingOrProcessing}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/80 text-left transition group disabled:opacity-50"
          >
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-105 transition">
              <Music className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200 group-hover:text-purple-300 truncate">
                  Tech Talk Daily Podcast
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 flex-shrink-0" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                18MB Audio File • Multi-speaker Dialogue
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
