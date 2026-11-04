import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Get or load the FFmpeg WASM instance on-demand.
 * This runs client-side in the browser when an uploaded media file uses
 * an incompatible codec (e.g. HEVC / ProRes / unsupported MOV) that the browser
 * HTMLMediaElement cannot decode.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    try {
      await ffmpeg.load();
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (err) {
      loadPromise = null;
      throw new Error(`FFmpeg WASM engine could not be initialized: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  return loadPromise;
}

/**
 * Transcode an unsupported video file (HEVC, Apple ProRes, AVI, MKV, etc.)
 * into a standard, universal H.264 (yuv420p) MP4 video playable in all browsers.
 */
export async function transcodeToH264Mp4(
  sourceUrlOrBlob: string | Blob,
  options?: {
    maxDuration?: number;
    scale?: string; // e.g. '1280:-2' or '1920:-2'
    onProgress?: (ratio: number) => void;
  }
): Promise<string> {
  const ffmpeg = await getFFmpeg();

  const fileData = await fetchFile(sourceUrlOrBlob);
  const inputName = 'input_media.bin';
  const outputName = 'transcoded_output.mp4';

  await ffmpeg.writeFile(inputName, fileData);

  const progressHandler = ({ progress }: { progress: number }) => {
    if (options?.onProgress && Number.isFinite(progress)) {
      options.onProgress(Math.max(0, Math.min(1, progress)));
    }
  };

  ffmpeg.on('progress', progressHandler);

  try {
    const args = [
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    ];

    if (options?.scale) {
      args.push('-vf', `scale=${options.scale}`);
    }

    if (options?.maxDuration && options.maxDuration > 0) {
      args.push('-t', options.maxDuration.toString());
    }

    args.push('-c:a', 'aac', '-b:a', '128k', outputName);

    await ffmpeg.exec(args);

    const outData = await ffmpeg.readFile(outputName);
    const blob = new Blob([outData as Uint8Array], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
  } finally {
    ffmpeg.off('progress', progressHandler);
    try {
      await ffmpeg.deleteFile(inputName);
    } catch { /* cleanup ignore */ }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch { /* cleanup ignore */ }
  }
}
