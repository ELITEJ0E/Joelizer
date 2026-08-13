import { CanonicalProjectJson } from '../../types/projectJson';

export type RendererStage = 
  | 'preparing' 
  | 'staging' 
  | 'rendering' 
  | 'encoding' 
  | 'finalizing' 
  | 'ready' 
  | 'error';

export interface RenderProgress {
  stage: RendererStage;
  stageMessage: string;
  progress: number; // 0 to 100
  error?: string;
  outputUrl?: string;
  fileSize?: number;
}

export type RendererType = 'server' | 'local' | 'browser';

export interface VideoRenderer {
  name: string;
  type: RendererType;
  isAvailable(): Promise<boolean>;
  render(
    project: CanonicalProjectJson,
    onProgress: (progress: RenderProgress) => void
  ): Promise<{ outputUrl: string; fileSize?: number }>;
}
