import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';

export class LocalFFmpegRenderer implements VideoRenderer {
  name = 'Local FFmpeg Engine';
  type: RendererType = 'local';
  private baseUrl = 'http://localhost:4000';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/mv/health`);
      if (res.ok) {
        const data = await res.json();
        return data.status === 'online';
      }
      return false;
    } catch {
      return false;
    }
  }

  async render(
    project: CanonicalProjectJson,
    onProgress: (progress: RenderProgress) => void
  ): Promise<{ outputUrl: string; fileSize?: number }> {
    onProgress({
      stage: 'preparing',
      stageMessage: 'Connecting to Local FFmpeg Engine (Port 4000)...',
      progress: 10
    });

    onProgress({
      stage: 'rendering',
      stageMessage: 'Executing local FFmpeg render graph...',
      progress: 40
    });

    const res = await fetch(`${this.baseUrl}/api/mv/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Local FFmpeg rendering failed (${res.status})`);
    }

    const data = await res.json();
    
    onProgress({
      stage: 'finalizing',
      stageMessage: 'Finalizing MP4 file output...',
      progress: 90
    });

    const outputUrl = data.outputUrl ? `${this.baseUrl}${data.outputUrl}` : (data.path || '/output.mp4');

    onProgress({
      stage: 'ready',
      stageMessage: 'Local FFmpeg export complete!',
      progress: 100,
      outputUrl,
      fileSize: data.fileSize
    });

    return {
      outputUrl,
      fileSize: data.fileSize
    };
  }
}
