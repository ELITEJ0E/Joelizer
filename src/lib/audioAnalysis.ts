/**
 * WebAudio and Canvas Waveform Analyzer for Joelizer Studio
 */

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  beats: number[]; // timestamp array in seconds
}

/**
 * Generates an organic, responsive fallback waveform when audio cannot be decoded natively
 * (e.g. remote stream CORS, unsupported browser codec, or zero-byte buffer).
 */
export function createFallbackWaveformData(duration = 180, numPeaks = 800): WaveformData {
  const safeDuration = duration > 0 ? duration : 180;
  const peaks: number[] = [];

  // Generate an aesthetically pleasing, dynamic musical waveform envelope
  for (let i = 0; i < numPeaks; i++) {
    const progress = i / numPeaks;
    // Low-frequency musical sections (intro, verse, chorus, bridge, outro)
    const sectionEnv = 0.5 + 0.35 * Math.sin(progress * Math.PI * 3);
    const detailOsc = 0.2 * Math.sin(progress * 42) + 0.15 * Math.cos(progress * 137);
    const pseudoRandom = Math.abs(Math.sin(i * 12.9898 + 78.233)) * 0.25;
    
    // Fade in at start and fade out at end
    const edgeFade = Math.min(1, progress * 15) * Math.min(1, (1 - progress) * 15);
    const peak = Math.max(0.12, Math.min(0.95, (sectionEnv + detailOsc + pseudoRandom) * edgeFade));
    peaks.push(Number(peak.toFixed(3)));
  }

  // Generate synthetic rhythmic beat markers (~120 BPM = 0.5s per beat)
  const beats: number[] = [];
  const beatInterval = 0.5; // 120 BPM
  for (let t = 0.5; t < safeDuration; t += beatInterval) {
    beats.push(Number(t.toFixed(2)));
  }

  return {
    peaks,
    duration: safeDuration,
    sampleRate: 44100,
    beats
  };
}

// Generate waveform peaks array and detect beats from audio File/Blob or audio URL
export async function analyzeAudioBuffer(
  source: File | Blob | string | null | undefined,
  numPeaks = 800,
  durationHint = 180
): Promise<WaveformData> {
  if (!source) {
    return createFallbackWaveformData(durationHint, numPeaks);
  }

  let blob: Blob | null = null;
  let estimatedDuration = durationHint > 0 ? durationHint : 180;

  try {
    if (typeof source === 'string') {
      // Remote or local URL
      const trimmed = source.trim();
      if (!trimmed) {
        return createFallbackWaveformData(estimatedDuration, numPeaks);
      }

      let fetchUrl = trimmed;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        // Use proxy media route to bypass CORS headers
        fetchUrl = `/api/proxy-media?url=${encodeURIComponent(trimmed)}`;
      }

      try {
        const res = await fetch(fetchUrl);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch (fetchErr) {
        console.warn('Waveform audio fetch warning, using fallback envelope:', fetchErr);
        return createFallbackWaveformData(estimatedDuration, numPeaks);
      }
    } else if (source instanceof Blob) {
      blob = source;
    }

    // If no blob or empty 0-byte blob, do not call decodeAudioData (which throws DOMException)
    if (!blob || blob.size < 64) {
      return createFallbackWaveformData(estimatedDuration, numPeaks);
    }

    const arrayBuffer = await blob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 64) {
      return createFallbackWaveformData(estimatedDuration, numPeaks);
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return createFallbackWaveformData(estimatedDuration, numPeaks);
    }

    const audioCtx = new AudioContextClass();

    try {
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.warn('Audio could not be decoded by WebAudio (format or codec issue), applying waveform envelope:', decodeErr);
        return createFallbackWaveformData(estimatedDuration, numPeaks);
      }

      const duration = audioBuffer.duration || estimatedDuration;
      const sampleRate = audioBuffer.sampleRate || 44100;
      const rawData = audioBuffer.getChannelData(0); // Left channel
      const totalSamples = rawData.length;

      if (totalSamples === 0) {
        return createFallbackWaveformData(duration, numPeaks);
      }

      const blockSize = Math.max(1, Math.floor(totalSamples / numPeaks));
      const peaks: number[] = [];
      let maxPeakObserved = 0.001;

      for (let i = 0; i < numPeaks; i++) {
        const start = i * blockSize;
        let max = 0;
        const end = Math.min(start + blockSize, totalSamples);
        for (let j = start; j < end; j++) {
          const val = Math.abs(rawData[j] || 0);
          if (val > max) max = val;
        }
        if (max > maxPeakObserved) maxPeakObserved = max;
        peaks.push(max);
      }

      // Normalize peaks smoothly
      const normalizedPeaks = peaks.map(p => Math.min(1.0, Math.max(0.05, p / maxPeakObserved)));

      // Detect Beat Timestamps (peaks exceeding threshold)
      const beats: number[] = [];
      const beatThreshold = 0.65 * maxPeakObserved;
      const minBeatDistanceSamples = Math.floor(sampleRate * 0.35); // Max ~170 BPM
      let lastBeatSample = -minBeatDistanceSamples;

      for (let i = 0; i < totalSamples; i += 512) {
        if (Math.abs(rawData[i]) > beatThreshold && (i - lastBeatSample) > minBeatDistanceSamples) {
          beats.push(Number((i / sampleRate).toFixed(2)));
          lastBeatSample = i;
        }
      }

      return {
        peaks: normalizedPeaks,
        duration,
        sampleRate,
        beats: beats.length > 0 ? beats : createFallbackWaveformData(duration, numPeaks).beats
      };
    } finally {
      audioCtx.close().catch(() => {});
    }
  } catch (err) {
    console.warn('Waveform analysis completed with fallback profile:', err);
    return createFallbackWaveformData(estimatedDuration, numPeaks);
  }
}

// Estimate BPM from beat array
export function calculateBpmFromBeats(beats: number[], duration: number): number {
  if (!beats || beats.length < 4) return 120;
  
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
  lines: { id: string; startTime: number; endTime?: number; text: string }[],
  activeColor = '#00e676',
  selectedLineId?: string | null,
  hoveredLineId?: string | null
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

  if (!waveformData || !waveformData.peaks || waveformData.peaks.length === 0) {
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
  const maxAmp = (height / 2) * 0.82;

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

    ctx.fillStyle = isPast ? activeColor : 'rgba(255, 255, 255, 0.22)';

    // Mirror top & bottom
    ctx.fillRect(x, centerY - barHeight, Math.max(1.5, peakWidth - 1), barHeight * 2);
  }

  // 2. Draw Beat Markers (subtle yellow dots/lines at bottom)
  if (waveformData.beats && waveformData.beats.length > 0) {
    ctx.fillStyle = '#ffb74d';
    waveformData.beats.forEach(bTime => {
      if (bTime >= startSec && bTime <= endSec) {
        const bx = ((bTime - startSec) / visibleDuration) * width;
        ctx.fillRect(bx - 0.5, height - 12, 1.5, 8);
      }
    });
  }

  // 3. Draw Lyric Timestamps (Interactive Pins & Badges)
  lines.forEach((line, idx) => {
    const lTime = line.startTime;
    if (lTime >= startSec && lTime <= endSec) {
      const lx = ((lTime - startSec) / visibleDuration) * width;
      const isSelected = selectedLineId === line.id;
      const isHovered = hoveredLineId === line.id;

      const pinColor = isSelected ? '#ffffff' : (isHovered ? '#69f0ae' : activeColor);

      // Vertical dashed line
      ctx.strokeStyle = pinColor;
      ctx.lineWidth = isSelected || isHovered ? 2 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top Pin Badge with Line Number
      const badgeText = `#${idx + 1}`;
      ctx.font = 'bold 9px monospace';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 10;
      const badgeH = 16;
      const badgeX = Math.min(Math.max(0, lx - badgeW / 2), width - badgeW);
      const badgeY = 4;

      ctx.fillStyle = isSelected ? '#ffffff' : '#09090d';
      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#000000' : pinColor;
      ctx.fillText(badgeText, badgeX + 5, badgeY + 11);
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
    ctx.lineTo(px, 12);
    ctx.closePath();
    ctx.fill();
  }
}
