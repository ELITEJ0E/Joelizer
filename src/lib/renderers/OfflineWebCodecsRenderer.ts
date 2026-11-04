import type { CanonicalProjectJson } from '../../types/projectJson';
import type { RenderProgress, VideoRenderer, RendererType } from './types';
import { OfflineFrameCompositor } from './OfflineFrameCompositor';
import { renderSynchronizedWebm } from './SynchronizedWebmRenderer';

const SAMPLE_RATE = 48000;
const AAC_CHUNK_SAMPLES = 1024;
// 48 kHz Opus packets are 20 ms = 960 samples. Supplying 1024-sample
// packets creates a 1.333 ms timestamp mismatch per packet, perceived as
// rapid audio stutter/clicking after muxing.
const OPUS_CHUNK_SAMPLES = 960;

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

async function findVideoConfig(project: { width: number; height: number; fps: number }, codecs: string[] = ['avc1.64002a', 'avc1.4d002a', 'avc1.42001f']) {
  const Video = videoEncoderClass();
  if (!Video) return null;
  const bitrate = Math.max(6_000_000, Math.min(35_000_000, Math.round(project.width * project.height * project.fps * 0.16)));
  for (const codec of codecs) {
    // Many supported Chrome H.264 software encoders reject the combination of
    // prefer-hardware + quality latency mode, particularly in headless/browser
    // sessions without GPU acceleration. Do not mistake that for unavailable H264.
    for (const options of [
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

async function supportsAAC(): Promise<boolean> {
  const Audio = audioEncoderClass();
  if (!Audio || !(globalThis as any).AudioData) return false;
  try {
    return !!(await Audio.isConfigSupported({
      codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 256000
    })).supported;
  } catch { return false; }
}

async function supportsOpus(): Promise<boolean> {
  const Audio = audioEncoderClass();
  if (!Audio || !(globalThis as any).AudioData) return false;
  try {
    return !!(await Audio.isConfigSupported({
      codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192000
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
  name = 'Frame-accurate Browser Video (WebCodecs)';
  type: RendererType = 'offline';

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof (globalThis as any).VideoFrame !== 'function') return false;
    try {
      const project = { width: 1920, height: 1080, fps: 30 };
      const mp4 = !!(await findVideoConfig(project)) && await supportsAAC();
      const webm = !!(await findVideoConfig(project, ['vp09.00.40.08', 'vp09.00.10.08'])) && await supportsOpus();
      return mp4 || webm;
    } catch { return false; }
  }

  async render(project: CanonicalProjectJson, onProgress: (progress: RenderProgress) => void) {
    if (!Number.isFinite(project.exportRange.duration) || project.exportRange.duration <= 0 || project.fps <= 0) {
      throw new Error('Invalid timeline duration or frame rate for offline export.');
    }
    const Video = videoEncoderClass(), Audio = audioEncoderClass();
    if (!Video) throw new Error('VideoEncoder is unavailable. Use Chrome or Edge.');
    const needsAudio = !!(project.audio.url || project.audio.audioDataUri);
    const aacAvailable = await supportsAAC();
    const opusAvailable = await supportsOpus();
    const h264 = await findVideoConfig(project);
    const useWebm = !h264 || (needsAudio && !aacAvailable);
    const videoConfig = useWebm
      ? await findVideoConfig(project, ['vp09.00.40.08', 'vp09.00.10.08'])
      : h264;
    if (!videoConfig) throw new Error('The browser cannot encode this resolution. Try 720p/30 FPS or another browser.');
    if (needsAudio && (!Audio || (useWebm ? !opusAvailable : !aacAvailable))) {
      throw new Error('This browser does not support the required audio encoder for smooth offline exports.');
    }

    const compositor = new OfflineFrameCompositor(project);
    const totalFrames = Math.max(1, Math.ceil(project.exportRange.duration * project.fps));
    const audioBuffer = await decodeSoundtrack(project);
    compositor.setAudioBuffer(audioBuffer);
    // On AAC-less platforms, let the media pipeline manage Opus frame
    // boundaries, encoder priming, timestamp interleaving and finalization.
    if (useWebm) return renderSynchronizedWebm(project, compositor, audioBuffer, onProgress);
    const format = 'mp4' as const;
    let muxer: any;
    if (useWebm) {
      // Opus is available on platforms where AAC WebCodecs is missing.
      // Both variants use exact frame timestamps, never MediaRecorder.
      const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
      muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'V_VP9', width: project.width, height: project.height, frameRate: project.fps },
        ...(audioBuffer ? { audio: { codec: 'A_OPUS', sampleRate: SAMPLE_RATE, numberOfChannels: 2 } } : {})
      });
    } else {
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
      muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: project.width, height: project.height, frameRate: project.fps },
        ...(audioBuffer ? { audio: { codec: 'aac' as const, sampleRate: SAMPLE_RATE, numberOfChannels: 2 } } : {}),
        fastStart: 'in-memory'
      });
    }
    let videoEncoded = 0;
    let audioEncoded = 0;
    let encoderError: Error | null = null;
    const videoEncoder = new Video({
      output: (chunk: any, metadata: any) => { muxer.addVideoChunk(chunk, metadata); videoEncoded++; },
      error: (error: Error) => { encoderError = error; }
    });
    let audioEncoder: any = null;
    try {
      onProgress({ stage: 'preparing', stageMessage: 'Loading imported clips for smooth frame-by-frame export...', progress: 5 });
      await compositor.prepare();
      videoEncoder.configure(videoConfig);
      if (audioBuffer) {
        onProgress({ stage: 'encoding', stageMessage: 'Encoding soundtrack with exact timestamps...', progress: 10 });
        audioEncoder = new Audio({
          output: (chunk: any, metadata: any) => { muxer.addAudioChunk(chunk, metadata); audioEncoded++; },
          error: (error: Error) => { encoderError = error; }
        });
        audioEncoder.configure({ codec: useWebm ? 'opus' : 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: useWebm ? 192000 : 256000 });
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        const audioChunkSamples = useWebm ? OPUS_CHUNK_SAMPLES : AAC_CHUNK_SAMPLES;
        for (let offset = 0; offset < audioBuffer.length; offset += audioChunkSamples) {
          if (encoderError) throw encoderError;
          const count = Math.min(audioChunkSamples, audioBuffer.length - offset);
          // Never feed partial final Opus packets. Zero padding the tail
          // preserves the correct 20 ms timebase without holes between chunks.
          const packetSamples = useWebm ? OPUS_CHUNK_SAMPLES : count;
          const planar = new Float32Array(packetSamples * 2);
          planar.set(left.subarray(offset, offset + count), 0);
          planar.set(right.subarray(offset, offset + count), packetSamples);
          const audioFrame = new (globalThis as any).AudioData({
            format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: packetSamples,
            numberOfChannels: 2, timestamp: Math.round(offset * 1e6 / SAMPLE_RATE), data: planar
          });
          try { audioEncoder.encode(audioFrame); } finally { audioFrame.close(); }
          if (audioEncoder.encodeQueueSize > 64) await audioEncoder.flush();
        }
        await audioEncoder.flush();
        if (encoderError) throw encoderError;
        if (audioEncoded === 0) throw new Error('Audio encoder produced no packets.');
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
        if (videoEncoder.encodeQueueSize > 12) await videoEncoder.flush();
        if (index % Math.max(1, Math.round(project.fps / 2)) === 0) {
          onProgress({
            stage: 'rendering',
            stageMessage: `Rendering video ${Math.min(project.exportRange.duration, (index + 1) / project.fps).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
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
      onProgress({ stage: 'finalizing', stageMessage: 'Muxing synchronized constant-frame-rate video...', progress: 95 });
      muxer.finalize();
      const buffer = muxer.target.buffer as ArrayBuffer | null;
      if (!buffer || buffer.byteLength < 1024) throw new Error('The offline video file was empty.');
      const output = new Blob([buffer], { type: 'video/mp4' });
      const outputUrl = URL.createObjectURL(output);
      onProgress({ stage: 'ready', stageMessage: 'Frame-accurate video ready for download.', progress: 100, outputUrl, fileSize: output.size });
      return { outputUrl, fileSize: output.size, format };
    } finally {
      videoEncoder.close();
      if (audioEncoder) audioEncoder.close();
      compositor.dispose();
    }
  }
}
