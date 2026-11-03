import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';
import { getRenderServerOrigin, renderApiUrl } from '../renderBackend';

const sleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export class ServerRemotionRenderer implements VideoRenderer {
  name = 'High Quality Remotion / FFmpeg (Background Safe)';
  type: RendererType = 'server';

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(renderApiUrl('/api/health'), {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store'
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'ok' && data.hasRemotion === true &&
        data.platform !== 'vercel-serverless';
    } catch {
      return false;
    }
  }

  async render(
    project: CanonicalProjectJson,
    onProgress: (progress: RenderProgress) => void
  ): Promise<{ outputUrl: string; fileSize?: number }> {
    // Use a persistent render server. Background tab throttling cannot affect
    // server-side frame rendering even if the browser is minimized.
    const origin = getRenderServerOrigin();
    onProgress({ stage: 'preparing', stageMessage: 'Submitting frame-accurate render job...', progress: 5 });
    const response = await fetch(renderApiUrl('/api/export-video'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Render server rejected the export (HTTP ${response.status})`);
    }
    const { exportId } = await response.json();
    if (!exportId || typeof exportId !== 'string') {
      throw new Error('Render server did not return a valid job ID');
    }

    // Polling runs only for UI updates. The server continues rendering frames
    // even when timers are throttled or the user changes tabs/windows.
    const deadline = Date.now() + 4 * 60 * 60 * 1000;
    let networkFailures = 0;
    while (Date.now() < deadline) {
      await sleep(1400);
      let progressResponse: Response;
      try {
        progressResponse = await fetch(renderApiUrl(`/api/export-progress/${encodeURIComponent(exportId)}`), {
          signal: AbortSignal.timeout(15000),
          cache: 'no-store'
        });
      } catch (error) {
        if (++networkFailures >= 8) {
          throw new Error('Lost contact with the render server. The job may still be rendering; reconnect before retrying.');
        }
        continue;
      }
      if (!progressResponse.ok) {
        if (progressResponse.status === 404) throw new Error('Render job no longer exists on the server (server restart or lost job).');
        if (++networkFailures >= 8) throw new Error(`Render server polling failed (HTTP ${progressResponse.status})`);
        continue;
      }
      networkFailures = 0;
      const job = await progressResponse.json();
      onProgress({
        stage: job.stage || 'rendering',
        stageMessage: job.stageMessage || 'Rendering frames...',
        progress: Number(job.progress) || 0,
        outputUrl: job.outputUrl,
        fileSize: job.fileSize,
        error: job.error
      });
      if (job.stage === 'error') throw new Error(job.error || 'Render server reported a failure.');
      if (job.stage === 'ready') {
        if (!job.outputUrl || !String(job.outputUrl).startsWith('/api/download-export/')) {
          throw new Error('Render job completed without a valid download URL');
        }
        return {
          outputUrl: origin + job.outputUrl,
          fileSize: job.fileSize
        };
      }
    }
    throw new Error('Render status timed out. Check the render server logs and job status.');
  }
}
