import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';
import fixWebmDuration from 'fix-webm-duration';

export class BrowserFallbackRenderer implements VideoRenderer {
  name = 'Browser Fallback Recorder';
  type: RendererType = 'browser';

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && !!window.MediaRecorder;
  }

  async render(
    project: CanonicalProjectJson,
    onProgress: (progress: RenderProgress) => void
  ): Promise<{ outputUrl: string; fileSize?: number }> {
    onProgress({
      stage: 'preparing',
      stageMessage: 'Preparing Browser Fallback Recorder...',
      progress: 10
    });

    // Locate preview canvas element
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Preview canvas not found for browser fallback recording.');
    }

    onProgress({
      stage: 'rendering',
      stageMessage: 'Capturing canvas stream in browser...',
      progress: 30
    });

    const stream = canvas.captureStream(project.fps || 30);
    
    // Choose supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const duration = project.exportRange?.duration || 10;
    const durationMs = duration * 1000;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        try {
          const rawBlob = new Blob(chunks, { type: mimeType });
          
          onProgress({
            stage: 'encoding',
            stageMessage: 'Fixing video duration container metadata...',
            progress: 85
          });

          let finalBlob = rawBlob;
          if (mimeType.includes('webm')) {
            try {
              finalBlob = await new Promise<Blob>((res) => {
                fixWebmDuration(rawBlob, durationMs, (fixed) => res(fixed));
              });
            } catch (err) {
              console.warn('fixWebmDuration fallback warning:', err);
            }
          }

          const url = URL.createObjectURL(finalBlob);

          onProgress({
            stage: 'ready',
            stageMessage: 'Browser recording complete!',
            progress: 100,
            outputUrl: url,
            fileSize: finalBlob.size
          });

          resolve({ outputUrl: url, fileSize: finalBlob.size });
        } catch (err: any) {
          reject(err);
        }
      };

      mediaRecorder.onerror = (err: any) => reject(new Error(`MediaRecorder error: ${err.message}`));

      mediaRecorder.start(100);

      // Track progress over recording duration
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(80, 30 + Math.round((elapsed / durationMs) * 50));
        
        onProgress({
          stage: 'rendering',
          stageMessage: `Recording canvas frame pass: ${Math.round(elapsed / 1000)}s / ${Math.round(duration)}s`,
          progress: pct
        });

        if (elapsed >= durationMs) {
          clearInterval(timer);
          mediaRecorder.stop();
        }
      }, 500);
    });
  }
}
