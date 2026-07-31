export type SubscriptionTier = 'free' | 'premium';

export interface TimestampSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  timestamp: string; // e.g. "00:12"
  speaker: string;
  text: string;
}

export interface SummaryData {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  keywords: string[];
}

export interface TranscriptionData {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaUrl?: string; // object URL or data URL if available
  durationSeconds: number;
  fullText: string;
  language: string;
  segments: TimestampSegment[];
  summary: SummaryData;
  createdAt: string;
}

export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'json' | 'pdf';

export interface UploadProgress {
  stage: 'idle' | 'uploading' | 'processing' | 'transcribing' | 'completed' | 'error';
  percent: number;
  message: string;
}
