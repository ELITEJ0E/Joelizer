/** Timestamp-driven motion shared by Canvas and Remotion. */
export const KINETIC_MOTION_STYLES = [
  { id: 'pop', label: 'Classic Word Pop' },
  { id: 'dynamic', label: 'Dynamic Typography' },
  { id: 'flow', label: 'Word Flow' },
  { id: 'focus', label: 'Single Word Focus' },
  { id: 'cinematic', label: 'Cinematic Reveal' },
] as const;
export type KineticMotionStyle = typeof KINETIC_MOTION_STYLES[number]['id'];
export function normalizeKineticMotion(value?: unknown): KineticMotionStyle {
  return KINETIC_MOTION_STYLES.find(s => s.id === value)?.id ?? 'pop';
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export function kineticMotionIntensity(value = 1): number {
  return Number.isFinite(value) ? Math.min(2, Math.max(0.3, value)) : 1;
}
export function getKineticWordMotion(input: {
  style?: KineticMotionStyle; word: string; wordIndex: number;
  wordElapsed: number; lineElapsed: number; fontSize: number;
  intensity?: number; maxScale?: number;
}) {
  const style = normalizeKineticMotion(input.style);
  const i = kineticMotionIntensity(input.intensity);
  const t = input.wordElapsed, f = input.fontSize;
  const p = 1 - clamp01(t / 0.22);
  const linePop = 1 - clamp01(input.lineElapsed / 0.25);
  const opacity = t < 0 ? 0 : clamp01(t / Math.max(0.04, 0.09 / i));
  if (style === 'pop') return { opacity, scale: 1 + i * 0.22 * linePop ** 2 + 0.14 * i * p ** 2,
    x: 0, y: -f * 0.12 * i * p, emphasis: false };
  const direction = input.wordIndex % 2 === 0 ? -1 : 1;
  const ease = (1 - clamp01(t / 0.30)) ** 2;
  const cap = (scale: number) => Math.min(input.maxScale ?? Infinity, scale);
  if (style === 'dynamic') {
    const emphasis = Array.from(input.word.replace(/[^\p{L}\p{N}]/gu, '')).length >= 5;
    return { opacity, scale: cap(emphasis ? 1 + 0.06 * i * p : 0.75 + 0.06 * i * p),
      x: 0, y: direction * f * 0.09 * ease * i, emphasis };
  }
  if (style === 'flow') return { opacity, scale: cap(0.92 + 0.08 * (1 - ease)),
    x: direction * f * 0.30 * ease * i, y: f * 0.30 * ease * i, emphasis: false };
  if (style === 'focus') return { opacity: t < 0 ? 0 : clamp01(t / 0.04),
    scale: cap(1.35 + 0.14 * i * p), x: 0, y: 0, emphasis: false };
  return { opacity: t < 0 ? 0 : clamp01(t / Math.max(0.08, 0.22 / i)),
    scale: cap(0.97 + 0.03 * (1 - ease)), x: 0, y: f * 0.20 * ease * i, emphasis: false };
}
/** Latest active word wins on overlaps; gaps and future words stay hidden. */
export function selectKineticFocusWord<T extends {startTime: number; endTime: number}>(words: readonly T[], time: number): T[] {
  let active: T | undefined;
  for (const word of words) {
    if (word.startTime <= time && time < word.endTime && (!active || word.startTime >= active.startTime)) active = word;
  }
  return active ? [active] : [];
}
