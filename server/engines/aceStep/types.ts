export type GenerationMode = 'simple' | 'custom' | 'extend' | 'repaint';

export type VocalLanguage = 
  | 'unknown'
  | 'en'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ru';

export interface ACEStepGenerateOptions {
  prompt: string;
  lyrics?: string;
  duration?: number;
  bpm?: number;
  keySignature?: string;
  timeSignature?: string;
  vocalLanguage?: VocalLanguage;
  model?: string;
  inferenceSteps?: number;
  seed?: number;
  temperature?: number;
  cfgScale?: number;
  referenceAudioPath?: string;
  isInstrumental?: boolean;
  onProgress?: (stage: string, percentage: number) => void;
}

export type JobStatus = 'queued' | 'preparing' | 'generating' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  status: JobStatus;
  stageMessage: string;
  progress: number;
  prompt: string;
  lyrics?: string;
  duration: number;
  bpm?: number;
  key?: string;
  audioUrl?: string;
  coverUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  model: string;
  engine: 'local' | 'hf_space' | 'mock';
}

export interface EngineStatus {
  connected: boolean;
  endpoint: string;
  engineType: 'local' | 'hf_space';
  modelLoaded: boolean;
  gpuAvailable: boolean;
  gpuDeviceName?: string;
  activeJobs: number;
  version: string;
}
