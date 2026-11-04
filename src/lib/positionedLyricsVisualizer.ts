import type { ElementPos } from './lyricsLayout';
import type { VisualizerSettings } from '../store/useStore';
import { renderVisualizer } from './renderers';

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
  timeData?: Uint8Array | null
): void {
  if (settings.enabled === false) return;
  const portrait = height > width;
  const scale = Math.max(0.2, settings.scale ?? 1);
  const boxW = Math.round((portrait ? Math.min(width * 0.62, 280) : Math.min(width * 0.28, 300)) * scale);
  const boxH = Math.round(Math.min(height * 0.082, 52) * scale);
  const frequency = frequencyData?.length ? frequencyData : new Uint8Array(1024);
  const waveform = timeData?.length ? timeData : new Uint8Array(1024).fill(128);

  ctx.save();
  ctx.translate(pos.x * width - boxW / 2, pos.y * height - boxH / 2);
  if (settings.style === 'particles' && !frequency.some(value => value > 25)) {
    // Particle rendering normally skips every particle below its audio
    // threshold. Draw a clearly visible idle state until analysis is ready.
    const cx = boxW / 2;
    const cy = boxH / 2;
    const radius = Math.max(7, boxH * 0.27);
    ctx.fillStyle = settings.color || '#00e676';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, Math.max(1.8, boxH * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    renderVisualizer(ctx, frequency, waveform, settings, boxW, boxH);
  }
  ctx.restore();
}
