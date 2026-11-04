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
  onProgress: (progress: RenderProgress) => void
): Promise<{ outputUrl: string; fileSize: number; format: 'mp4' }> {
  if (audioBuffer && !(await canEncodeAudio('aac'))) {
    registerAacEncoder();
  }
  const target = new BufferTarget();
  const output = new Output({ target, format: new Mp4OutputFormat() });
  const bitrate = Math.max(3_000_000,
    Math.min(25_000_000, Math.round(project.width * project.height * project.fps * 0.12)));
  const videoSource = new CanvasSource(compositor.canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate })
  });
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
  const withTimeout = async <T,>(promise: Promise<T>, label: string, ms = 45000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(
            `${label} stalled. Try a shorter export range or 720p/30 FPS. Imported media may be unsupported.`
          )), ms);
        })
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
  await withTimeout(output.start(), 'Starting MP4 encoder');
  try {
    onProgress({ stage: 'preparing', stageMessage: 'Loading clips and synchronizing soundtrack...', progress: 5 });
    await withTimeout(compositor.prepare(), 'Loading imported MV clips', 60000);
    onProgress({ stage: 'rendering', stageMessage: 'Media loaded. Beginning video and audio export...', progress: 12 });
    const totalFrames = Math.max(1, Math.ceil(project.exportRange.duration * project.fps));
    let audioUntilSeconds = 0;
    for (let index = 0; index < totalFrames; index++) {
      const time = project.exportRange.start + index / project.fps;
      await withTimeout(compositor.frame(time), 'Decoding a source video frame');
      await withTimeout(videoSource.add(index / project.fps, 1 / project.fps, {
        keyFrame: index % (project.fps * 2) === 0
      }), 'Encoding a video frame');
      // Keep the audio track no further than about one second ahead of the
      // video track. This prevents packet buffering from blocking the writer.
      const videoUntilSeconds = (index + 1) / project.fps;
      if (audioSource && audioBuffer &&
          (videoUntilSeconds >= audioUntilSeconds + audioChunkSeconds - 0.0001 ||
           index === totalFrames - 1)) {
        const nextUntil = Math.min(project.exportRange.duration,
          Math.max(videoUntilSeconds, audioUntilSeconds + audioChunkSeconds));
        const buffer = copyAudioWindow(audioUntilSeconds, nextUntil - audioUntilSeconds);
        if (buffer) {
          onProgress({ stage: 'encoding', stageMessage:
            `Encoding sound ${Math.min(nextUntil, project.exportRange.duration).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
            progress: 15 + Math.round(index / totalFrames * 75) });
          await withTimeout(audioSource.add(buffer), 'Encoding AAC soundtrack');
        }
        audioUntilSeconds = nextUntil;
      }
      if (index % Math.max(1, Math.round(project.fps / 2)) === 0) {
        onProgress({
          stage: 'rendering',
          stageMessage: `Rendering video ${Math.min(project.exportRange.duration, (index + 1) / project.fps).toFixed(1)}s / ${project.exportRange.duration.toFixed(1)}s...`,
          progress: 15 + Math.round(index / totalFrames * 75)
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
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
    compositor.dispose();
  }
}
