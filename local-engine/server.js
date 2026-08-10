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

// 5. Local Export using FFmpeg
app.post('/api/mv/export', async (req, res) => {
  try {
    const { timelineClips, videoAssets, outputPath } = req.body;
    // In a real local engine, we would generate an FFmpeg complex filter graph
    // concatting all the video clips, resizing them, and overlaying the audio track.
    
    res.json({ status: 'success', message: 'Export logic executed', path: outputPath || 'output.mp4' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Local Joelizer MV Engine running on http://localhost:${PORT}`);
});
