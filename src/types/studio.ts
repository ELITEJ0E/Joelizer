import { LyricLine } from '../store/useStore';

export type ExportFormat = 'lrc' | 'enhanced-lrc' | 'srt' | 'ass' | 'json' | 'txt' | 'zip';

export interface WordTiming {
  word: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

export interface LyricLineWithWords extends LyricLine {
  words?: WordTiming[];
  speaker?: string;
  section?: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro';
}

export interface SongAnalysis {
  bpm?: number;
  key?: string;
  language?: string;
  sections?: Array<{
    title: string;
    startTime: number;
    endTime: number;
  }>;
}

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  provider?: 'gemini' | 'whisperx' | 'faster_whisper' | 'openai';
  signal?: AbortSignal;
}

export interface AlignmentOptions {
  rawLyrics?: string;
  language?: string;
  signal?: AbortSignal;
}

export interface TranscriptionResult {
  text: string;
  lines: LyricLineWithWords[];
  language?: string;
  bpm?: number;
  key?: string;
  sections?: SongAnalysis['sections'];
}

export interface TranscriptionProvider {
  name: string;
  transcribe(audioBlob: Blob | File, options?: TranscriptionOptions): Promise<TranscriptionResult>;
  align(audioBlob: Blob | File, rawLyrics: string, options?: AlignmentOptions): Promise<TranscriptionResult>;
  detectLanguage?(audioBlob: Blob | File): Promise<string>;
  detectBpmAndKey?(audioBlob: Blob | File): Promise<{ bpm: number; key: string }>;
}

export type ProcessingStage = 
  | 'idle'
  | 'uploading'
  | 'extracting_audio'
  | 'transcribing'
  | 'aligning'
  | 'generating_lrc'
  | 'generating_srt'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface ProcessingProgress {
  stage: ProcessingStage;
  message: string;
  percentage: number;
  error?: string;
}
