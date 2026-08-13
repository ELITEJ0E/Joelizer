import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Health Check
app.get('/api/mv/health', (req, res) => {
  res.json({ status: 'online', version: '1.0.0' });
});

// 2. Video Analysis
app.post('/api/mv/analyze-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file' });
    const videoPath = req.file.path;

    // Use ffprobe to get duration, resolution, fps
    const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
    
    const lines = stdout.trim().split('\n');
    let width = 1920;
    let height = 1080;
    let fps = 30;
    let duration = 0;
    
    if (lines.length >= 4) {
      width = parseInt(lines[0]) || 1920;
      height = parseInt(lines[1]) || 1080;
      const fpsParts = lines[2].split('/');
      fps = fpsParts.length === 2 ? parseInt(fpsParts[0]) / parseInt(fpsParts[1]) : parseFloat(lines[2]);
      duration = parseFloat(lines[3]) || 0;
    }

    // Mock motion score and brightness for now
    const motionScore = Math.random() * 0.8 + 0.1;
    const brightness = Math.random() * 0.6 + 0.2;

    res.json({
      width,
      height,
      fps,
      duration,
      motionScore,
      brightness,
      aspectRatio: width / height
    });
    
    // Cleanup
    fs.unlinkSync(videoPath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to analyze video' });
  }
});

// 3. Audio Analysis & WhisperX (Mocked for local engine MVP to avoid huge python installs)
app.post('/api/mv/analyze-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    const rawLyrics = req.body.rawLyrics || '';
    
    // In a real local engine, this would call WhisperX python script.
    // Here we generate simulated word-level timings based on the rawLyrics provided.
    const words = rawLyrics.split(/\s+/).filter(Boolean);
    const wordTimings = words.map((word, i) => ({
      word,
      start: 2 + i * 0.4,
      end: 2 + i * 0.4 + 0.3
    }));

    res.json({
      bpm: 120,
      key: 'C Major',
      language: 'English',
      sections: [
        { title: 'Intro', startTime: 0, endTime: 10 },
        { title: 'Verse 1', startTime: 10, endTime: 30 },
        { title: 'Chorus', startTime: 30, endTime: 50 },
        { title: 'Outro', startTime: 50, endTime: 60 }
      ],
      wordTimings
    });
    
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to analyze audio' });
  }
});

// 4. Auto Edit Planner
app.post('/api/mv/auto-edit', (req, res) => {
  const { videoAssets, songAnalysis, style, pacing, beatSync } = req.body;
  if (!videoAssets || videoAssets.length === 0) return res.status(400).json({ error: 'No assets' });
  
  const timelineClips = [];
  let currentTime = 0;
  const songDuration = songAnalysis?.sections?.[songAnalysis.sections.length - 1]?.endTime || 60;
  
  // Deterministic edit generation based on pacing
  let baseClipDuration = pacing === 'Fast' ? 1.5 : pacing === 'Slow' ? 4 : 2.5;

  let clipIdCounter = 0;
  let prevAssetIdx = -1;

  while (currentTime < songDuration) {
    // Select asset ensuring we don't repeat the same one immediately
    let assetIdx = Math.floor(Math.random() * videoAssets.length);
    if (videoAssets.length > 1 && assetIdx === prevAssetIdx) {
      assetIdx = (assetIdx + 1) % videoAssets.length;
    }
    prevAssetIdx = assetIdx;
    
    const asset = videoAssets[assetIdx];
    
    let duration = baseClipDuration + (Math.random() * 1.0 - 0.5);
    
    // If beatSync is Strong, snap duration to nearest 0.5s
    if (beatSync === 'Strong') {
      duration = Math.round(duration * 2) / 2;
    }
    
    // Don't exceed asset duration
    duration = Math.min(duration, asset.duration || 5);
    
    // Don't exceed song duration
    if (currentTime + duration > songDuration) {
      duration = songDuration - currentTime;
    }

    // Trim random start point
    const maxTrimStart = Math.max(0, (asset.duration || 5) - duration);
    const trimStart = Math.random() * maxTrimStart;

    timelineClips.push({
      id: `clip-${clipIdCounter++}`,
      videoId: asset.id,
      startTime: currentTime,
      endTime: currentTime + duration,
      trimStart: trimStart,
      trimEnd: trimStart + duration
    });

    currentTime += duration;
  }

  res.json({ timelineClips });
});

// 5. Real Local Export using FFmpeg
app.post('/api/mv/export', async (req, res) => {
  try {
    const { project, timelineClips, videoAssets, outputPath: customOutputPath } = req.body;
    
    const exportDir = path.resolve('./exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const exportId = `local-export-${Date.now()}`;
    const finalMp4Path = customOutputPath 
      ? path.resolve(customOutputPath)
      : path.join(exportDir, `${exportId}.mp4`);

    const width = project?.width || 1920;
    const height = project?.height || 1080;
    const fps = project?.fps || 30;

    // Helper to resolve URL or relative staged path to a local file
    const resolveLocalPath = async (urlStr) => {
      if (!urlStr) return null;
      if (urlStr.startsWith('/staged/')) {
        const localPath = path.resolve('./public' + urlStr);
        if (fs.existsSync(localPath)) return localPath;
      }
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const tmpPath = path.join(exportDir, `tmp-${Date.now()}-${Math.random().toString(36).slice(2,6)}.bin`);
        const fetchRes = await fetch(urlStr);
        if (fetchRes.ok) {
          const buf = Buffer.from(await fetchRes.arrayBuffer());
          fs.writeFileSync(tmpPath, buf);
          return tmpPath;
        }
      }
      if (fs.existsSync(urlStr)) return urlStr;
      return null;
    };

    // Resolve audio track
    const rawAudioUrl = project?.audio?.url || req.body.audioUrl;
    let localAudioPath = await resolveLocalPath(rawAudioUrl);

    // If no audio track provided, create a 5-second silent audio track
    if (!localAudioPath) {
      localAudioPath = path.join(exportDir, `silent-${exportId}.mp3`);
      await execAsync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 -q:a 9 -acodec libmp3lame "${localAudioPath}"`);
    }

    const clips = project?.videoClips || timelineClips || [];

    if (clips.length > 0) {
      // Process multiple video / image clips
      const resolvedClips = [];
      for (const clip of clips) {
        const clipAsset = videoAssets?.find(a => a.id === clip.assetId);
        const clipUrl = clip.url || clipAsset?.url;
        const clipPath = await resolveLocalPath(clipUrl);
        if (clipPath) {
          resolvedClips.push({
            ...clip,
            localPath: clipPath
          });
        }
      }

      if (resolvedClips.length > 0) {
        // Build FFmpeg complex filter
        let filterGraph = '';
        let inputCmds = '';

        resolvedClips.forEach((c, idx) => {
          inputCmds += `-i "${c.localPath}" `;
          const tStart = c.trimStart || 0;
          const tEnd = c.trimEnd || (c.endTime - c.startTime) || 5;
          filterGraph += `[${idx}:v]trim=start=${tStart}:end=${tEnd},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}[v${idx}]; `;
        });

        const concatInputs = resolvedClips.map((_, idx) => `[v${idx}]`).join('');
        filterGraph += `${concatInputs}concat=n=${resolvedClips.length}:v=1:a=0[vout]`;

        const ffmpegCmd = `ffmpeg -y ${inputCmds} -i "${localAudioPath}" -filter_complex "${filterGraph}" -map "[vout]" -map ${resolvedClips.length}:a -c:v libx264 -preset fast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        
        await execAsync(ffmpegCmd);
      } else {
        // Fallback: render background color video + audio
        const ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=0x111111:s=${width}x${height}:r=${fps} -i "${localAudioPath}" -c:v libx264 -preset fast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        await execAsync(ffmpegCmd);
      }
    } else {
      // Single background / artwork image or color fallback
      const albumArtUrl = project?.audio?.albumArt || project?.background?.value;
      const albumArtPath = await resolveLocalPath(albumArtUrl);

      if (albumArtPath && fs.existsSync(albumArtPath) && albumArtPath.match(/\.(png|jpg|jpeg|webp)$/i)) {
        const ffmpegCmd = `ffmpeg -y -loop 1 -i "${albumArtPath}" -i "${localAudioPath}" -filter_complex "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}" -c:v libx264 -preset fast -tune stillimage -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        await execAsync(ffmpegCmd);
      } else {
        const ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=0x111111:s=${width}x${height}:r=${fps} -i "${localAudioPath}" -c:v libx264 -preset fast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4Path}"`;
        await execAsync(ffmpegCmd);
      }
    }

    if (!fs.existsSync(finalMp4Path)) {
      throw new Error('FFmpeg completed but output MP4 file was not generated');
    }

    const stats = fs.statSync(finalMp4Path);
    if (stats.size === 0) {
      throw new Error('Generated MP4 file is empty (0 bytes)');
    }

    return res.json({ 
      status: 'success', 
      message: 'Local FFmpeg export completed successfully', 
      path: finalMp4Path,
      fileSize: stats.size,
      outputUrl: `/exports/${path.basename(finalMp4Path)}`
    });
  } catch (error) {
    console.error('Local Engine Export Error:', error);
    return res.status(500).json({ error: error.message || 'Local FFmpeg export failed' });
  }
});

// 6. Local Engine Automated Render Test
app.get('/api/mv/render-test', async (req, res) => {
  try {
    const exportDir = path.resolve('./exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const testPath = path.join(exportDir, `local-test-${Date.now()}.mp4`);
    const cmd = `ffmpeg -y -f lavfi -i color=c=0x00e676:s=640x360:r=30 -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac "${testPath}"`;
    await execAsync(cmd);

    if (fs.existsSync(testPath) && fs.statSync(testPath).size > 0) {
      return res.json({
        success: true,
        message: `Local FFmpeg render test passed. File size: ${fs.statSync(testPath).size} bytes.`,
        path: testPath
      });
    }
    return res.status(500).json({ success: false, error: 'Render test output file empty or missing' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Local Joelizer MV Engine running on http://localhost:${PORT}`);
});
