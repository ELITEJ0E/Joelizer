/**
 * Shared, deterministic overlays for Lyrics Video and MV Studio.
 * Effects are calculated from project time (never wall-clock time), so
 * canvas playback, browser recording and Remotion exports match.
 */
export type OverlayEffectId = 'none' | 'film-grain' | 'vignette' | 'light-leak' | 'scanlines' | 'dream-glow' | 'cinematic';
export interface OverlaySettings {
  effect: OverlayEffectId;
  intensity: number; // 0..1
  startTime: number;
  endTime: number; // 0 means through the end of the project
}
export const DEFAULT_OVERLAY: OverlaySettings = {
  effect: 'none', intensity: 0.45, startTime: 0, endTime: 0
};
export const OVERLAY_PRESETS: { id: OverlayEffectId; label: string; description: string }[] = [
  { id: 'none', label: 'None', description: 'No overlay' },
  { id: 'cinematic', label: 'Cinematic', description: 'Soft vignette + warm light' },
  { id: 'film-grain', label: 'Film Grain', description: 'Organic film texture' },
  { id: 'light-leak', label: 'Light Leak', description: 'Warm animated flare' },
  { id: 'vignette', label: 'Vignette', description: 'Darkened edges' },
  { id: 'scanlines', label: 'Scanlines', description: 'Retro analog texture' },
  { id: 'dream-glow', label: 'Dream Glow', description: 'Soft luminous wash' }
];
export function overlayActive(settings: OverlaySettings | undefined, time: number): boolean {
  return !!settings && settings.effect !== 'none' && settings.intensity > 0 &&
    time >= settings.startTime && (settings.endTime <= 0 || time < settings.endTime);
}
export function clampOverlay(settings: Partial<OverlaySettings>): OverlaySettings {
  return {
    effect: OVERLAY_PRESETS.some(p => p.id === settings.effect) ? settings.effect! : 'none',
    intensity: Math.max(0, Math.min(1, Number(settings.intensity ?? DEFAULT_OVERLAY.intensity) || 0)),
    startTime: Math.max(0, Number(settings.startTime ?? 0) || 0),
    endTime: Math.max(0, Number(settings.endTime ?? 0) || 0)
  };
}
export function getOverlayLayers(settings: OverlaySettings | undefined, time: number) {
  if (!overlayActive(settings, time)) return [] as { background: string; opacity: number; backgroundSize?: string }[];
  const s = clampOverlay(settings!);
  const v = s.intensity;
  const layers: { background: string; opacity: number; backgroundSize?: string }[] = [];
  if (s.effect === 'vignette' || s.effect === 'cinematic') {
    layers.push({ background: 'radial-gradient(ellipse at center, transparent 34%, rgba(0,0,0,0.96) 100%)', opacity: v * 0.8 });
  }
  if (s.effect === 'scanlines') {
    layers.push({ background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.8) 4px)', opacity: v * 0.65 });
  }
  if (s.effect === 'light-leak' || s.effect === 'cinematic' || s.effect === 'dream-glow') {
    const x = 45 + 35 * Math.sin(time * 0.35);
    const y = 20 + 20 * Math.cos(time * 0.21);
    const hue = s.effect === 'dream-glow' ? '148,115,255' : '255,156,82';
    layers.push({ background: `radial-gradient(ellipse at ${x}% ${y}%, rgba(${hue},0.75), transparent 65%)`,
      opacity: v * (s.effect === 'dream-glow' ? 0.35 : 0.53) });
  }
  if (s.effect === 'film-grain' || s.effect === 'cinematic') {
    // A repeatable crosshatch grain, animated through deterministic phase.
    const phase = Math.floor(time * 12) % 4;
    layers.push({ background: `repeating-linear-gradient(${45 + phase * 22}deg, rgba(255,255,255,0.25) 0px, transparent 1px, rgba(0,0,0,0.25) 2px, transparent 4px)`,
      opacity: v * 0.22 });
  }
  return layers;
}
export function drawOverlayEffects(ctx: CanvasRenderingContext2D, width: number, height: number,
  settings: OverlaySettings | undefined, time: number) {
  if (!overlayActive(settings, time)) return;
  const s = clampOverlay(settings!);
  const v = s.intensity;
  ctx.save();
  if (s.effect === 'vignette' || s.effect === 'cinematic') {
    const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18,
      width / 2, height / 2, Math.max(width, height) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.8 * v})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  if (s.effect === 'light-leak' || s.effect === 'cinematic' || s.effect === 'dream-glow') {
    const x = width * (0.45 + 0.35 * Math.sin(time * 0.35));
    const y = height * (0.2 + 0.2 * Math.cos(time * 0.21));
    const radius = Math.max(width, height) * 0.8;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const warm = s.effect !== 'dream-glow';
    g.addColorStop(0, warm ? 'rgba(255,156,82,0.42)' : 'rgba(148,115,255,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = v;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  if (s.effect === 'scanlines') {
    ctx.fillStyle = `rgba(0,0,0,${v * 0.45})`;
    const step = Math.max(4, Math.round(height / 240));
    for (let y = 0; y < height; y += step * 2) ctx.fillRect(0, y, width, step);
  }
  if (s.effect === 'film-grain' || s.effect === 'cinematic') {
    // Sparse deterministic noise points, capped to keep mobile playback fluid.
    const dot = Math.max(2, Math.round(Math.min(width, height) / 280));
    const cols = Math.ceil(width / dot);
    const rows = Math.ceil(height / dot);
    const skip = Math.max(1, Math.ceil((cols * rows) / 1800));
    const frame = Math.floor(time * 12);
    for (let i = 0; i < cols * rows; i += skip) {
      const h = ((i * 1664525 + frame * 1013904223) >>> 0);
      ctx.fillStyle = (h & 1) ? `rgba(255,255,255,${v * 0.12})` : `rgba(0,0,0,${v * 0.12})`;
      ctx.fillRect((i % cols) * dot, Math.floor(i / cols) * dot, dot, dot);
    }
  }
  ctx.restore();
}
