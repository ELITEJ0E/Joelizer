import { VideoRenderer, RenderProgress, RendererType } from './types';
import { CanonicalProjectJson } from '../../types/projectJson';
import { useStore } from '../../store/useStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { audioManager } from '../audio';
import { renderLyricsVideoFrame } from '../lyricsEngine';
import { LYRIC_VIDEO_TEMPLATES } from '../lyricsTemplates';
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
    if (project.exportMode === 'music-video' && project.videoClips.some(c => c.type === 'video' || c.type === 'image')) {
      throw new Error('Music video exports with timeline clips require the server Remotion renderer. Browser canvas capture cannot render MV clips reliably.');
    }
    onProgress({
      stage: 'preparing',
      stageMessage: 'Preparing Client Video Recorder...',
      progress: 5
    });

    // 1. Locate preview canvas element or instantiate dedicated offscreen canvas
    let canvas = (document.getElementById('visualizer-canvas') || document.querySelector('canvas#visualizer-canvas')) as HTMLCanvasElement | null;
    let customRenderLoop: number | null = null;

    if (!canvas) {
      // Offscreen rendering canvas for tabs where visualizer is not currently mounted (e.g. LRC studio or DAW)
      const offscreenCanvas = document.createElement('canvas');
      const targetW = project.width || 1280;
      const targetH = project.height || 720;
      offscreenCanvas.width = targetW;
      offscreenCanvas.height = targetH;
      canvas = offscreenCanvas;

      const ctx = offscreenCanvas.getContext('2d');
      if (ctx) {
        const storeState = useStore.getState();
        const lyricsVideoState = useLyricsVideoStore.getState();
        const currentTrack = storeState.tracks[storeState.currentTrackIndex];
        const tmpl = LYRIC_VIDEO_TEMPLATES[lyricsVideoState.selectedTemplateId || 'vinyl'] || LYRIC_VIDEO_TEMPLATES['vinyl'];

        const renderFrame = () => {
          const curTime = audioManager.getPreciseCurrentTime() || useStore.getState().currentTime;
          const freqData = audioManager.getFrequencyData();
          const timeData = audioManager.getTimeDomainData();

          renderLyricsVideoFrame(
            ctx,
            targetW,
            targetH,
            curTime,
            useStore.getState().lyricsSettings?.lines || [],
            {
              title: currentTrack?.name || useStore.getState().name || 'Production Video',
              artist: currentTrack?.artist || 'Joelizer Studio',
              albumArtUrl: currentTrack?.albumArt || useStore.getState().albumArt
            },
            {
              template: tmpl,
              aspectRatio: useStore.getState().aspectRatio,
              animationStyle: lyricsVideoState.animationStyle,
              visibleLineCount: lyricsVideoState.visibleLineCount,
              customBackground: lyricsVideoState.customBackground,
              typographyOverride: lyricsVideoState.typographyOverride,
              artworkOverride: lyricsVideoState.artworkOverride,
              animationOverride: lyricsVideoState.animationOverride,
              elementPositions: lyricsVideoState.elementPositions,
              watermarkText: 'Made with Joelizer',
              showSafeArea: false
            },
            freqData,
            timeData
          );
          customRenderLoop = requestAnimationFrame(renderFrame);
        };
        customRenderLoop = requestAnimationFrame(renderFrame);
      }
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
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid export range duration');
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
        if (customRenderLoop) cancelAnimationFrame(customRenderLoop);
        useStore.getState().setIsPlaying(false);
        useStore.getState().setCurrentTime(originalTime);
        reject(new Error(`MediaRecorder error: ${err.message || 'Recording stream failed'}`));
      };

      const startTime = Date.now();
      let timer: any = null;

      mediaRecorder.onstop = async () => {
        if (timer) clearInterval(timer);
        if (customRenderLoop) cancelAnimationFrame(customRenderLoop);
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

