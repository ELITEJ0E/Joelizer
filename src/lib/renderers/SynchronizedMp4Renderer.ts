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

  await output.start();
  try {
    onProgress({ stage: 'preparing', stageMessage: 'Loading clips and synchronizing soundtrack...', progress: 5 });
    await compositor.prepare();
    if (audioSource && audioBuffer) {
      onProgress({ stage: 'encoding', stageMessage: 'Preparing gapless soundtrack...', progress: 10 });
      await audioSource.add(audioBuffer);
      audioSource.close();
    }

    const totalFrames = Math.max(1, Math.ceil(project.exportRange.duration * project.fps));
    for (let index = 0; index < totalFrames; index++) {
      const time = project.exportRange.start + index / project.fps;
      await compositor.frame(time);
      await videoSource.add(index / project.fps, 1 / project.fps, {
        keyFrame: index % (project.fps * 2) === 0
      });
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
    onProgress({ stage: 'finalizing', stageMessage: 'Finalizing synchronized video and audio...', progress: 95 });
    await output.finalize();
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
