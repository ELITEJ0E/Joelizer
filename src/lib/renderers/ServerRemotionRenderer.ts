import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';

export class ServerRemotionRenderer implements VideoRenderer {
  name = 'Server Remotion Renderer';
  type: RendererType = 'server';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      if (data.hasRemotion === false || data.platform === 'vercel-serverless') {
        return false;
      }
      return true;
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
      stageMessage: 'Initializing Server Remotion Pipeline...',
      progress: 5
    });

    onProgress({
      stage: 'staging',
      stageMessage: 'Verifying staged assets and timeline configuration...',
      progress: 15
    });

    const res = await fetch('/api/export-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server export request failed (${res.status})`);
    }

    const { exportId } = await res.json();
    if (!exportId) {
      throw new Error('Server returned empty export jobId');
    }

    // Poll progress
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const progRes = await fetch(`/api/export-progress/${exportId}`);
          if (!progRes.ok) return;

          const job = await progRes.json();

          onProgress({
            stage: job.stage || 'rendering',
            stageMessage: job.stageMessage || 'Processing video render...',
            progress: job.progress || 0,
            outputUrl: job.outputUrl,
            fileSize: job.fileSize,
            error: job.error
          });

          if (job.stage === 'ready' && job.outputUrl) {
            clearInterval(interval);
            resolve({
              outputUrl: job.outputUrl,
              fileSize: job.fileSize
            });
          } else if (job.stage === 'error') {
            clearInterval(interval);
            reject(new Error(job.error || 'Server Remotion rendering failed'));
          }
        } catch (pollErr: any) {
          console.warn('[ServerRemotionRenderer] Progress polling warning:', pollErr);
        }
      }, 750);
    });
  }
}
