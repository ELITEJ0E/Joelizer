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
  secondaryText?: string;
  startTime?: number;
  endTime?: number;
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

export interface MVCaptionOptions {
  animationStyle?: 'karaoke' | 'fade';
  position?: 'bottom' | 'center' | 'top';
  showBackgroundBox?: boolean;
  boxColor?: string;
  textColor?: string;
  activeColor?: string;
  secondaryColor?: string;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeEasing?: 'linear' | 'smooth' | 'ease';
  bilingualEnabled?: boolean;
  fontFamily?: string;
}

export interface MVCaptionLayout {
  rows: MVCaptionRow[];
  secondaryRows?: MVCaptionRow[];
  fontSize: number;
  secondaryFontSize?: number;
  lineHeight: number;
  secondaryLineHeight?: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  paddingX: number;
  firstBaselineY: number;
  secondaryBaselineY?: number;
  safeWidth: number;
  lineStartTime: number;
  lineEndTime: number;
  options?: MVCaptionOptions;
}

export function computeFadeOpacity(
  currentTime: number,
  startTime: number,
  endTime: number,
  fadeInDuration: number = 0.4,
  fadeOutDuration: number = 0.4,
  easing: 'linear' | 'smooth' | 'ease' = 'smooth'
): number {
  if (currentTime < startTime || currentTime > endTime) {
    const trailDuration = Math.min(0.25, fadeOutDuration);
    if (currentTime > endTime && currentTime < endTime + trailDuration) {
      const trailT = 1 - (currentTime - endTime) / trailDuration;
      return trailT * trailT * 0.35;
    }
    return 0;
  }

  const duration = Math.max(0.2, endTime - startTime);
  const actualIn = Math.min(fadeInDuration, duration * 0.48);
  const actualOut = Math.min(fadeOutDuration, duration * 0.48);

  let inFactor = 1;
  if (actualIn > 0 && currentTime < startTime + actualIn) {
    const t = Math.max(0, Math.min(1, (currentTime - startTime) / actualIn));
    if (easing === 'linear') inFactor = t;
    else if (easing === 'ease') inFactor = Math.sin((t * Math.PI) / 2);
    else inFactor = t * t * (3 - 2 * t);
  }

  let outFactor = 1;
  if (actualOut > 0 && currentTime > endTime - actualOut) {
    const t = Math.max(0, Math.min(1, (endTime - currentTime) / actualOut));
    if (easing === 'linear') outFactor = t;
    else if (easing === 'ease') outFactor = Math.sin((t * Math.PI) / 2);
    else outFactor = t * t * (3 - 2 * t);
  }

  return Math.max(0, Math.min(1, inFactor * outFactor));
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
  measure: MeasureText,
  options?: MVCaptionOptions
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

  // Calculate timestamps for fade calculations
  let lineStartTime = line.startTime ?? 0;
  let lineEndTime = line.endTime ?? 0;
  for (const row of rows) {
    for (const f of row.fragments) {
      if (typeof f.start === 'number' && (lineStartTime === 0 || f.start < lineStartTime)) lineStartTime = f.start;
      if (typeof f.end === 'number' && f.end > lineEndTime) lineEndTime = f.end;
    }
  }
  if (lineEndTime <= lineStartTime) {
    lineEndTime = lineStartTime + 3.0;
  }

  // Bilingual secondary text support
  let secondaryRows: MVCaptionRow[] | undefined = undefined;
  let secondaryFontSize: number | undefined = undefined;
  let secondaryLineHeight: number | undefined = undefined;
  let secondaryHeight = 0;

  const isBilingual = (options?.bilingualEnabled !== false) && Boolean(line.secondaryText?.trim());
  if (isBilingual && line.secondaryText) {
    secondaryFontSize = Math.max(11, Math.round(fontSize * 0.72));
    secondaryLineHeight = Math.round(secondaryFontSize * 1.35);
    const secondaryFragments = line.secondaryText.trim().split(/\s+/u).filter(Boolean).map(text => ({ text, width: 0 }));
    secondaryRows = wrapCaption(secondaryFragments, safeWidth, secondaryFontSize, measure);
    secondaryHeight = secondaryRows.length * secondaryLineHeight + Math.round(fontSize * 0.3);
  }

  // Maximise legibility without letting the dark pill obscure the entire MV.
  const allRowWidths = rows.map(r => r.width);
  if (secondaryRows) {
    allRowWidths.push(...secondaryRows.map(r => r.width));
  }
  const lineWidth = Math.max(1, ...allRowWidths);
  const boxWidth = Math.min(W * 0.94, Math.ceil(lineWidth + paddingX * 2));
  const paddingY = Math.max(7, Math.round(fontSize * 0.36));
  const boxHeight = Math.ceil(rows.length * lineHeight + secondaryHeight + paddingY * 2);

  const isCentered = options?.position === 'center';
  const bottomMargin = Math.max(10, Math.round(H * 0.075));
  const boxX = (W - boxWidth) / 2;
  const boxY = isCentered
    ? Math.max(Math.round(H * 0.05), Math.round((H - boxHeight) / 2))
    : Math.max(Math.round(H * 0.03), H - bottomMargin - boxHeight);
  const firstBaselineY = boxY + paddingY + lineHeight / 2;
  const secondaryBaselineY = secondaryRows ? (firstBaselineY + rows.length * lineHeight) : undefined;

  return {
    rows,
    secondaryRows,
    fontSize,
    secondaryFontSize,
    lineHeight,
    secondaryLineHeight,
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    paddingX,
    firstBaselineY,
    secondaryBaselineY,
    safeWidth,
    lineStartTime,
    lineEndTime,
    options
  };
}

export function drawMVCaption(
  ctx: CanvasRenderingContext2D,
  layout: MVCaptionLayout,
  time: number,
  overrideOptions?: MVCaptionOptions
): void {
  const opt = overrideOptions || layout.options || {};
  const animStyle = opt.animationStyle || 'karaoke';
  const isFade = animStyle === 'fade';
  const showBox = opt.showBackgroundBox ?? false;

  const {
    fontSize,
    secondaryFontSize,
    rows,
    secondaryRows,
    lineHeight,
    secondaryLineHeight,
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    firstBaselineY,
    secondaryBaselineY,
    lineStartTime,
    lineEndTime
  } = layout;

  ctx.save();

  // Smooth Fade Animation computation
  if (isFade) {
    const fadeOpacity = computeFadeOpacity(
      time,
      lineStartTime,
      lineEndTime,
      opt.fadeInDuration ?? 0.4,
      opt.fadeOutDuration ?? 0.4,
      opt.fadeEasing ?? 'smooth'
    );
    if (fadeOpacity <= 0.005) {
      ctx.restore();
      return;
    }
    ctx.globalAlpha = fadeOpacity;
  }

  // Draw optional subtitle container box if enabled
  if (showBox) {
    ctx.fillStyle = opt.boxColor || 'rgba(8, 10, 14, 0.76)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxWidth, boxHeight, Math.max(8, fontSize * 0.26));
    else ctx.rect(boxX, boxY, boxWidth, boxHeight);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fontFamily = opt.fontFamily || 'Outfit, system-ui, sans-serif';
  ctx.font = `700 ${fontSize}px ${fontFamily}`;

  // Subtle text shadow for high legibility over bright scenic video
  ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
  ctx.shadowBlur = Math.max(3, Math.round(fontSize * 0.22));

  // Render Primary Line rows
  rows.forEach((row, rowIndex) => {
    let x = boxX + (boxWidth - row.width) / 2;
    const y = firstBaselineY + rowIndex * lineHeight;
    for (const fragment of row.fragments) {
      if (isFade) {
        ctx.fillStyle = opt.textColor || '#ffffff';
      } else {
        const isCurrent = fragment.start !== undefined && fragment.end !== undefined &&
          time >= fragment.start && time < fragment.end;
        ctx.fillStyle = isCurrent ? (opt.activeColor || '#fde047') : (opt.textColor || '#f8fafc');
      }
      ctx.fillText(fragment.text, x, y);
      x += fragment.width;
    }
  });

  // Render Optional Bilingual Secondary Line
  if (secondaryRows && secondaryRows.length > 0 && secondaryFontSize && secondaryLineHeight && secondaryBaselineY) {
    ctx.font = `500 ${secondaryFontSize}px ${fontFamily}`;
    ctx.fillStyle = opt.secondaryColor || 'rgba(255, 255, 255, 0.82)';
    ctx.shadowBlur = Math.max(2, Math.round(secondaryFontSize * 0.2));

    secondaryRows.forEach((row, rIdx) => {
      let x = boxX + (boxWidth - row.width) / 2;
      const y = secondaryBaselineY + rIdx * secondaryLineHeight;
      for (const fragment of row.fragments) {
        ctx.fillText(fragment.text, x, y);
        x += fragment.width;
      }
    });
  }

  ctx.restore();
}
