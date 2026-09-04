/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Continuous Liquid Karaoke Sweep Engine
 * 
 * Provides continuous mathematical highlight interpolation across lyric lines.
 * Eliminates discrete word-by-word snapping and jumping by calculating a single
 * smooth horizontal sweep coordinate (highlightX) and normalized progress (0 -> 1)
 * based on cumulative measured typography widths, character lengths, and continuous audio time.
 */

export interface TimedWordMetric {
  word: string;
  width: number;
  startTime: number;
  endTime: number;
}

export interface LineSweepSegment {
  type: 'word' | 'space';
  text: string;
  xStart: number;
  xEnd: number;
  width: number;
  tStart: number;
  tEnd: number;
}

export interface LineSweepResult {
  totalWidth: number;
  highlightX: number;        // Pixel offset from subline start (0 to totalWidth)
  highlightProgress: number; // Normalized continuous progress (0 to 1)
  segments: LineSweepSegment[];
}

/**
 * Computes a completely smooth, continuous highlight position across a line of words.
 * Handles inter-word spaces, monotonic boundary smoothing, and variable word widths.
 */
export function computeContinuousLineSweep(
  rawWords: TimedWordMetric[],
  spaceWidth: number,
  currentTime: number
): LineSweepResult {
  if (!rawWords || rawWords.length === 0) {
    return {
      totalWidth: 0,
      highlightX: 0,
      highlightProgress: 0,
      segments: []
    };
  }

  // 1. Sanitize and normalize word timings to ensure strictly increasing, monotonic flow
  const words: TimedWordMetric[] = rawWords.map((w) => ({
    word: w.word,
    width: Math.max(0, w.width),
    startTime: w.startTime,
    endTime: Math.max(w.startTime + 0.05, w.endTime)
  }));

  // Resolve overlaps between consecutive words
  for (let i = 0; i < words.length - 1; i++) {
    const cur = words[i];
    const next = words[i + 1];
    if (cur.endTime > next.startTime) {
      const mid = (cur.endTime + next.startTime) / 2;
      cur.endTime = mid;
      next.startTime = mid;
      if (next.endTime < next.startTime + 0.05) {
        next.endTime = next.startTime + 0.05;
      }
    }
  }

  // 2. Construct contiguous geometric and timing segments (Words and Whitespaces)
  const segments: LineSweepSegment[] = [];
  let currentX = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wordDuration = Math.max(0.05, w.endTime - w.startTime);

    // If there is a preceding word, insert the whitespace segment between words
    if (i > 0) {
      const prevWord = words[i - 1];
      const timeGap = w.startTime - prevWord.endTime;
      
      let spaceTStart: number;
      let spaceTEnd: number;

      if (timeGap <= 0.35) {
        // Continuous vocal flow: sweep through the whitespace directly into the next word
        spaceTStart = prevWord.endTime;
        spaceTEnd = w.startTime;
      } else {
        // Longer pause between phrases: bridge space in 0.15s, then pause until next vocal
        spaceTStart = prevWord.endTime;
        spaceTEnd = prevWord.endTime + 0.15;
      }

      const spaceStartX = currentX;
      const spaceEndX = currentX + spaceWidth;
      currentX = spaceEndX;

      segments.push({
        type: 'space',
        text: ' ',
        xStart: spaceStartX,
        xEnd: spaceEndX,
        width: spaceWidth,
        tStart: spaceTStart,
        tEnd: Math.max(spaceTStart + 0.01, spaceTEnd)
      });
    }

    const wordStartX = currentX;
    const wordEndX = currentX + w.width;
    currentX = wordEndX;

    segments.push({
      type: 'word',
      text: w.word,
      xStart: wordStartX,
      xEnd: wordEndX,
      width: w.width,
      tStart: w.startTime,
      tEnd: Math.max(w.startTime + 0.02, w.endTime)
    });
  }

  const totalWidth = currentX;
  if (totalWidth <= 0 || segments.length === 0) {
    return {
      totalWidth: 0,
      highlightX: 0,
      highlightProgress: 0,
      segments
    };
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  // 3. Continuous Highlight X Coordinate Calculation (Liquid Linear Motion)
  let highlightX = 0;

  if (currentTime <= firstSegment.tStart) {
    highlightX = 0;
  } else if (currentTime >= lastSegment.tEnd) {
    highlightX = totalWidth;
  } else {
    // Find active segment or inter-segment gap
    let found = false;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (currentTime >= seg.tStart && currentTime <= seg.tEnd) {
        const segDuration = Math.max(0.001, seg.tEnd - seg.tStart);
        const rawProgress = Math.max(0, Math.min(1, (currentTime - seg.tStart) / segDuration));
        
        // Linear continuous flow: avoids per-word start-stop stutter
        highlightX = seg.xStart + (seg.xEnd - seg.xStart) * rawProgress;
        found = true;
        break;
      } else if (i < segments.length - 1) {
        const nextSeg = segments[i + 1];
        // Time is in the pause after a space was traversed but before next vocal starts
        if (currentTime > seg.tEnd && currentTime < nextSeg.tStart) {
          highlightX = seg.xEnd; // Hold position cleanly at start of next word
          found = true;
          break;
        }
      }
    }

    if (!found) {
      if (currentTime < firstSegment.tStart) {
        highlightX = 0;
      } else {
        highlightX = totalWidth;
      }
    }
  }

  highlightX = Math.max(0, Math.min(totalWidth, highlightX));
  const highlightProgress = totalWidth > 0 ? highlightX / totalWidth : 0;

  return {
    totalWidth,
    highlightX,
    highlightProgress,
    segments
  };
}

/**
 * Fallback generator for generating TimedWordMetrics when only whole-line text is available.
 * Distributes time evenly based on character counts so continuous sweep works flawlessly.
 */
export function generateFallbackWordMetrics(
  text: string,
  lineStartTime: number,
  lineEndTime: number,
  measureWordWidth: (word: string) => number
): TimedWordMetric[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lineDuration = Math.max(0.4, lineEndTime - lineStartTime);
  const totalChars = words.reduce((acc, w) => acc + Math.max(1, w.length), 0);

  let currentStart = lineStartTime;
  return words.map((word) => {
    const fraction = Math.max(1, word.length) / Math.max(1, totalChars);
    const duration = lineDuration * fraction;
    const s = currentStart;
    const e = s + duration;
    currentStart = e;

    return {
      word,
      width: measureWordWidth(word),
      startTime: s,
      endTime: e
    };
  });
}
