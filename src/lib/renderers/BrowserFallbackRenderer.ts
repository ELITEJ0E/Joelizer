import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';
import { useStore } from '../../store/useStore';
import { audioManager } from '../audio';
import fixWebmDuration from 'fix-webm-duration';

export class BrowserFallbackRenderer implements VideoRenderer {
  name = 'Client Browser Video Engine';
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
      stageMessage: 'Preparing Client Video Recorder...',
      progress: 5
    });

    // Locate preview canvas element
    const canvas = (document.getElementById('visualizer-canvas') || document.querySelector('canvas')) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Preview canvas element not found. Please ensure the visualizer or lyrics video preview is loaded.');
    }

    onProgress({
      stage: 'preparing',
      stageMessage: 'Setting up video & audio stream pipeline...',
      progress: 15
    });

    const fps = project.fps || 30;
    const canvasStream = canvas.captureStream ? canvas.captureStream(fps) : (canvas as any).mozCaptureStream?.(fps);
    if (!canvasStream) {
      throw new Error('Browser does not support canvas video stream capture.');
    }

    // Merge audio stream if available
    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));

    try {
      const audioStream = audioManager.getMediaStream();
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        audioStream.getAudioTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));
      }
    } catch (audioErr) {
      console.warn('[BrowserFallbackRenderer] Audio stream mix warning:', audioErr);
    }

    // Determine highest quality supported MIME type
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    let chosenMime = 'video/webm';
    for (const t of supportedTypes) {
      if (MediaRecorder.isTypeSupported(t)) {
        chosenMime = t;
        break;
      }
    }

    const duration = project.exportRange?.duration || 10;
    const startTimeOffset = project.exportRange?.start || 0;
    const durationMs = duration * 1000;

    // Position timeline to start of export range and ensure playback is active
    const originalTime = useStore.getState().currentTime;
    const wasPlaying = useStore.getState().isPlaying;
    
    useStore.getState().setCurrentTime(startTimeOffset);
    audioManager.seek(startTimeOffset);
    useStore.getState().setIsPlaying(true);

    return new Promise((resolve, reject) => {
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: chosenMime,
          videoBitsPerSecond: 8_000_000 // 8 Mbps high quality
        });
      } catch (err: any) {
        mediaRecorder = new MediaRecorder(combinedStream);
      }

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onerror = (err: any) => {
        useStore.getState().setIsPlaying(false);
        useStore.getState().setCurrentTime(originalTime);
        reject(new Error(`MediaRecorder error: ${err.message || 'Recording stream failed'}`));
      };

      const startTime = Date.now();
      let timer: any = null;

      mediaRecorder.onstop = async () => {
        if (timer) clearInterval(timer);
        useStore.getState().setIsPlaying(false);
        useStore.getState().setCurrentTime(originalTime);

        try {
          if (chunks.length === 0) {
            throw new Error('Recorded 0 video frames. Please ensure audio and canvas playback are running.');
          }

          const rawBlob = new Blob(chunks, { type: chosenMime });
          if (rawBlob.size === 0) {
            throw new Error('Exported video file size is 0 bytes. Media stream was empty.');
          }

          onProgress({
            stage: 'encoding',
            stageMessage: 'Packaging video container & finalizing metadata...',
            progress: 88
          });

          let finalBlob = rawBlob;
          if (chosenMime.includes('webm')) {
            try {
              finalBlob = await new Promise<Blob>((res) => {
                fixWebmDuration(rawBlob, durationMs, (fixed) => res(fixed));
              });
            } catch (fixErr) {
              console.warn('[BrowserFallbackRenderer] fixWebmDuration notice:', fixErr);
              finalBlob = rawBlob;
            }
          }

          const url = URL.createObjectURL(finalBlob);

          onProgress({
            stage: 'ready',
            stageMessage: 'Video export complete and ready for download!',
            progress: 100,
            outputUrl: url,
            fileSize: finalBlob.size
          });

          resolve({
            outputUrl: url,
            fileSize: finalBlob.size
          });
        } catch (postErr: any) {
          reject(postErr);
        }
      };

      // Request data chunks every 250ms so data is continuously buffered
      mediaRecorder.start(250);

      onProgress({
        stage: 'rendering',
        stageMessage: `Capturing canvas video frames: 0s / ${Math.round(duration)}s`,
        progress: 20
      });

      timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPct = Math.min(85, 20 + Math.round((elapsed / durationMs) * 65));

        onProgress({
          stage: 'rendering',
          stageMessage: `Rendering frame pass: ${Math.min(duration, Math.round(elapsed / 1000))}s / ${Math.round(duration)}s`,
          progress: progressPct
        });

        if (elapsed >= durationMs) {
          clearInterval(timer);
          timer = null;
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }
      }, 300);
    });
  }
}

