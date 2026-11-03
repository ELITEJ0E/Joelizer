import type { CanonicalProjectJson } from '../../types/projectJson';
import type { RenderProgress, VideoRenderer, RendererType } from './types';
import { OfflineFrameCompositor } from './OfflineFrameCompositor';

const SAMPLE_RATE = 48000;
const AUDIO_CHUNK_SAMPLES = 1024;

type EncoderClass = {
  new (init: { output: (chunk: any, metadata: any) => void; error: (error: Error) => void }): any;
  isConfigSupported(config: object): Promise<{ supported: boolean; config: any }>;
};

function audioEncoderClass(): EncoderClass | null {
  return (globalThis as any).AudioEncoder || null;
}

function videoEncoderClass(): EncoderClass | null {
  return (globalThis as any).VideoEncoder || null;
}

async function findVideoConfig(project: { width: number; height: number; fps: number }) {
  const Video = videoEncoderClass();
  if (!Video) return null;
  const bitrate = Math.max(6_000_000, Math.min(35_000_000, Math.round(project.width * project.height * project.fps * 0.16)));
  for (const codec of ['avc1.64002a', 'avc1.4d002a', 'avc1.42001f']) {
    const config = {
      codec,
      width: project.width, height: project.height, bitrate,
      framerate: project.fps, hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality',
      avc: { format: 'avc' }
    };
    try {
      if ((await Video.isConfigSupported(config)).supported) return config;
    } catch { /* Try a lower-profile H264 encoder. */ }
  }
  return null;
}

async function supportsAAC(): Promise<boolean> {
  const Audio = audioEncoderClass();
  if (!Audio || !(globalThis as any).AudioData) return false;
  try {
    return !!(await Audio.isConfigSupported({
      codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 256000
    })).supported;
  } catch { return false; }
}

async function decodeSoundtrack(project: CanonicalProjectJson): Promise<AudioBuffer | null> {
  if (!project.audio.url && !project.audio.audioDataUri) return null;
  const uri = project.audio.audioDataUri || project.audio.url!;
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to load soundtrack for offline export (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');
  const context: AudioContext = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(bytes);
    const frames = Math.ceil(project.exportRange.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(2, frames, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    if (project.exportRange.start < decoded.duration) {
      source.start(0, project.exportRange.start,
        Math.min(project.exportRange.duration, decoded.duration - project.exportRange.start));
    }
    return await offline.startRendering();
  } finally {
    await context.close();
  }
}

export class OfflineWebCodecsRenderer implements VideoRenderer {
  name = 'Frame-accurate Browser MP4 (WebCodecs)';
  type: RendererType = 'offline';

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof (globalThis as any).VideoFrame !== 'function') return false;
    try {
      return !!(await findVideoConfig({ width: 1920, height: 1080, fps: 30 })) && await supportsAAC();
    } catch { return false; }
  }

  async render(project: CanonicalProjectJson, onProgress: (progress: RenderProgress) => void) {
    if (!Number.isFinite(project.exportRange.duration) || project.exportRange.duration <= 0 || project.fps <= 0) {
      throw new Error('Invalid timeline duration or frame rate for offline export.');
    }
    const Video = videoEncoderClass(), Audio = audioEncoderClass();
    const videoConfig = await findVideoConfig(project);
    if (!Video || !videoConfig) throw new Error('H.264 offline encoding is unsupported at these dimensions and FPS. Try 720p/30 FPS or Fast Browser.');
    if (!Audio || !await supportsAAC()) throw new Error('AAC offline encoding is unsupported in this browser. Use Fast Browser or a supported Chromium/Edge browser.');
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const compositor = new OfflineFrameCompositor(project);
    const totalFrames = Math.max(1, Math.ceil(project.exportRange.duration * project.fps));
    const audioBuffer = await decodeSoundtrack(project);
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: project.width, height: project.height, frameRate: project.fps },
      ...(audioBuffer ? { audio: { codec: 'aac' as const, sampleRate: SAMPLE_RATE, numberOfChannels: 2 } } : {}),
      fastStart: 'in-memory'
    });
    let videoEncoded = 0;
    let audioEncoded = 0;
    let encoderError: Error | null = null;
    const videoEncoder = new Video({
      output: (chunk: any, metadata: any) => { muxer.addVideoChunk(chunk, metadata); videoEncoded++; },
      error: (error: Error) => { encoderError = error; }
    });
    let audioEncoder: any = null;
    try {
      onProgress({ stage: 'preparing', stageMessage: 'Loading original clips and artwork for offline MP4...', progress: 5 });
      await compositor.prepare();
      videoEncoder.configure(videoConfig);
      if (audioBuffer) {
        onProgress({ stage: 'encoding', stageMessage: 'Encoding and synchronizing AAC soundtrack...', progress: 10 });
        audioEncoder = new Audio({
          output: (chunk: any, metadata: any) => { muxer.addAudioChunk(chunk, metadata); audioEncoded++; },
          error: (error: Error) => { encoderError = error; }
        });
        audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 256000 });
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        for (let offset = 0; offset < audioBuffer.length; offset += AUDIO_CHUNK_SAMPLES) {
          if (encoderError) throw encoderError;
          const count = Math.min(AUDIO_CHUNK_SAMPLES, audioBuffer.length - offset);
          const planar = new Float32Array(count * 2);
          planar.set(left.subarray(offset, offset + count), 0);
          planar.set(right.subarray(offset, offset + count), count);
          const audioFrame = new (globalThis as any).AudioData({
            format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: count,
            numberOfChannels: 2, timestamp: Math.round(offset * 1e6 / SAMPLE_RATE), data: planar
          });
          try { audioEncoder.encode(audioFrame); } finally { audioFrame.close(); }
          if (audioEncoder.encodeQueueSize > 8) await audioEncoder.flush();
        }
        await audioEncoder.flush();
        if (encoderError) throw encoderError;
        if (audioEncoded === 0) throw new Error('AAC encoder produced no audio packets.');
      }

      // No requestAnimationFrame, captureStream, MediaRecorder, or playback clock:
      // each encoded timestamp is derived from its exact timeline frame index.
      for (let index = 0; index < totalFrames; index++) {
        if (encoderError) throw encoderError;
        const t = project.exportRange.start + index / project.fps;
        const canvas = await compositor.frame(t);
        const videoFrame = new (globalThis as any).VideoFrame(canvas, {
          timestamp: Math.round(index * 1e6 / project.fps),
          duration: Math.round(1e6 / project.fps)
        });
        try {
          videoEncoder.encode(videoFrame, { keyFrame: index % (project.fps * 2) === 0 });
        } finally {
          videoFrame.close();
        }
        if (videoEncoder.encodeQueueSize > 6) await videoEncoder.flush();
        if (index % Math.max(1, Math.round(project.fps / 2)) === 0) {
          onProgress({
            stage: 'rendering',
            stageMessage: `Rendering exact frame ${index + 1}/${totalFrames} (not real-time capture)...`,
            progress: 15 + Math.round(index / totalFrames * 75)
          });
          // Yield to controls without affecting media timestamps.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      await videoEncoder.flush();
      if (encoderError) throw encoderError;
      if (videoEncoded !== totalFrames) {
        throw new Error(`Incomplete encoding: ${videoEncoded} of ${totalFrames} frames. Export was not saved.`);
      }
      onProgress({ stage: 'finalizing', stageMessage: 'Muxing synchronized constant-frame-rate MP4...', progress: 95 });
      muxer.finalize();
      const buffer = (muxer.target as InstanceType<typeof ArrayBufferTarget>).buffer;
      if (!buffer || buffer.byteLength < 1024) throw new Error('The offline MP4 file was empty.');
      const output = new Blob([buffer], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(output);
      onProgress({ stage: 'ready', stageMessage: 'Frame-accurate browser MP4 ready for download.', progress: 100, outputUrl, fileSize: output.size });
      return { outputUrl, fileSize: output.size };
    } finally {
      videoEncoder.close();
      if (audioEncoder) audioEncoder.close();
      compositor.dispose();
    }
  }
}
