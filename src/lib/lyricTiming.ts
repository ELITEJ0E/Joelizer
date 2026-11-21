import type { LyricLine } from '../store/useStore';

/** A cleared end holds until the next lyric or soundtrack end. */
export function effectiveLyricEnd<T extends Pick<LyricLine, 'startTime' | 'endTime' | 'endTimeAuto'>>(
  line: T, lines: readonly T[], songDuration?: number
): number {
  if (!line.endTimeAuto) return line.endTime;
  const next = lines.reduce((nearest, other) =>
    other !== line && other.startTime > line.startTime && other.startTime < nearest
      ? other.startTime : nearest, Infinity);
  const fallback = Number.isFinite(songDuration) && (songDuration ?? 0) > line.startTime
    ? songDuration! : line.startTime + 3600;
  return Math.max(line.startTime + 0.01, Number.isFinite(next) ? next : fallback);
}

export function resolvedLyricLines<T extends LyricLine>(lines: readonly T[], songDuration?: number): T[] {
  return lines.map(line => line.endTimeAuto
    ? { ...line, endTime: effectiveLyricEnd(line, lines, songDuration) }
    : line);
}
