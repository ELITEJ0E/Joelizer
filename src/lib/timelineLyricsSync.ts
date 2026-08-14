import { useStore, LyricLine } from '../store/useStore';
import { useMVStore, TimelineText } from '../store/useMVStore';
import { globalHistory } from './globalHistory';

/**
 * Generate default word intervals if a lyric line doesn't have word timings yet
 */
export function ensureLineWords(line: LyricLine | TimelineText): { word: string; start: number; end: number }[] {
  if (line.words && line.words.length > 0) {
    return line.words.map((w: any) => ({
      word: w.word,
      start: Number((w.start ?? w.startTime ?? line.startTime).toFixed(2)),
      end: Number((w.end ?? w.endTime ?? line.endTime).toFixed(2)),
    }));
  }

  const rawWords = (line.text || '').trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const dur = Math.max(0.2, line.endTime - line.startTime);
  const wordDur = dur / rawWords.length;

  return rawWords.map((word, i) => ({
    word,
    start: Number((line.startTime + i * wordDur).toFixed(2)),
    end: Number((line.startTime + (i + 1) * wordDur).toFixed(2)),
  }));
}

/**
 * Sync lines between useStore and useMVStore
 */
export function syncAllLyrics(lines: LyricLine[]): void {
  const syncedWordTimings: TimelineText[] = lines.map((l) => ({
    id: l.id,
    text: l.text,
    startTime: l.startTime,
    endTime: l.endTime,
    words: ensureLineWords(l),
    isEstimated: false,
  }));

  useStore.getState().updateLyricsSettings({ lines });
  useMVStore.getState().setWordTimings(syncedWordTimings);
}

/**
 * Update timing for a lyric line and proportionally adjust its word timestamps
 */
export function updateLyricLineTiming(
  lineId: string,
  newStart: number,
  newEnd: number,
  recordToHistory = true
): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const currentLine = mainLines.find((l) => l.id === lineId);
  if (!currentLine) return;

  const oldStart = currentLine.startTime;
  const oldDur = Math.max(0.1, currentLine.endTime - oldStart);
  const newDur = Math.max(0.2, newEnd - newStart);

  const updatedLines: LyricLine[] = mainLines.map((l) => {
    if (l.id !== lineId) return l;

    const words = ensureLineWords(l).map((w) => {
      // Proportionally remap word time into new line bounds
      const ratioStart = Math.max(0, Math.min(1, (w.start - oldStart) / oldDur));
      const ratioEnd = Math.max(0, Math.min(1, (w.end - oldStart) / oldDur));

      return {
        word: w.word,
        start: Number((newStart + ratioStart * newDur).toFixed(2)),
        end: Number((newStart + ratioEnd * newDur).toFixed(2)),
        startTime: Number((newStart + ratioStart * newDur).toFixed(2)),
        endTime: Number((newStart + ratioEnd * newDur).toFixed(2)),
      };
    });

    return {
      ...l,
      startTime: Number(newStart.toFixed(2)),
      endTime: Number(newEnd.toFixed(2)),
      words,
    };
  });

  syncAllLyrics(updatedLines);

  if (recordToHistory) {
    globalHistory.recordSnapshot('Move/Trim Lyric Line');
  }
}

/**
 * Split a lyric line at a specific timestamp
 */
export function splitLyricLine(lineId: string, splitTime: number): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const lineIndex = mainLines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) return;

  const targetLine = mainLines[lineIndex];
  if (splitTime <= targetLine.startTime + 0.2 || splitTime >= targetLine.endTime - 0.2) return;

  const words = ensureLineWords(targetLine);
  let words1: typeof words = [];
  let words2: typeof words = [];

  if (words.length > 1) {
    // Partition words based on splitTime
    const midIdx = words.findIndex((w) => w.end > splitTime);
    const cutIdx = midIdx === -1 ? Math.floor(words.length / 2) : Math.max(1, midIdx);
    words1 = words.slice(0, cutIdx).map((w) => ({ ...w, end: Math.min(w.end, splitTime) }));
    words2 = words.slice(cutIdx).map((w) => ({ ...w, start: Math.max(w.start, splitTime) }));
  } else {
    // Single word split in text
    const textWords = targetLine.text.split(' ');
    const midTextIdx = Math.max(1, Math.floor(textWords.length / 2));
    const t1 = textWords.slice(0, midTextIdx).join(' ');
    const t2 = textWords.slice(midTextIdx).join(' ');

    words1 = [{ word: t1 || '...', start: targetLine.startTime, end: splitTime }];
    words2 = [{ word: t2 || '...', start: splitTime, end: targetLine.endTime }];
  }

  const line1: LyricLine = {
    ...targetLine,
    endTime: splitTime,
    text: words1.map((w) => w.word).join(' '),
    words: words1,
  };

  const line2: LyricLine = {
    id: `lyr-split-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    startTime: splitTime,
    endTime: targetLine.endTime,
    text: words2.map((w) => w.word).join(' '),
    words: words2,
  };

  const newLines = [...mainLines];
  newLines.splice(lineIndex, 1, line1, line2);

  syncAllLyrics(newLines);
  globalHistory.recordSnapshot('Split Lyric Line');
}

/**
 * Merge a lyric line with its adjacent next line
 */
export function mergeLyricWithNext(lineId: string): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const lineIndex = mainLines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1 || lineIndex >= mainLines.length - 1) return;

  const line1 = mainLines[lineIndex];
  const line2 = mainLines[lineIndex + 1];

  const words1 = ensureLineWords(line1);
  const words2 = ensureLineWords(line2);

  const mergedLine: LyricLine = {
    ...line1,
    endTime: Math.max(line1.endTime, line2.endTime),
    text: `${line1.text.trim()} ${line2.text.trim()}`,
    words: [...words1, ...words2],
  };

  const newLines = [...mainLines];
  newLines.splice(lineIndex, 2, mergedLine);

  syncAllLyrics(newLines);
  globalHistory.recordSnapshot('Merge Lyric Lines');
}

/**
 * Duplicate a lyric line
 */
export function duplicateLyricLine(lineId: string): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const lineIndex = mainLines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) return;

  const targetLine = mainLines[lineIndex];
  const dur = Math.max(0.5, targetLine.endTime - targetLine.startTime);
  const newStart = targetLine.endTime + 0.1;
  const newEnd = newStart + dur;

  const words = ensureLineWords(targetLine).map((w) => ({
    word: w.word,
    start: Number((w.start + (newStart - targetLine.startTime)).toFixed(2)),
    end: Number((w.end + (newStart - targetLine.startTime)).toFixed(2)),
  }));

  const clonedLine: LyricLine = {
    ...targetLine,
    id: `lyr-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    startTime: Number(newStart.toFixed(2)),
    endTime: Number(newEnd.toFixed(2)),
    words,
  };

  const newLines = [...mainLines];
  newLines.splice(lineIndex + 1, 0, clonedLine);

  syncAllLyrics(newLines);
  globalHistory.recordSnapshot('Duplicate Lyric Line');
}

/**
 * Delete a lyric line
 */
export function deleteLyricLine(lineId: string): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const newLines = mainLines.filter((l) => l.id !== lineId);
  syncAllLyrics(newLines);
  globalHistory.recordSnapshot('Delete Lyric Line');
}

/**
 * Add a new lyric line at specific timestamp
 */
export function addLyricLineAtTime(time: number, text = 'New Lyric Line'): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const duration = useStore.getState().audioDuration || 120;
  const start = Math.max(0, Math.min(duration - 2, time));
  const end = Math.min(duration, start + 3);

  const newLine: LyricLine = {
    id: `lyr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    text,
    startTime: Number(start.toFixed(2)),
    endTime: Number(end.toFixed(2)),
  };
  newLine.words = ensureLineWords(newLine);

  const updated = [...mainLines, newLine].sort((a, b) => a.startTime - b.startTime);
  syncAllLyrics(updated);
  globalHistory.recordSnapshot('Add Lyric Line');
}

/**
 * Update text of a lyric line
 */
export function updateLyricLineText(lineId: string, newText: string): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const target = mainLines.find((l) => l.id === lineId);
  if (!target) return;

  const rawWords = newText.trim().split(/\s+/).filter(Boolean);
  const dur = Math.max(0.2, target.endTime - target.startTime);
  const wordDur = rawWords.length > 0 ? dur / rawWords.length : dur;

  const newWords = rawWords.map((word, i) => ({
    word,
    start: Number((target.startTime + i * wordDur).toFixed(2)),
    end: Number((target.startTime + (i + 1) * wordDur).toFixed(2)),
    startTime: Number((target.startTime + i * wordDur).toFixed(2)),
    endTime: Number((target.startTime + (i + 1) * wordDur).toFixed(2)),
  }));

  const updatedLines = mainLines.map((l) =>
    l.id === lineId
      ? {
          ...l,
          text: newText,
          words: newWords,
        }
      : l
  );

  syncAllLyrics(updatedLines);
  globalHistory.recordSnapshot('Edit Lyric Text');
}

/**
 * Update single word timing
 */
export function updateWordTiming(
  lineId: string,
  wordIndex: number,
  newStart: number,
  newEnd: number,
  recordToHistory = true
): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const targetLine = mainLines.find((l) => l.id === lineId);
  if (!targetLine) return;

  const words = ensureLineWords(targetLine);
  if (wordIndex < 0 || wordIndex >= words.length) return;

  const updatedWords = words.map((w, idx) => {
    if (idx === wordIndex) {
      return {
        word: w.word,
        start: Number(newStart.toFixed(2)),
        end: Number(newEnd.toFixed(2)),
        startTime: Number(newStart.toFixed(2)),
        endTime: Number(newEnd.toFixed(2)),
      };
    }
    return w;
  });

  // Re-adjust line boundaries if word dragged outside
  const minStart = Math.min(...updatedWords.map((w) => w.start));
  const maxEnd = Math.max(...updatedWords.map((w) => w.end));

  const updatedLines = mainLines.map((l) =>
    l.id === lineId
      ? {
          ...l,
          startTime: Number(Math.min(l.startTime, minStart).toFixed(2)),
          endTime: Number(Math.max(l.endTime, maxEnd).toFixed(2)),
          words: updatedWords,
        }
      : l
  );

  syncAllLyrics(updatedLines);
  if (recordToHistory) {
    globalHistory.recordSnapshot('Update Word Timing');
  }
}

/**
 * Edit word text
 */
export function updateWordText(lineId: string, wordIndex: number, newWordText: string): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const targetLine = mainLines.find((l) => l.id === lineId);
  if (!targetLine) return;

  const words = ensureLineWords(targetLine);
  if (wordIndex < 0 || wordIndex >= words.length) return;

  words[wordIndex].word = newWordText;
  const fullText = words.map((w) => w.word).join(' ');

  const updatedLines = mainLines.map((l) =>
    l.id === lineId
      ? {
          ...l,
          text: fullText,
          words: [...words],
        }
      : l
  );

  syncAllLyrics(updatedLines);
  globalHistory.recordSnapshot('Edit Word Text');
}

/**
 * Delete word from line
 */
export function deleteWord(lineId: string, wordIndex: number): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const targetLine = mainLines.find((l) => l.id === lineId);
  if (!targetLine) return;

  const words = ensureLineWords(targetLine);
  if (wordIndex < 0 || wordIndex >= words.length) return;

  const newWords = words.filter((_, idx) => idx !== wordIndex);
  if (newWords.length === 0) {
    deleteLyricLine(lineId);
    return;
  }

  const fullText = newWords.map((w) => w.word).join(' ');
  const updatedLines = mainLines.map((l) =>
    l.id === lineId
      ? {
          ...l,
          text: fullText,
          words: newWords,
        }
      : l
  );

  syncAllLyrics(updatedLines);
  globalHistory.recordSnapshot('Delete Word');
}

/**
 * Insert a word into a line
 */
export function insertWord(
  lineId: string,
  afterIndex: number,
  newWordText = 'word'
): void {
  const mainLines = useStore.getState().lyricsSettings?.lines || [];
  const targetLine = mainLines.find((l) => l.id === lineId);
  if (!targetLine) return;

  const words = ensureLineWords(targetLine);
  const insertIdx = afterIndex >= 0 ? afterIndex + 1 : 0;

  let start = targetLine.startTime;
  let end = targetLine.endTime;

  if (afterIndex >= 0 && afterIndex < words.length) {
    const prev = words[afterIndex];
    start = prev.end;
    end = start + 0.4;
  }

  const newWordObj = {
    word: newWordText,
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  };

  const newWords = [...words];
  newWords.splice(insertIdx, 0, newWordObj);

  const fullText = newWords.map((w) => w.word).join(' ');
  const updatedLines = mainLines.map((l) =>
    l.id === lineId
      ? {
          ...l,
          text: fullText,
          endTime: Math.max(l.endTime, end),
          words: newWords,
        }
      : l
  );

  syncAllLyrics(updatedLines);
  globalHistory.recordSnapshot('Insert Word');
}
