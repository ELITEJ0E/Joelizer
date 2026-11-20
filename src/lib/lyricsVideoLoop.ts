/** Repeat a background with an overlap at the join, not a hard reset.
 * The first pass starts at frame zero. Later passes skip the already-blended
 * opening, so the ending and beginning remain continuous after every loop.
 */
export function lyricsVideoLoopFrame(time: number, duration: number, fadeSeconds = 0.65) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { primaryTime: Math.max(0, time), incomingTime: null as number | null, mix: 0, cycle: 0 };
  }
  const fade = Math.min(fadeSeconds, duration / 3);
  if (fade <= 0.001) {
    return { primaryTime: ((time % duration) + duration) % duration, incomingTime: null as number | null, mix: 0, cycle: Math.floor(time / duration) };
  }
  const t = Math.max(0, time);
  const period = duration - fade;
  const firstPass = t < duration;
  const cycle = firstPass ? 0 : 1 + Math.floor((t - duration) / period);
  const primaryTime = firstPass ? t : fade + ((t - duration) % period);
  const mix = Math.max(0, Math.min(1, (primaryTime - period) / fade));
  return {
    primaryTime: Math.min(duration - 0.001, primaryTime),
    incomingTime: mix > 0 ? primaryTime - period : null,
    // Smoothstep softens the midpoint without black frames or a hard cut.
    mix: mix * mix * (3 - 2 * mix),
    cycle
  };
}
