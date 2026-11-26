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

/** One timing source for preview, canonical export and Remotion. Preserve
 * explicit timestamps; match the existing live word-length fallback. */
export function resolveTimedLyricWords(line: {
  text: string; startTime: number; endTime: number;
  words?: readonly { word: string; start?: number; end?: number; startTime?: number; endTime?: number }[];
}): { word: string; startTime: number; endTime: number }[] {
  const duration = Math.max(0.4, line.endTime - line.startTime);
  const words = line.words;
  if (words?.length) return words.map((word, i) => {
    const startTime = word.startTime ?? word.start ?? line.startTime + i * duration / words.length;
    return { word: word.word || '', startTime, endTime: word.endTime ?? word.end ?? startTime + duration / words.length };
  });
  const tokens = line.text.trim().split(/\s+/).filter(Boolean);
  const total = tokens.reduce((n, token) => n + Math.max(1, token.length), 0);
  let start = line.startTime;
  return tokens.map(word => {
    const startTime = start;
    start += duration * Math.max(1, word.length) / Math.max(1, total);
    return { word, startTime, endTime: start };
  });
}
