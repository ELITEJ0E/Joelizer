import type { CanonicalProjectJson } from '../../types/projectJson';
import type { RenderProgress, VideoRenderer, RendererType } from './types';
import { OfflineFrameCompositor } from './OfflineFrameCompositor';
import { renderSynchronizedMp4 } from './SynchronizedMp4Renderer';
import { canEncodeVideo, Quality } from 'mediabunny';
import { getResolutionDimensions, type ExportResolutionType, type AspectRatioType } from '../../types/projectJson';
import { getExportVideoBitrate } from './exportQuality';

const SAMPLE_RATE = 48000;

type EncoderClass = {
  new (init: { output: (chunk: any, metadata: any) => void; error: (error: Error) => void }): any;
  isConfigSupported(config: object): Promise<{ supported: boolean; config: any }>;
};

function videoEncoderClass(): EncoderClass | null {
  return (globalThis as any).VideoEncoder || null;
}

export function getCandidateCodecs(width: number, height: number, fps: number): string[] {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const macroblocksPerSecond = macroblocks * fps;
  // H.264: Level 5.1 supports <=36,864 macroblocks/frame and <=983,040/s,
  // enough for 3840x2160 at 30fps. 4K 60fps needs Level 5.2 (0x34).
  // Lower-level-only probes previously prevented 4K/60 selection entirely.
  const levels = macroblocksPerSecond > 983_040
    ? ['34'] // 5.2: 4K / 60fps
    : macroblocks > 22_080 || macroblocksPerSecond > 589_824
      ? ['33', '34'] // 5.1, 5.2: 4K/30 or 1440p/60
      : macroblocks > 8_192
        ? ['32', '33', '34'] // 5.0+: 1440p/30 and similar sizes
        : macroblocks > 3_600
          ? (fps > 30 ? ['2a', '32', '33'] : ['28', '2a', '32'])
          : (fps > 30 ? ['20', '1f', '28', '2a'] : ['1f', '20', '28', '2a']);

  const list: string[] = [];
  // Prioritize High -> Main -> Constrained Baseline -> Baseline across appropriate levels
  for (const lvl of levels) list.push(`avc1.6400${lvl}`);
  for (const lvl of levels) list.push(`avc1.4d00${lvl}`);
  for (const lvl of levels) list.push(`avc1.42e0${lvl}`);
  for (const lvl of levels) list.push(`avc1.4200${lvl}`);
  return list;
}

async function findVideoConfig(project: { width: number; height: number; fps: number; exportQuality?: 'balanced' | 'high' | 'maximum' }, customCodecs?: string[]) {
  const Video = videoEncoderClass();
  if (!Video) return null;
  const codecs = customCodecs || getCandidateCodecs(project.width, project.height, project.fps);
  const bitrate = getExportVideoBitrate(project.width, project.height, project.fps, project.exportQuality);

  for (const codec of codecs) {
    // Probe hardware and software encoder modes. Testing no-preference and software
    // ensures machines without dedicated GPU H.264 encode hardware still succeed.
    for (const options of [
      { hardwareAcceleration: 'no-preference' },
      { hardwareAcceleration: 'prefer-hardware' },
      { hardwareAcceleration: 'prefer-software' },
      { hardwareAcceleration: 'no-preference', latencyMode: 'quality' },
      { hardwareAcceleration: 'no-preference', latencyMode: 'realtime' },
      { hardwareAcceleration: 'prefer-software', latencyMode: 'realtime' },
      {}
    ]) {
      const config = {
        codec, width: project.width, height: project.height, bitrate,
        framerate: project.fps, ...options
      };
      try {
        const capability = await Video.isConfigSupported(config);
        if (capability.supported) return capability.config;
      } catch { /* Probe next supported H264 encoder configuration. */ }
    }
  }
  return null;
}

/** A browser-only, free 1440p/4K preflight at the exact selected dimensions. */
export async function canEncodeBrowserResolution(
  resolution: ExportResolutionType,
  aspectRatio: AspectRatioType,
  fps: number
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof (globalThis as any).VideoFrame !== 'function') {
    return false;
  }
  try {
    const { width, height } = getResolutionDimensions(aspectRatio, resolution);
    return !!(await findVideoConfig({ width, height, fps, exportQuality: 'maximum' }));
  } catch {
    return false;
  }
}

/**
 * Probe the actual output dimensions and fps, not an unrelated 1920x1080
 * template. Mediabunny owns the H.264 encoder for sound-backed exports;
 * WebCodecs/mp4-muxer owns silent exports. Both must support the candidate.
 */
async function resolveSupportedOutput(project: CanonicalProjectJson) {
  const allResolutions = ['2160p', '1440p', '1080p', '720p', '360p'] as const;
  // Maximum detail is an explicit resolution guarantee: never downscale without consent.
  const choices = project.exportQuality === 'maximum'
    ? [project.resolution]
    : allResolutions.slice(allResolutions.indexOf(project.resolution));
  for (const resolution of choices) {
    const dimensions = resolution === project.resolution
      ? { width: project.width, height: project.height }
      : getResolutionDimensions(project.aspectRatio, resolution);
    // H.264 4:2:0 requires even dimensions. 9:16 720p was 405 x 720.
    const width = Math.max(2, Math.round(dimensions.width / 2) * 2);
    const height = Math.max(2, Math.round(dimensions.height / 2) * 2);
    const config = await findVideoConfig({ width, height, fps: project.fps, exportQuality: project.exportQuality });
    if (!config) continue;
    try {
      const bitrate = getExportVideoBitrate(width, height, project.fps, project.exportQuality);
      // Test Mediabunny compatibility with the exact discovered codec string
      const mbSupported = await canEncodeVideo('avc', {
        width, height, frameRate: project.fps, quality: new Quality({ bitrate }),
        fullCodecString: config.codec,
        hardwareAcceleration: config.hardwareAcceleration
      } as any).catch(() => false);
      if (!mbSupported && typeof (globalThis as any).VideoEncoder === 'undefined') {
        continue;
      }
    } catch {
      // Continue with WebCodecs candidate config if VideoEncoder supports it
    }
    return { config, width, height, resolution };
  }
  return null;
}

async function decodeSoundtrack(project: CanonicalProjectJson, signal?: AbortSignal): Promise<AudioBuffer | null> {
  if (!project.audio.url && !project.audio.audioDataUri) return null;
  const uri = project.audio.audioDataUri || project.audio.url!;
  const response = await fetch(uri, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Failed to load soundtrack for offline export (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');
  const context: AudioContext = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(bytes);
    if (signal?.aborted) throw new Error('Export cancelled by user.');
    const frames = Math.ceil(project.exportRange.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(2, frames, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    const soundtrackSpeed = Math.max(0.1, Math.min(8, project.audio.speed ?? 1));
    source.playbackRate.value = soundtrackSpeed;
    source.connect(offline.destination);
    if (project.exportRange.start * soundtrackSpeed < decoded.duration) {
      source.start(0, project.exportRange.start * soundtrackSpeed);
    }
    const rendered = await offline.startRendering();
    if (signal?.aborted) throw new Error('Export cancelled by user.');
    return rendered;
  } finally {
    await context.close();
  }
}

export class OfflineWebCodecsRenderer implements VideoRenderer {
  name = 'Frame-accurate Browser Video (WebCodecs)';
  type: RendererType = 'offline';

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof (globalThis as any).VideoFrame !== 'function') return false;
    try {
      const formats = [
        { width: 1920, height: 1080, fps: 30 },
        { width: 1280, height: 720, fps: 30 },
        { width: 640, height: 360, fps: 30 }
      ];
      for (const format of formats) {
        if (await findVideoConfig(format)) return true;
      }
      return false;
    } catch { return false; }
  }

  async render(project: CanonicalProjectJson, onProgress: (progress: RenderProgress) => void, signal?: AbortSignal) {
    if (!Number.isFinite(project.exportRange.duration) || project.exportRange.duration <= 0 || project.fps <= 0) {
      throw new Error('Invalid timeline duration or frame rate for offline export.');
    }
    const Video = videoEncoderClass();
    if (!Video) throw new Error('VideoEncoder is unavailable. Use Chrome or Edge.');
    onProgress({ stage: 'preparing', stageMessage: 'Checking browser H.264 encoder at requested resolution...', progress: 3 });
    const selected = await resolveSupportedOutput(project);
    if (!selected) {
      throw new Error(`This browser cannot encode H.264 MP4 at ${project.width}×${project.height} ${project.fps} FPS${project.exportQuality === 'maximum' ? ' without reducing resolution' : ' or a smaller supported size'}. Try a lower frame rate, update Chrome/Edge, enable hardware acceleration, or use a connected render server. No video has been exported.`);
    }
    // Never advertise an unsupported resolution. Encode and report exactly
    // the dimensions the browser accepted.
    const resolvedProject: CanonicalProjectJson = {
      ...project, width: selected.width, height: selected.height,
      resolution: selected.resolution
    };
    const videoConfig = selected.config;
    if (selected.resolution !== project.resolution ||
        selected.width !== project.width || selected.height !== project.height) {
      onProgress({
        stage: 'preparing', progress: 4,
        stageMessage: `Browser H.264 encoder does not support the requested size. Using ${selected.width}×${selected.height} (${selected.resolution}) instead.`
      });
    }

    const compositor = new OfflineFrameCompositor(resolvedProject);
    const totalFrames = Math.max(1, Math.ceil(resolvedProject.exportRange.duration * resolvedProject.fps));
    onProgress({ stage: 'preparing', stageMessage: 'Decoding the soundtrack for frame-accurate audio sync...', progress: 7 });
    const audioBuffer = await decodeSoundtrack(resolvedProject, signal);
    if (signal?.aborted) throw new Error('Export cancelled by user.');
    compositor.setAudioBuffer(audioBuffer);
    // Audio is encoded/muxed by Mediabunny using native or WASM AAC.
    if (audioBuffer) {
      const result = await renderSynchronizedMp4(resolvedProject, compositor, audioBuffer, onProgress, videoConfig, signal);
      return { ...result, resolution: resolvedProject.resolution };
    }
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: resolvedProject.width, height: resolvedProject.height, frameRate: resolvedProject.fps },
      fastStart: 'in-memory'
    });
    const format = 'mp4' as const;
    let videoEncoded = 0;
    let encoderError: Error | null = null;
    const videoEncoder = new Video({
      output: (chunk: any, metadata: any) => { muxer.addVideoChunk(chunk, metadata); videoEncoded++; },
      error: (error: Error) => { encoderError = error; }
    });
    try {
      if (signal?.aborted) throw new Error('Export cancelled by user.');
      onProgress({ stage: 'preparing', stageMessage: 'Loading imported clips for smooth frame-by-frame export...', progress: 5 });
      await compositor.prepare();
      if (signal?.aborted) throw new Error('Export cancelled by user.');
      videoEncoder.configure(videoConfig);
      // No requestAnimationFrame, captureStream, MediaRecorder, or playback clock:
      // each encoded timestamp is derived from its exact timeline frame index.
      for (let index = 0; index < totalFrames; index++) {
        if (signal?.aborted) throw new Error('Export cancelled by user.');
        if (encoderError) throw encoderError;
        const t = resolvedProject.exportRange.start + index / resolvedProject.fps;
        const canvas = await compositor.frame(t);
        const videoFrame = new (globalThis as any).VideoFrame(canvas, {
          timestamp: Math.round(index * 1e6 / resolvedProject.fps),
          duration: Math.round(1e6 / resolvedProject.fps)
        });
        try {
          videoEncoder.encode(videoFrame, { keyFrame: index % (resolvedProject.fps * 2) === 0 });
        } finally {
          videoFrame.close();
        }
        const maxQueue = resolvedProject.width >= 1920 ? 4 : 8;
        if (videoEncoder.encodeQueueSize > maxQueue) await videoEncoder.flush();
        if (index % Math.max(1, Math.round(resolvedProject.fps / 2)) === 0) {
          onProgress({
            stage: 'rendering',
            stageMessage: `Rendering video ${Math.min(project.exportRange.duration, (index + 1) / resolvedProject.fps).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
            progress: 15 + Math.round(index / totalFrames * 75)
          });
          // Yield to controls without affecting media timestamps.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      if (signal?.aborted) throw new Error('Export cancelled by user.');
      await videoEncoder.flush();
      if (encoderError) throw encoderError;
      if (videoEncoded !== totalFrames) {
        throw new Error(`Incomplete encoding: ${videoEncoded} of ${totalFrames} frames. Export was not saved.`);
      }
      onProgress({ stage: 'finalizing', stageMessage: 'Muxing synchronized constant-frame-rate video...', progress: 95 });
      muxer.finalize();
      const buffer = muxer.target.buffer as ArrayBuffer | null;
      if (!buffer || buffer.byteLength < 1024) throw new Error('The offline video file was empty.');
      const output = new Blob([buffer], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(output);
      onProgress({ stage: 'ready', stageMessage: 'Frame-accurate video ready for download.', progress: 100, outputUrl, fileSize: output.size });
      return { outputUrl, fileSize: output.size, format, resolution: resolvedProject.resolution };
    } finally {
      try { videoEncoder.close(); } catch {}
      compositor.dispose();
    }
  }
}
