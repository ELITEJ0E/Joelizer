import { cloudProviderInstance } from './engines/aceStep/cloudProvider';

export interface GenerateMusicParams {
  prompt: string;
  lyrics?: string;
  duration?: number;
  onStatusUpdate?: (status: string) => void;
}

export interface GenerateMusicResult {
  audioUrl: string;
  duration: number;
  title: string;
  source: string;
}

export async function generateMusic({
  prompt,
  lyrics = '',
  duration = 30,
  onStatusUpdate
}: GenerateMusicParams): Promise<GenerateMusicResult> {
  const result = await cloudProviderInstance.generate({
    prompt,
    lyrics,
    duration,
    onProgress: (stage) => onStatusUpdate?.(stage)
  });

  return {
    audioUrl: result.audioUrl,
    duration: result.duration,
    title: result.title,
    source: 'ace-step-cloud'
  };
}
