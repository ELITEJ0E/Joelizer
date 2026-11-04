import type { CanonicalProjectJson } from '../../types/projectJson';
import type { RenderProgress } from './types';
import { OfflineFrameCompositor } from './OfflineFrameCompositor';
import {
  AudioBufferSource, BufferTarget, CanvasSource, Output, Quality, Mp4OutputFormat, canEncodeAudio
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

/**
 * MP4/AAC export with a WASM fallback for browsers without native AAC encoding.
 * Let Mediabunny own both the audio packet boundaries and MP4 muxing:
 * the previous WebM/Opus path emitted malformed packet headers and silent
 * gaps despite a valid-looking file.
 * Both sources are synchronized in absolute seconds, no real-time recorder.
 */
export async function renderSynchronizedMp4(
  project: CanonicalProjectJson,
  compositor: OfflineFrameCompositor,
  audioBuffer: AudioBuffer | null,
  onProgress: (progress: RenderProgress) => void,
  videoConfig?: any,
  signal?: AbortSignal
): Promise<{ outputUrl: string; fileSize: number; format: 'mp4' }> {
  if (audioBuffer && !(await canEncodeAudio('aac'))) {
    registerAacEncoder();
  }
  const target = new BufferTarget();
  const output = new Output({ target, format: new Mp4OutputFormat() });
  const bitrate = videoConfig?.bitrate || Math.max(3_000_000,
    Math.min(25_000_000, Math.round(project.width * project.height * project.fps * 0.12)));

  const videoSourceOptions: any = {
    codec: 'avc',
    quality: new Quality({ bitrate })
  };
  if (videoConfig?.codec) {
    videoSourceOptions.fullCodecString = videoConfig.codec;
  }
  if (videoConfig?.hardwareAcceleration) {
    videoSourceOptions.hardwareAcceleration = videoConfig.hardwareAcceleration;
  }
  if (videoConfig?.latencyMode) {
    videoSourceOptions.latencyMode = videoConfig.latencyMode;
  }

  const videoSource = new CanvasSource(compositor.canvas, videoSourceOptions);
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  if (audioBuffer) {
    audioSource = new AudioBufferSource({
      codec: 'aac', quality: new Quality('high')
    });
    output.addAudioTrack(audioSource);
  }

  // Feed soundtrack alongside the video in short intervals. Adding a
  // four-minute AudioBuffer in one await can saturate the muxer's packet
  // buffer before a single video packet exists and block indefinitely.
  const audioChunkSeconds = 1;
  const copyAudioWindow = (startSeconds: number, durationSeconds: number): AudioBuffer | null => {
    if (!audioBuffer) return null;
    const firstSample = Math.round(startSeconds * audioBuffer.sampleRate);
    if (firstSample >= audioBuffer.length) return null;
    const count = Math.min(audioBuffer.length - firstSample,
      Math.max(1, Math.round(durationSeconds * audioBuffer.sampleRate)));
    const chunk = new AudioBuffer({
      length: count, sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels
    });
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      chunk.copyToChannel(audioBuffer.getChannelData(channel).subarray(firstSample, firstSample + count), channel);
    }
    return chunk;
  };
  const withTimeout = async <T,>(promise: Promise<T>, label: string, ms = 60000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(
            `${label} stalled after ${Math.round(ms / 1000)}s at ${project.width}×${project.height} (${project.resolution} @ ${project.fps} FPS). ` +
            `This can occur if the GPU is under high memory pressure or an imported source video could not be decoded. ` +
            `Try 720p/30 FPS or verify source clip formats.`
          )), ms);
        })
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };

  try {
    if (signal?.aborted) throw new Error('Export cancelled by user.');
    await withTimeout(output.start(), 'Starting MP4 encoder');
    onProgress({ stage: 'preparing', stageMessage: 'Loading clips and synchronizing soundtrack...', progress: 5 });
    await withTimeout(compositor.prepare(), 'Loading imported MV clips', 60000);
    onProgress({ stage: 'rendering', stageMessage: 'Media loaded. Beginning video and audio export...', progress: 12 });

    const totalFrames = Math.max(1, Math.ceil(project.exportRange.duration * project.fps));
    const is1080pOrHigher = project.width >= 1920 || project.height >= 1080;
    let audioUntilSeconds = 0;
    let lastLogTime = performance.now();
    let totalDecodeMs = 0;
    let totalEncodeMs = 0;

    console.info(
      `[MP4 Export Pipeline] Started ${project.resolution} (${project.width}×${project.height} @ ${project.fps} FPS) ` +
      `| totalFrames: ${totalFrames} | codec: ${videoConfig?.codec || 'avc1'} | bitrate: ${(bitrate / 1e6).toFixed(1)} Mbps`
    );

    for (let index = 0; index < totalFrames; index++) {
      if (signal?.aborted) {
        throw new Error('Export cancelled by user.');
      }
      const time = project.exportRange.start + index / project.fps;

      // 1. Decode & composite frame with separate timing
      const t0 = performance.now();
      await withTimeout(
        compositor.frame(time),
        `Decoding source video frame ${index + 1}/${totalFrames} at ${time.toFixed(2)}s`
      );
      const tDecode = performance.now() - t0;
      totalDecodeMs += tDecode;

      // 2. Encode video frame into MP4 track with separate timing
      const t1 = performance.now();
      await withTimeout(
        videoSource.add(index / project.fps, 1 / project.fps, {
          keyFrame: index % (project.fps * 2) === 0
        }),
        `Encoding video frame ${index + 1}/${totalFrames}`
      );
      const tEncode = performance.now() - t1;
      totalEncodeMs += tEncode;

      // 3. Audio track synchronization in short intervals
      const videoUntilSeconds = (index + 1) / project.fps;
      if (audioSource && audioBuffer &&
          (videoUntilSeconds >= audioUntilSeconds + audioChunkSeconds - 0.0001 ||
           index === totalFrames - 1)) {
        const nextUntil = Math.min(project.exportRange.duration,
          Math.max(videoUntilSeconds, audioUntilSeconds + audioChunkSeconds));
        const buffer = copyAudioWindow(audioUntilSeconds, nextUntil - audioUntilSeconds);
        if (buffer) {
          onProgress({
            stage: 'encoding',
            stageMessage: `Encoding sound ${Math.min(nextUntil, project.exportRange.duration).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
            progress: 15 + Math.round(index / totalFrames * 75)
          });
          await withTimeout(audioSource.add(buffer), 'Encoding AAC soundtrack');
        }
        audioUntilSeconds = nextUntil;
      }

      // 4. Periodic progress reporting and diagnostic instrumentation
      const now = performance.now();
      if (now - lastLogTime > 1500 || index === totalFrames - 1 || index === 0) {
        lastLogTime = now;
        const memoryMB = (performance as any).memory?.usedJSHeapSize
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : null;

        console.log(
          `[Export Diagnostic] Frame ${index + 1}/${totalFrames} (${Math.round((index + 1) / totalFrames * 100)}%) ` +
          `| decode: ${tDecode.toFixed(1)}ms (avg ${(totalDecodeMs / (index + 1)).toFixed(1)}ms) ` +
          `| encode: ${tEncode.toFixed(1)}ms (avg ${(totalEncodeMs / (index + 1)).toFixed(1)}ms) ` +
          (memoryMB ? `| heap: ${memoryMB}MB` : '')
        );

        onProgress({
          stage: 'rendering',
          stageMessage: `Rendering ${project.resolution} video ${Math.min(project.exportRange.duration, (index + 1) / project.fps).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
          progress: 15 + Math.round(index / totalFrames * 75)
        });
      }

      // 5. Pacing yield: Yield to macrotask loop to allow browser GPU thread
      // to process video decoding/encoding tasks and garbage collection
      if (is1080pOrHigher || index % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (signal?.aborted) throw new Error('Export cancelled by user.');
    videoSource.close();
    audioSource?.close();
    onProgress({ stage: 'finalizing', stageMessage: 'Finalizing synchronized video and audio...', progress: 95 });
    await withTimeout(output.finalize(), 'Finalizing MP4', 120000);
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 1024) throw new Error('MP4 export file is empty.');
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const outputUrl = URL.createObjectURL(blob);
    onProgress({ stage: 'ready', stageMessage: 'Smooth video export ready.', progress: 100,
      outputUrl, fileSize: blob.size });
    return { outputUrl, fileSize: blob.size, format: 'mp4' };
  } finally {
    try { videoSource.close(); } catch {}
    try { audioSource?.close(); } catch {}
    compositor.dispose();
  }
}
