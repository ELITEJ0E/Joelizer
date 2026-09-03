import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';
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

const EXPORT_DIR = path.resolve('./public/exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const STAGED_DIR = path.resolve('./public/staged');
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

    // 2. Staged local file
    if (audioSource.startsWith('/staged/')) {
      const filename = path.basename(audioSource);
      const stagedDiskPath = path.join(STAGED_DIR, filename);
      if (fs.existsSync(stagedDiskPath)) {
        const ext = path.extname(stagedDiskPath) || '.mp3';
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
      webpackOverride: (config) => config
    });

    cachedBundleLocation = bundleLocation;
    console.log('[RenderEngine] Remotion bundle ready at:', bundleLocation);
    return bundleLocation;
  } finally {
    isBundling = false;
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

    // 1a. Extract audio to disk for FFmpeg muxing
    const audioSource = projectJson.audio?.audioDataUri || projectJson.audio?.url;
    const { audioPath, hasAudio } = await prepareAudioForMuxing(audioSource, jobId);

    // 1b. Sanitize album artwork to base64 data URI (bypasses 403s & cross-origin network errors)
    const sanitizedAlbumArt = await resolveAlbumArtDataUri(projectJson.audio?.albumArt);

    // 1c. Sanitize background images
    await resolveBackgroundImageDataUri(projectJson.background);

    // 1d. Create Remotion-safe project payload (removes remote audio so Chrome renders frames with zero network lag)
    const remotionProjectJson: CanonicalProjectJson = {
      ...projectJson,
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
      muted: true,
      concurrency: 2,
      onProgress: ({ progress }) => {
        // Map Remotion render progress from 25% to 75%
        const currentPct = 25 + progress * 50;
        updateProgress('rendering', `Rendering frames: ${(progress * 100).toFixed(0)}%`, currentPct);
      }
    });

    // STAGE 3: ENCODING & AUDIO MUXING WITH FFMPEG
    updateProgress('encoding', 'Muxing pristine audio track and encoding H.264/AAC with FFmpeg...', 80);

    if (hasAudio && fs.existsSync(audioPath)) {
      const startTime = projectJson.exportRange?.start || 0;
      const duration = projectJson.exportRange?.duration || (composition.durationInFrames / composition.fps);

      const ffmpegCmd = `ffmpeg -y -i "${tempRawVideoPath}" -ss ${startTime} -t ${duration} -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${finalMp4Path}"`;
      
      try {
        await execAsync(ffmpegCmd);
      } catch (muxErr) {
        console.warn('[RenderEngine] Stream copy mux failed, trying re-encode pass:', muxErr);
        const fallbackCmd = `ffmpeg -y -i "${tempRawVideoPath}" -ss ${startTime} -t ${duration} -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v libx264 -pix_fmt yuv420p -preset fast -c:a aac -b:a 192k -shortest -movflags +faststart "${finalMp4Path}"`;
        await execAsync(fallbackCmd);
      }

      // Cleanup temp audio file
      try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (_) {}
    } else {
      // Faststart pass for video without audio
      const copyCmd = `ffmpeg -y -i "${tempRawVideoPath}" -c:v copy -movflags +faststart "${finalMp4Path}"`;
      try {
        await execAsync(copyCmd);
      } catch (_) {
        fs.renameSync(tempRawVideoPath, finalMp4Path);
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
