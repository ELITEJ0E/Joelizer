/**
 * WebAudio and Canvas Waveform Analyzer for Joelizer Studio
 */

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  beats: number[]; // timestamp array in seconds
}

// Generate waveform peaks array and detect beats from audio File/Blob
export async function analyzeAudioBuffer(file: File | Blob, numPeaks = 800): Promise<WaveformData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const rawData = audioBuffer.getChannelData(0); // Left channel
    const totalSamples = rawData.length;
    const blockSize = Math.floor(totalSamples / numPeaks);
    
    const peaks: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j] || 0);
        if (val > max) max = val;
      }
      peaks.push(max);
    }

    // Detect Beat Timestamps (peaks exceeding threshold)
    const beats: number[] = [];
    const beatThreshold = 0.65;
    const minBeatDistanceSamples = Math.floor(sampleRate * 0.35); // Max ~170 BPM
    let lastBeatSample = -minBeatDistanceSamples;

    for (let i = 0; i < totalSamples; i += 512) {
      if (Math.abs(rawData[i]) > beatThreshold && (i - lastBeatSample) > minBeatDistanceSamples) {
        beats.push(i / sampleRate);
        lastBeatSample = i;
      }
    }

    return { peaks, duration, sampleRate, beats };
  } finally {
    audioCtx.close();
  }
}

// Estimate BPM from beat array
export function calculateBpmFromBeats(beats: number[], duration: number): number {
  if (beats.length < 4) return 120;
  
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const diff = beats[i] - beats[i - 1];
    if (diff >= 0.3 && diff <= 1.2) { // 50 BPM to 200 BPM range
      intervals.push(diff);
    }
  }

  if (intervals.length === 0) return 120;

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const rawBpm = Math.round(60 / avgInterval);

  return Math.min(Math.max(rawBpm, 60), 180);
}

// Draw Waveform onto HTML Canvas with Zoom, Progress, Beat markers, and Lyric timestamp markers
export function drawStudioWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveformData: WaveformData | null,
  currentTime: number,
  zoom: number,
  scrollOffset: number,
  lyricTimes: number[],
  activeColor = '#00e676'
) {
  ctx.clearRect(0, 0, width, height);

  // Dark background grid
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, width, height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSpacing = 50;
  for (let x = 0; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  if (!waveformData || waveformData.peaks.length === 0) {
    // Render placeholder subtle pulsing waveform line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }

  const duration = waveformData.duration || 1;
  const visibleDuration = duration / zoom;
  const startSec = scrollOffset;
  const endSec = startSec + visibleDuration;

  // Center vertical axis
  const centerY = height / 2;
  const maxAmp = (height / 2) * 0.85;

  const numPeaks = waveformData.peaks.length;
  const secPerPeak = duration / numPeaks;

  const startPeakIdx = Math.floor((startSec / duration) * numPeaks);
  const endPeakIdx = Math.min(numPeaks, Math.ceil((endSec / duration) * numPeaks));

  const peakWidth = width / (endPeakIdx - startPeakIdx || 1);

  // 1. Draw Waveform Bars
  for (let i = startPeakIdx; i < endPeakIdx; i++) {
    const peakTime = i * secPerPeak;
    const peakVal = waveformData.peaks[i] || 0;
    const barHeight = Math.max(3, peakVal * maxAmp);

    const x = ((peakTime - startSec) / visibleDuration) * width;
    const isPast = peakTime <= currentTime;

    ctx.fillStyle = isPast ? activeColor : 'rgba(255, 255, 255, 0.25)';

    // Mirror top & bottom
    ctx.fillRect(x, centerY - barHeight, Math.max(1.5, peakWidth - 1), barHeight * 2);
  }

  // 2. Draw Beat Markers (subtle yellow dots/lines)
  if (waveformData.beats && waveformData.beats.length > 0) {
    ctx.fillStyle = '#ffb74d';
    waveformData.beats.forEach(bTime => {
      if (bTime >= startSec && bTime <= endSec) {
        const bx = ((bTime - startSec) / visibleDuration) * width;
        ctx.fillRect(bx - 0.5, height - 12, 1.5, 8);
      }
    });
  }

  // 3. Draw Lyric Timestamps (Neon Pins & Lines)
  lyricTimes.forEach(lTime => {
    if (lTime >= startSec && lTime <= endSec) {
      const lx = ((lTime - startSec) / visibleDuration) * width;

      // Vertical line
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pin head
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(lx, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 4. Draw Current Playhead Line
  if (currentTime >= startSec && currentTime <= endSec) {
    const px = ((currentTime - startSec) / visibleDuration) * width;

    // Glowing Playhead
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset shadow

    // Playhead handle
    ctx.fillStyle = activeColor;
    ctx.beginPath();
    ctx.moveTo(px - 6, 0);
    ctx.lineTo(px + 6, 0);
    ctx.lineTo(px, 10);
    ctx.closePath();
    ctx.fill();
  }
}
