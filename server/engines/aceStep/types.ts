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

export type ACEEngineId = 'ace-step-local' | 'ace-step-cloud';
export type ACEProviderName = 'local' | 'huggingface';

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
  engine?: ACEEngineId;
  onProgress?: (stage: string, percentage: number) => void;
}

export interface ACEStepGenerationResult {
  audioUrl: string;
  duration: number;
  title: string;
  engine: ACEEngineId;
  provider: ACEProviderName;
  sourceUrl: string;
  format: string;
  generationId: string;
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
  errorCode?: string;
  createdAt: number;
  completedAt?: number;
  model: string;
  engine: ACEEngineId;
  provider: ACEProviderName;
  format?: string;
  sourceUrl?: string;
}

export interface EngineStatus {
  connected: boolean;
  endpoint: string;
  engineType: ACEEngineId;
  modelLoaded: boolean;
  gpuAvailable: boolean;
  gpuDeviceName?: string;
  activeJobs?: number;
  version?: string;
  error?: string;
  models?: string[];
}
