import type { ElementPos } from './lyricsLayout';
import type { VisualizerSettings } from '../store/useStore';
import { renderVisualizer } from './renderers';

/**
 * Amplify the *actual* frame's decoded soundtrack, rather than generating a
 * clock-based animation. Quiet FFT bins were previously mapped to tiny dots
 * in exported portrait videos despite a clearly audible soundtrack.
 */
export function prepareBeatReactiveSpectrum(
  frequencyData: Uint8Array,
  timeData: Uint8Array,
  adaptiveLevel = true
): Uint8Array {
  if (!frequencyData.length) return frequencyData;
  if (!adaptiveLevel) return frequencyData;

  let sumSquares = 0;
  for (let i = 0; i < timeData.length; i++) {
    const sample = (timeData[i] - 128) / 128;
    sumSquares += sample * sample;
  }
  const rms = timeData.length ? Math.sqrt(sumSquares / timeData.length) : 0;

  // Estimate the CURRENT spectral level instead of blindly amplifying the
  // already-mastered FFT. This avoids 255-valued bins forming a fixed sunburst.
  // Sample at most 128 bins so 4K export remains inexpensive.
  const sampleStep = Math.max(1, Math.floor(frequencyData.length / 128));
  const levels: number[] = [];
  for (let i = 1; i < frequencyData.length; i += sampleStep) {
    levels.push(frequencyData[i] / 255);
  }
  levels.sort((a, b) => a - b);
  const percentile = (q: number) => levels[Math.floor((levels.length - 1) * q)] || 0;
  const floor = Math.min(0.20, percentile(0.2) * 0.55);
  const upper = Math.max(0.18, percentile(0.85) - floor);
  // The waveform adjusts overall punch, but its volume NEVER linearly drives
  // all spikes to maximum. Actual band differences remain visible.
  const presence = rms < 0.003 ? 0 : Math.max(0.35, Math.min(1, Math.sqrt(rms / 0.22)));
  const result = new Uint8Array(frequencyData.length);

  for (let i = 0; i < frequencyData.length; i++) {
    const raw = frequencyData[i] / 255;
    const relative = Math.max(0, (raw - floor) / upper);
    // Smooth knee preserves contrast above nominal maximum, not hard clipping.
    const compressed = 1 - Math.exp(-relative * 0.9);
    const lowLift = 1 + 0.08 * (1 - i / frequencyData.length);
    result[i] = Math.round(255 * Math.min(0.84, compressed * lowLift) * presence);
  }
  return result;
}

/**
 * Single source of truth for the movable Lyrics Video spectrum layer.
 * Both the editor preview and frame-accurate MP4 export use this renderer.
 */
export function drawPositionedLyricsVisualizer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pos: ElementPos,
  settings: VisualizerSettings,
  frequencyData?: Uint8Array | null,
  timeData?: Uint8Array | null,
  timelineTime = 0
): void {
  if (settings.enabled === false) return;
  const portrait = height > width;
  const scale = Math.max(0.2, settings.scale ?? 1);
  // Size in video-relative units, not fixed screen pixels. The previous
  // 280x52 hard cap made a 1080p/4K exported spectrum almost invisible.
  // Keep the same relative size in editor preview and encoded frames.
  const circular = ['radial', 'particles', 'orb', 'kaleidoscope'].includes(settings.style);
  // Circular effects need a square drawing surface. The old 9.5%-height
  // rectangle caused every ring to appear tiny and squashed in portrait.
  const baseW = (portrait ? width * 0.62 : width * 0.28) * scale;
  const boxW = Math.max(32, Math.round(baseW));
  const boxH = circular ? boxW : Math.max(24, Math.round(height * (portrait ? 0.095 : 0.082) * scale));
  const frequency = frequencyData?.length ? frequencyData : new Uint8Array(1024);
  const waveform = timeData?.length ? timeData : new Uint8Array(1024).fill(128);
  const responsiveFrequency = prepareBeatReactiveSpectrum(frequency, waveform, settings.adaptiveLevel !== false);

  ctx.save();
  ctx.translate(pos.x * width - boxW / 2, pos.y * height - boxH / 2);
  if (settings.style === 'particles' && !responsiveFrequency.some(value => value > 25)) {
    // Particle rendering normally skips every particle below its audio
    // threshold. Draw a clearly visible idle state until analysis is ready.
    const cx = boxW / 2;
    const cy = boxH / 2;
    const radius = Math.max(7, boxH * 0.27);
    const idleColor = settings.color || '#00e676';
    ctx.fillStyle = idleColor;
    ctx.shadowColor = idleColor;
    ctx.shadowBlur = 8;
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, Math.max(1.8, boxH * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    renderVisualizer(ctx, responsiveFrequency, waveform, settings, boxW, boxH, timelineTime);
  }
  ctx.restore();
}
