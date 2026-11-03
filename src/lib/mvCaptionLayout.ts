/**
 * Responsive, aspect-ratio-safe MV caption layout.
 *
 * Layout is independent of React and of the playback clock. Calculate it
 * whenever a lyric line or canvas dimensions change, not on every frame.
 * The same fragments carry karaoke timings after wrapping, so highlighting
 * never changes word position or causes horizontal overflow.
 */

export interface MVCaptionWord {
  word: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
}

export interface MVCaptionLine {
  text: string;
  words?: MVCaptionWord[];
}

export interface MVCaptionFragment {
  text: string;
  width: number;
  start?: number;
  end?: number;
}

export interface MVCaptionRow {
  fragments: MVCaptionFragment[];
  width: number;
}

export interface MVCaptionLayout {
  rows: MVCaptionRow[];
  fontSize: number;
  lineHeight: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  paddingX: number;
  firstBaselineY: number;
  safeWidth: number;
}

type MeasureText = (text: string, fontSize: number) => number;

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u;

function needsSpace(previous: string, next: string): boolean {
  return Boolean(previous && next && !CJK.test(previous.slice(-1)) && !CJK.test(next[0]));
}

function toWordFragments(line: MVCaptionLine): MVCaptionFragment[] {
  if (line.words?.length) {
    return line.words
      .filter(word => word.word?.trim())
      .map(word => ({
        text: word.word.trim(),
        width: 0,
        start: word.start ?? word.startTime,
        end: word.end ?? word.endTime
      }));
  }
  return line.text.trim().split(/\s+/u).filter(Boolean).map(text => ({ text, width: 0 }));
}

function wrapCaption(
  fragments: MVCaptionFragment[],
  width: number,
  fontSize: number,
  measure: MeasureText
): MVCaptionRow[] {
  const rows: MVCaptionRow[] = [];
  let current: MVCaptionRow = { fragments: [], width: 0 };
  const finish = () => {
    if (current.fragments.length) rows.push(current);
    current = { fragments: [], width: 0 };
  };

  for (const fragment of fragments) {
    // Split single long unbroken strings (URLs, CJK, etc.), otherwise even a
    // font-size reduction cannot prevent caption text overflowing the canvas.
    const clusters = Array.from(fragment.text);
    let part = '';
    const parts: string[] = [];
    for (const cluster of clusters) {
      if (part && measure(part + cluster, fontSize) > width) {
        parts.push(part);
        part = cluster;
      } else {
        part += cluster;
      }
    }
    if (part) parts.push(part);

    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      const prev = current.fragments[current.fragments.length - 1]?.text.trimEnd() || '';
      const separator = i === 0 && current.fragments.length && needsSpace(prev, token) ? ' ' : '';
      const fullText = separator + token;
      const candidateWidth = measure(fullText, fontSize);
      if (current.fragments.length && current.width + candidateWidth > width + 0.001) {
        finish();
      }
      const prefix = current.fragments.length === 0 ? '' : separator;
      const text = prefix + token;
      const itemWidth = measure(text, fontSize);
      current.fragments.push({ ...fragment, text, width: itemWidth });
      current.width += itemWidth;
    }
  }

  finish();
  return rows.length ? rows : [{ fragments: [], width: 0 }];
}

export function layoutMVCaption(
  line: MVCaptionLine,
  canvasWidth: number,
  canvasHeight: number,
  measure: MeasureText
): MVCaptionLayout {
  const W = Math.max(1, canvasWidth);
  const H = Math.max(1, canvasHeight);
  const paddingX = Math.max(9, Math.min(36, Math.round(W * 0.025)));
  const safeWidth = Math.max(1, W * 0.9 - 2 * paddingX);
  const words = toWordFragments(line);

  // Keep subtitles readable on 16:9, square, and portrait crops. Long lines
  // get wrapped and then scaled down until their block fits within the safe
  // caption region; the width always takes precedence over the original font.
  let fontSize = Math.min(64, Math.max(16, Math.round(H * 0.045)));
  const minFontSize = Math.max(12, Math.round(H * 0.018));
  let rows = wrapCaption(words, safeWidth, fontSize, measure);
  let lineHeight = Math.round(fontSize * 1.3);

  while (fontSize > minFontSize && rows.length * lineHeight > H * 0.42) {
    fontSize = Math.max(minFontSize, fontSize - 2);
    lineHeight = Math.round(fontSize * 1.3);
    rows = wrapCaption(words, safeWidth, fontSize, measure);
  }

  // Maximise legibility without letting the dark pill obscure the entire MV.
  const lineWidth = Math.max(1, ...rows.map(row => row.width));
  const boxWidth = Math.min(W * 0.94, Math.ceil(lineWidth + paddingX * 2));
  const paddingY = Math.max(7, Math.round(fontSize * 0.36));
  const boxHeight = Math.ceil(rows.length * lineHeight + paddingY * 2);
  const bottomMargin = Math.max(10, Math.round(H * 0.075));
  const boxX = (W - boxWidth) / 2;
  const boxY = Math.max(Math.round(H * 0.03), H - bottomMargin - boxHeight);
  const firstBaselineY = boxY + paddingY + lineHeight / 2;

  return {
    rows, fontSize, lineHeight, boxX, boxY, boxWidth, boxHeight,
    paddingX, firstBaselineY, safeWidth
  };
}

export function drawMVCaption(
  ctx: CanvasRenderingContext2D,
  layout: MVCaptionLayout,
  time: number
): void {
  const { fontSize, rows, lineHeight, boxX, boxY, boxWidth, boxHeight, firstBaselineY } = layout;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 14, 0.76)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxWidth, boxHeight, Math.max(8, fontSize * 0.26));
  else ctx.rect(boxX, boxY, boxWidth, boxHeight);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px sans-serif`;
  // Restrict all glyphs to safe bounds even on nonstandard browser font metrics.
  ctx.beginPath();
  ctx.rect(boxX, boxY, boxWidth, boxHeight);
  ctx.clip();

  rows.forEach((row, rowIndex) => {
    let x = boxX + (boxWidth - row.width) / 2;
    const y = firstBaselineY + rowIndex * lineHeight;
    for (const fragment of row.fragments) {
      const isCurrent = fragment.start !== undefined && fragment.end !== undefined &&
        time >= fragment.start && time < fragment.end;
      ctx.fillStyle = isCurrent ? '#fde047' : '#f8fafc';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
      ctx.fillText(fragment.text, x, y);
      x += fragment.width;
    }
  });
  ctx.restore();
}
