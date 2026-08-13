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
    // STAGE 1: PREPARING
    updateProgress('preparing', 'Bundling rendering components...', 10);
    const bundleLocation = await getRemotionBundle();

    updateProgress('preparing', 'Configuring composition dimensions and frames...', 20);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'JoelizerVideo',
      inputProps: { projectJson }
    });

    const tempRawVideoPath = path.join(EXPORT_DIR, `temp-${jobId}.mp4`);
    const finalMp4Path = path.join(EXPORT_DIR, `${jobId}.mp4`);

    // STAGE 2: RENDERING
    updateProgress('rendering', 'Rendering video frames with Remotion renderer...', 25);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      outputLocation: tempRawVideoPath,
      inputProps: { projectJson },
      codec: 'h264',
      onProgress: ({ progress }) => {
        // Map Remotion render progress from 25% to 75%
        const currentPct = 25 + progress * 50;
        updateProgress('rendering', `Rendering frames: ${(progress * 100).toFixed(0)}%`, currentPct);
      }
    });

    // STAGE 3: ENCODING & AUDIO MUXING
    updateProgress('encoding', 'Muxing audio track and encoding H.264/AAC with FFmpeg...', 80);

    const audioUrlOrUri = projectJson.audio.audioDataUri || projectJson.audio.url;
    let hasAudioToMux = false;
    let tempAudioPath = '';

    if (audioUrlOrUri) {
      try {
        if (audioUrlOrUri.startsWith('data:audio/') || audioUrlOrUri.startsWith('data:application/')) {
          tempAudioPath = path.join(EXPORT_DIR, `temp-audio-${jobId}.mp3`);
          const base64Data = audioUrlOrUri.split(',')[1];
          if (base64Data) {
            fs.writeFileSync(tempAudioPath, Buffer.from(base64Data, 'base64'));
            hasAudioToMux = true;
          }
        } else if (audioUrlOrUri.startsWith('http')) {
          tempAudioPath = path.join(EXPORT_DIR, `temp-audio-${jobId}.mp3`);
          const res = await fetch(audioUrlOrUri);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            fs.writeFileSync(tempAudioPath, Buffer.from(arrayBuf));
            hasAudioToMux = true;
          }
        }
      } catch (audioErr) {
        console.warn('[RenderEngine] Warning: Audio fetch/parse for FFmpeg muxing failed:', audioErr);
      }
    }

    // Execute FFmpeg for final production pass
    if (hasAudioToMux && fs.existsSync(tempAudioPath)) {
      updateProgress('encoding', 'Encoding final MP4 with libx264 + AAC audio...', 88);
      const startTime = projectJson.exportRange?.start || 0;
      const duration = projectJson.exportRange?.duration || composition.durationInFrames / composition.fps;

      const ffmpegCmd = `ffmpeg -y -i "${tempRawVideoPath}" -ss ${startTime} -t ${duration} -i "${tempAudioPath}" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${finalMp4Path}"`;
      
      try {
        await execAsync(ffmpegCmd);
      } catch (ffmpegErr) {
        console.warn('[RenderEngine] FFmpeg copy/mux fallback, trying re-encode:', ffmpegErr);
        const fallbackCmd = `ffmpeg -y -i "${tempRawVideoPath}" -c:v copy "${finalMp4Path}"`;
        await execAsync(fallbackCmd);
      }

      // Cleanup temp audio file
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
    } else {
      // No extra audio file needed (or already rendered inside remotion)
      fs.renameSync(tempRawVideoPath, finalMp4Path);
    }

    // Clean up temp raw video if it still exists
    if (fs.existsSync(tempRawVideoPath)) {
      try { fs.unlinkSync(tempRawVideoPath); } catch (_) {}
    }

    // STAGE 4: FINALIZING
    updateProgress('finalizing', 'Finalizing export file...', 95);

    const stats = fs.statSync(finalMp4Path);
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
