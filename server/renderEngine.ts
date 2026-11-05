import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { exec, execSync, execFileSync } from 'child_process';
import { promisify } from 'util';
import { CanonicalProjectJson } from '../src/types/projectJson';

const execAsync = promisify(exec);

export interface ExportJob {
  id: string;
  projectName: string;
  stage: 'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'ready' | 'error';
  stageMessage: string;
  progress: number; // 0 to 100
  outputFile?: string;
  outputUrl?: string;
  fileSize?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const activeJobs = new Map<string, ExportJob>();
let cachedBundleLocation: string | null = null;
let isBundling = false;

const RENDER_DATA_DIR = process.env.RENDER_DATA_DIR
  ? path.resolve(process.env.RENDER_DATA_DIR)
  : path.resolve('./public');
const EXPORT_DIR = path.join(RENDER_DATA_DIR, 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const STAGED_DIR = path.join(RENDER_DATA_DIR, 'staged');
if (!fs.existsSync(STAGED_DIR)) {
  fs.mkdirSync(STAGED_DIR, { recursive: true });
}

const FALLBACK_ALBUM_ART_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <radialGradient id="discGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#312e81" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00e676" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#discGrad)" />
  <circle cx="300" cy="300" r="230" fill="none" stroke="url(#neonGlow)" stroke-width="6" opacity="0.6" />
  <circle cx="300" cy="300" r="160" fill="#111827" stroke="#1f2937" stroke-width="4" />
  <circle cx="300" cy="300" r="60" fill="url(#neonGlow)" opacity="0.85" />
  <circle cx="300" cy="300" r="18" fill="#030712" />
</svg>
`)}`;

// Helper: Resolve audio track to local file for FFmpeg muxing
async function prepareAudioForMuxing(
  audioSource: string | null | undefined, 
  jobId: string
): Promise<{ audioPath: string; hasAudio: boolean }> {
  if (!audioSource) {
    return { audioPath: '', hasAudio: false };
  }

  try {
    // 1. Data URI
    if (audioSource.startsWith('data:audio/') || audioSource.startsWith('data:application/')) {
      let ext = '.mp3';
      if (audioSource.includes('audio/mp4') || audioSource.includes('audio/m4a') || audioSource.includes('audio/x-m4a')) ext = '.m4a';
      else if (audioSource.includes('audio/wav')) ext = '.wav';
      else if (audioSource.includes('audio/ogg')) ext = '.ogg';
      const base64 = audioSource.split(',')[1];
      if (base64) {
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}${ext}`);
        fs.writeFileSync(p, Buffer.from(base64, 'base64'));
        return { audioPath: p, hasAudio: true };
      }
    }

    // 2. Staged local file (relative or absolute URL)
    if (audioSource.includes('/staged/')) {
      const stagedIdx = audioSource.indexOf('/staged/');
      const relPath = audioSource.substring(stagedIdx);
      const filename = path.basename(relPath);
      const stagedDiskPath = path.join(STAGED_DIR, filename);
      if (fs.existsSync(stagedDiskPath)) {
        let ext = path.extname(stagedDiskPath) || '.mp3';
        if (ext === '.bin' || !ext) ext = '.mp3';
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}${ext}`);
        fs.copyFileSync(stagedDiskPath, p);
        return { audioPath: p, hasAudio: true };
      }
    }

    // 3. Local API (e.g. /api/suno-audio/...)
    if (audioSource.startsWith('/api/')) {
      const localUrl = `http://localhost:3000${audioSource}`;
      console.log('[RenderEngine] Fetching audio track from local endpoint:', localUrl);
      const res = await fetch(localUrl);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let ext = '.m4a';
        if (contentType.includes('mpeg') || audioSource.endsWith('.mp3')) ext = '.mp3';
        else if (contentType.includes('wav') || audioSource.endsWith('.wav')) ext = '.wav';
        else if (contentType.includes('ogg') || audioSource.endsWith('.ogg')) ext = '.ogg';
        const buf = Buffer.from(await res.arrayBuffer());
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}${ext}`);
        fs.writeFileSync(p, buf);
        return { audioPath: p, hasAudio: true };
      }
    }

    // 4. Other relative path on disk
    if (audioSource.startsWith('/')) {
      const pubPath = path.resolve('./public', '.' + audioSource);
      if (fs.existsSync(pubPath)) {
        const ext = path.extname(pubPath) || '.mp3';
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}${ext}`);
        fs.copyFileSync(pubPath, p);
        return { audioPath: p, hasAudio: true };
      }
      // Try local HTTP fetch
      const localRes = await fetch(`http://localhost:3000${audioSource}`).catch(() => null);
      if (localRes && localRes.ok) {
        const buf = Buffer.from(await localRes.arrayBuffer());
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}.mp3`);
        fs.writeFileSync(p, buf);
        return { audioPath: p, hasAudio: true };
      }
    }

    // 5. Remote HTTP/HTTPS
    if (audioSource.startsWith('http://') || audioSource.startsWith('https://')) {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (audioSource.includes('suno') || audioSource.includes('cloudfront')) {
        headers['Referer'] = 'https://suno.com/';
      }
      const res = await fetch(audioSource, { headers });
      if (res.ok) {
        let ext = '.mp3';
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('mp4') || audioSource.includes('.m4a')) ext = '.m4a';
        else if (ct.includes('wav') || audioSource.includes('.wav')) ext = '.wav';
        const buf = Buffer.from(await res.arrayBuffer());
        const p = path.join(EXPORT_DIR, `temp-audio-${jobId}${ext}`);
        fs.writeFileSync(p, buf);
        return { audioPath: p, hasAudio: true };
      }
    }
  } catch (err) {
    console.warn('[RenderEngine] Warning: Audio extraction failed:', err);
  }

  return { audioPath: '', hasAudio: false };
}

/**
 * Extract frame-aligned soundtrack energy for the server-side visualizer.
 * Remotion renders with audio muted; it cannot use WebAudio's analyser.
 * Analyze the exact exported audio range before rendering instead of
 * animating bars with a fixed BPM/sine-wave that ignores the song.
 */
function analyzeExportAudioEnergy(
  audioPath: string,
  exportStart: number,
  duration: number,
  fps: number
): number[] {
  if (!audioPath || !Number.isFinite(duration) || duration <= 0 || fps <= 0) return [];
  const sampleRate = 8000;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const pcm = execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(Math.max(0, exportStart)),
    '-i', audioPath,
    '-t', String(duration),
    '-vn', '-ac', '1', '-ar', String(sampleRate),
    '-f', 's16le', 'pipe:1'
  ], {
    maxBuffer: Math.max(16 * 1024 * 1024, Math.ceil(duration * sampleRate * 2 + 1024 * 1024))
  });

  const count = Math.floor(pcm.length / 2);
  const envelope = new Array<number>(totalFrames).fill(0);
  // Align each sample window to the exported frame's presentation timestamp.
  // Centered windows follow musical transients rather than playback speed.
  for (let frame = 0; frame < totalFrames; frame++) {
    const center = Math.round((frame + 0.5) * sampleRate / fps);
    const radius = Math.max(1, Math.round(sampleRate / (fps * 2)));
    const from = Math.max(0, center - radius);
    const to = Math.min(count, center + radius);
    let sum = 0;
    for (let i = from; i < to; i++) {
      const sample = pcm.readInt16LE(i * 2) / 32768;
      sum += sample * sample;
    }
    envelope[frame] = to > from ? Math.sqrt(sum / (to - from)) : 0;
  }

  const sorted = [...envelope].sort((a, b) => a - b);
  const reference = Math.max(0.006, sorted[Math.floor((sorted.length - 1) * 0.92)] || 0);
  let lastRms = 0;
  let lastLevel = 0;
  return envelope.map(rms => {
    const base = Math.min(1, rms / reference);
    const onset = Math.max(0, rms - lastRms) / reference;
    const target = Math.min(1, Math.max(0, base * 0.78 + onset * 1.6));
    // Quick attack, gradual release; no fabricated time-based oscillation.
    const level = Math.max(target, lastLevel * 0.56);
    lastRms = rms;
    lastLevel = level;
    return Number(level.toFixed(4));
  });
}

// Helper: Resolve album artwork to reliable data URI so Chrome never gets 403/404
async function resolveAlbumArtDataUri(albumArt: string | null | undefined): Promise<string> {
  if (!albumArt) {
    return FALLBACK_ALBUM_ART_SVG;
  }

  if (albumArt.startsWith('data:image')) {
    return albumArt;
  }

  if (albumArt.startsWith('/staged/')) {
    const filename = path.basename(albumArt);
    const stagedDiskPath = path.join(STAGED_DIR, filename);
    if (fs.existsSync(stagedDiskPath)) {
      const mime = albumArt.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${fs.readFileSync(stagedDiskPath).toString('base64')}`;
    }
  }

  if (albumArt.startsWith('/')) {
    const pubPath = path.resolve('./public', '.' + albumArt);
    if (fs.existsSync(pubPath)) {
      const mime = albumArt.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${fs.readFileSync(pubPath).toString('base64')}`;
    }
  }

  if (albumArt.startsWith('http://') || albumArt.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      if (albumArt.includes('suno')) {
        headers['Referer'] = 'https://suno.com/';
      }
      const res = await fetch(albumArt, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const mime = res.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[RenderEngine] Remote albumArt fetch failed, falling back:', e);
    }
  }

  return FALLBACK_ALBUM_ART_SVG;
}

// Helper: Sanitize background images
async function resolveBackgroundImageDataUri(bg: CanonicalProjectJson['background']) {
  if (!bg) return;

  if (bg.type === 'image' && bg.value) {
    if (bg.value.startsWith('data:image')) return;
    if (bg.value.startsWith('/staged/')) {
      const p = path.join(STAGED_DIR, path.basename(bg.value));
      if (fs.existsSync(p)) {
        const mime = bg.value.endsWith('.png') ? 'image/png' : 'image/jpeg';
        bg.value = `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
        return;
      }
    }
    if (bg.value.startsWith('/')) {
      const p = path.resolve('./public', '.' + bg.value);
      if (fs.existsSync(p)) {
        const mime = bg.value.endsWith('.png') ? 'image/png' : 'image/jpeg';
        bg.value = `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
      }
    }
  }

  if (bg.type === 'video' && bg.videoUrl && bg.videoUrl.startsWith('/')) {
    bg.videoUrl = `http://localhost:3000${bg.videoUrl}`;
  }
}

export async function getRemotionBundle(): Promise<string> {
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation;
  }

  if (isBundling) {
    // Wait for bundling to complete
    while (isBundling) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
      return cachedBundleLocation;
    }
  }

  isBundling = true;
  try {
    const entryPoint = path.resolve('./src/remotion/index.ts');
    console.log('[RenderEngine] Bundling Remotion components from:', entryPoint);

    const bundleLocation = await bundle({
      entryPoint,
      publicDir: path.resolve('./public'),
      webpackOverride: (config) => config
    });

    cachedBundleLocation = bundleLocation;
    console.log('[RenderEngine] Remotion bundle ready at:', bundleLocation);
    return bundleLocation;
  } finally {
    isBundling = false;
  }
}

/**
 * Remotion serves media from its isolated bundle directory, not the Express
 * public directory. New uploads arrive after the bundle is cached, so copying
 * public/ once at bundle time is not sufficient.
 */
function synchronizeStagedMedia(bundleLocation: string, project: CanonicalProjectJson): void {
  const urls = [
    ...(project.videoClips || []).map(clip => clip.url),
    project.background?.value,
    project.background?.videoUrl,
    project.audio?.albumArt
  ];
  for (const url of urls) {
    if (!url || !url.startsWith('/staged/')) continue;
    const filename = path.basename(url.split(/[?#]/)[0]);
    if (!filename || filename === '.' || filename === '..') {
      throw new Error('Invalid staged media filename');
    }
    const source = path.join(STAGED_DIR, filename);
    if (!fs.existsSync(source)) {
      throw new Error(`Video export asset not found: ${filename}. Please reimport this clip and retry.`);
    }
    const destinationDir = path.join(bundleLocation, 'staged');
    fs.mkdirSync(destinationDir, { recursive: true });
    const destination = path.join(destinationDir, filename);
    if (!fs.existsSync(destination) || fs.statSync(destination).size !== fs.statSync(source).size) {
      fs.copyFileSync(source, destination);
    }
  }
}

export function getExportJob(jobId: string): ExportJob | undefined {
  return activeJobs.get(jobId);
}

export async function startExportJob(projectJson: CanonicalProjectJson): Promise<string> {
  const jobId = `export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const job: ExportJob = {
    id: jobId,
    projectName: projectJson.projectName || 'Joelizer Production Video',
    stage: 'preparing',
    stageMessage: 'Preparing project assets and timeline configuration...',
    progress: 5,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  activeJobs.set(jobId, job);

  // Execute job asynchronously in background
  executeRenderPipeline(jobId, projectJson).catch((err) => {
    console.error(`[RenderEngine] Export job ${jobId} failed:`, err);
    activeJobs.set(jobId, {
      ...job,
      stage: 'error',
      stageMessage: 'Export rendering failed',
      error: err.message || 'Unknown render error occurred',
      progress: 0,
      updatedAt: Date.now()
    });
  });

  return jobId;
}

async function executeRenderPipeline(jobId: string, projectJson: CanonicalProjectJson) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const updateProgress = (stage: ExportJob['stage'], message: string, pct: number) => {
    job.stage = stage;
    job.stageMessage = message;
    job.progress = Math.min(100, Math.max(0, Math.round(pct)));
    job.updatedAt = Date.now();
    activeJobs.set(jobId, { ...job });
  };

  try {
    // STAGE 1: PREPARING ASSETS & COMPOSITION
    updateProgress('preparing', 'Resolving media assets and bundling components...', 10);
    const bundleLocation = await getRemotionBundle();
    synchronizeStagedMedia(bundleLocation, projectJson);

    // 1a. Extract audio to disk for FFmpeg muxing
    const audioSource = projectJson.audio?.audioDataUri || projectJson.audio?.url;
    const { audioPath, hasAudio } = await prepareAudioForMuxing(audioSource, jobId);
    if (audioSource && !hasAudio) {
      throw new Error('Audio export failed: the selected soundtrack could not be loaded for muxing.');
    }

    // Generate deterministic, actual-audio-driven visualizer frames before
    // muting the Remotion preview and muxing the soundtrack later.
    let visualizerAudioLevels: number[] | undefined;
    const needsVisualizer = projectJson.showVisualizer ?? projectJson.visualizer?.enabled ?? true;
    if (hasAudio && needsVisualizer) {
      try {
        visualizerAudioLevels = analyzeExportAudioEnergy(
          audioPath, projectJson.exportRange.start,
          projectJson.exportRange.duration, projectJson.fps
        );
      } catch (error) {
        console.warn('[RenderEngine] Cannot analyze soundtrack for visualizer:', error);
        // Keep exporting other layers, but never pretend the visualizer is
        // beat-synchronized when no real soundtrack analysis is available.
      }
    }

    // 1b. Sanitize album artwork to base64 data URI (bypasses 403s & cross-origin network errors)
    const sanitizedAlbumArt = await resolveAlbumArtDataUri(projectJson.audio?.albumArt);

    // 1c. Sanitize background images
    await resolveBackgroundImageDataUri(projectJson.background);

    // 1d. Create Remotion-safe project payload (removes remote audio so Chrome renders frames with zero network lag)
    const remotionProjectJson: CanonicalProjectJson = {
      ...projectJson,
      visualizerAudioLevels,
      audio: {
        ...projectJson.audio,
        albumArt: sanitizedAlbumArt,
        url: null,
        audioDataUri: null
      }
    };

    updateProgress('preparing', 'Configuring composition dimensions and frames...', 20);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'JoelizerVideo',
      inputProps: { projectJson: remotionProjectJson }
    });

    const tempRawVideoPath = path.join(EXPORT_DIR, `temp-${jobId}.mp4`);
    const finalMp4Path = path.join(EXPORT_DIR, `${jobId}.mp4`);

    // STAGE 2: RENDERING VIDEO FRAMES (Muted in Remotion; audio is muxed in Stage 3)
    updateProgress('rendering', 'Rendering video frames with Remotion renderer...', 25);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      outputLocation: tempRawVideoPath,
      inputProps: { projectJson: remotionProjectJson },
      codec: 'h264',
      // Deterministic, high-detail H.264. Slow preset affects render time,
      // not playback smoothness; constant frame rate comes from Remotion.
      crf: 16,
      x264Preset: 'slow',
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      imageFormat: 'png',
      muted: true,
      concurrency: 1, // Single concurrency to prevent container OOM
      timeoutInMilliseconds: 60000,
      onProgress: ({ progress }) => {
        // Map Remotion render progress from 25% to 75%
        const currentPct = 25 + progress * 50;
        updateProgress('rendering', `Rendering frames: ${(progress * 100).toFixed(0)}%`, currentPct);
      }
    });

    // STAGE 3: ENCODING & AUDIO MUXING WITH FFMPEG
    updateProgress('encoding', 'Muxing audio track and encoding H.264/AAC with FFmpeg...', 80);

    const hasValidAudio = hasAudio && fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0;
    if (hasValidAudio) {
      const startTime = Math.max(0, projectJson.exportRange?.start || 0);
      const duration = projectJson.exportRange?.duration || (composition.durationInFrames / composition.fps);

      // Try stream-copy mux first (fastest) with optional audio stream map
      const ffmpegCmd = `ffmpeg -y -i "${tempRawVideoPath}" -ss ${startTime} -t ${duration} -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -af apad -t ${duration} -movflags +faststart "${finalMp4Path}"`;
      
      try {
        await execAsync(ffmpegCmd);
      } catch (muxErr) {
        console.warn('[RenderEngine] Stream copy mux failed, trying re-encode pass:', muxErr);
        try {
          const fallbackCmd = `ffmpeg -y -i "${tempRawVideoPath}" -ss ${startTime} -t ${duration} -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v libx264 -pix_fmt yuv420p -preset slow -crf 16 -c:a aac -b:a 320k -ar 48000 -af apad -t ${duration} -movflags +faststart "${finalMp4Path}"`;
          await execAsync(fallbackCmd);
        } catch (reEncodeErr) {
          // Do not report success with a silent MP4 when the requested audio failed to mux.
          throw new Error('Video frames rendered but soundtrack muxing failed: ' +
            (reEncodeErr instanceof Error ? reEncodeErr.message : String(reEncodeErr)));
        }
      }

      // Cleanup temp audio file
      try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (_) {}
    } else {
      // Faststart pass for video without audio
      const copyCmd = `ffmpeg -y -i "${tempRawVideoPath}" -c:v copy -movflags +faststart "${finalMp4Path}"`;
      try {
        await execAsync(copyCmd);
      } catch (_) {
        fs.copyFileSync(tempRawVideoPath, finalMp4Path);
      }
    }

    // Clean up temp raw video if it still exists
    if (fs.existsSync(tempRawVideoPath)) {
      try { fs.unlinkSync(tempRawVideoPath); } catch (_) {}
    }

    // STAGE 4: FINALIZING
    updateProgress('finalizing', 'Finalizing production MP4 video...', 95);

    if (!fs.existsSync(finalMp4Path)) {
      throw new Error('Exported video file was not generated');
    }

    const stats = fs.statSync(finalMp4Path);
    if (stats.size === 0) {
      throw new Error('Exported video file is empty (0 bytes)');
    }

    // A non-empty MP4 can still contain a single frame or a truncated stream.
    // Probe the actual encoded duration before exposing a download to the user.
    const expectedDuration = composition.durationInFrames / composition.fps;
    const { stdout: probeOutput } = await execAsync(
      `ffprobe -v error -show_entries stream=codec_type,duration,nb_frames -show_entries format=duration -of json "${finalMp4Path}"`,
      { timeout: 30000 }
    );
    const probe = JSON.parse(probeOutput);
    const videoStream = probe.streams?.find((stream: any) => stream.codec_type === 'video');
    if (hasValidAudio && !probe.streams?.some((stream: any) => stream.codec_type === 'audio')) {
      throw new Error('Export verification failed: requested soundtrack is absent from the final MP4');
    }
    if (!videoStream) throw new Error('Export verification failed: MP4 contains no video stream');
    const actualDuration = Number(videoStream.duration || probe.format?.duration);
    const minimumDuration = Math.max(0, expectedDuration - Math.max(0.2, 2 / composition.fps));
    if (!Number.isFinite(actualDuration) || actualDuration < minimumDuration) {
      throw new Error(`Export verification failed: expected ${expectedDuration.toFixed(2)}s of video, got ${actualDuration.toFixed(2)}s`);
    }
    const frameCount = Number(videoStream.nb_frames);
    if (Number.isFinite(frameCount) && frameCount > 0 && frameCount < Math.floor(minimumDuration * composition.fps)) {
      throw new Error(`Export verification failed: only ${frameCount} video frames encoded`);
    }

    job.fileSize = stats.size;
    job.outputFile = finalMp4Path;
    job.outputUrl = `/api/download-export/${jobId}`;

    // STAGE 5: DOWNLOAD READY
    updateProgress('ready', 'Download Ready', 100);
    console.log(`[RenderEngine] Export ${jobId} completed successfully. File size: ${stats.size} bytes.`);
  } catch (err: any) {
    console.error(`[RenderEngine] Render pipeline failed for ${jobId}:`, err);
    activeJobs.set(jobId, {
      ...job,
      stage: 'error',
      stageMessage: 'Video rendering failed',
      error: err.message || 'Render process failed',
      progress: 0,
      updatedAt: Date.now()
    });
  }
}

// Requirement 15: Automated 10-second render test
export async function runAutomatedRenderTest(): Promise<{ success: boolean; durationMs: number; message: string }> {
  const startTime = Date.now();
  console.log('[RenderEngine] Running automated 10-second render verification test...');

  const testJson: CanonicalProjectJson = {
    version: '1.0',
    exportMode: 'lyrics-video',
    projectName: 'Automated 10s Render Test',
    aspectRatio: '16:9',
    fps: 30,
    resolution: '360p', // Fast test resolution
    width: 640,
    height: 360,
    exportRange: {
      start: 0,
      end: 10,
      duration: 10
    },
    audio: {
      url: null,
      title: 'Test Track',
      artist: 'Joelizer Engine',
      albumArt: null,
      duration: 10
    },
    lyrics: {
      lines: [
        { id: 't-1', startTime: 1, endTime: 5, text: 'Automated Render Engine Verification' },
        { id: 't-2', startTime: 6, endTime: 9, text: 'Server Rendering System Ready' }
      ],
      fontFamily: 'Inter',
      fontWeight: '700',
      fontSizeScale: 1.0,
      textColor: '#ffffff',
      activeWordColor: '#00e676',
      inactiveWordColor: '#888888',
      glowColor: '#00e676',
      showContainerPill: true,
      pillBgColor: 'rgba(0,0,0,0.8)',
      animationStyle: 'karaoke'
    },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
      blurAlbumArt: false
    },
    artwork: {
      style: 'vinyl',
      animation: 'rotate',
      sizeScale: 1.0
    },
    visualizer: {
      style: 'bars',
      color: '#00e676',
      sensitivity: 0.95,
      smoothing: 0.65,
      segments: 8,
      hitResponse: 0.15,
      glitchIntensity: 0,
      shakeIntensity: 0,
      showGrain: false,
      showScanlines: false
    },
    videoClips: [],
    effects: {
      showGrain: false,
      showScanlines: false,
      glow: true,
      vignette: true
    },
    safeArea: false
  };

  try {
    const jobId = await startExportJob(testJson);

    // Poll until complete or error
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 1000));
      const j = getExportJob(jobId);
      if (j) {
        if (j.stage === 'ready') {
          const durationMs = Date.now() - startTime;
          return {
            success: true,
            durationMs,
            message: `Render test passed in ${(durationMs / 1000).toFixed(1)}s. File size: ${j.fileSize} bytes.`
          };
        }
        if (j.stage === 'error') {
          return {
            success: false,
            durationMs: Date.now() - startTime,
            message: `Render test failed: ${j.error}`
          };
        }
      }
      attempts++;
    }

    return {
      success: false,
      durationMs: Date.now() - startTime,
      message: 'Render test timed out after 60 seconds'
    };
  } catch (err: any) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      message: `Render test exception: ${err.message}`
    };
  }
}
