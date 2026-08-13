import { LyricVideoTemplate, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from './lyricsTemplates';
import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { LyricLine } from '../store/useStore';

export interface LyricsRenderConfig {
  template: LyricVideoTemplate;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3';
  customBackground?: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    value: string;
    videoUrl?: string;
  };
  typographyOverride?: {
    fontFamily?: string;
    fontWeight?: string;
    fontSizeScale?: number;
    textColor?: string;
    activeWordColor?: string;
    inactiveWordColor?: string;
    glowColor?: string;
    showContainerPill?: boolean;
    pillBgColor?: string;
  };
  artworkOverride?: {
    style?: ArtworkStyle;
    animation?: ArtworkAnimation;
    sizeScale?: number;
  };
  animationOverride?: {
    lineAnimation?: LineAnimation;
    wordAnimation?: WordAnimation;
  };
  elementPositions?: {
    artwork?: { x: number; y: number };
    meta?: { x: number; y: number };
    lyrics?: { x: number; y: number };
    visualizer?: { x: number; y: number };
    watermark?: { x: number; y: number };
  };
  watermarkText?: string;
  showSafeArea?: boolean;
}

export interface TrackMeta {
  title: string;
  artist: string;
  albumArtUrl?: string | null;
}

// Memory caches for images and videos to keep 60fps rendering without canvas thrashing
const imgElementCache = new Map<string, HTMLImageElement>();
const videoElementCache = new Map<string, HTMLVideoElement>();

function getCachedImage(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  let img = imgElementCache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    imgElementCache.set(url, img);
  }
  return img;
}

function getCachedVideo(url: string | null | undefined): HTMLVideoElement | null {
  if (!url) return null;
  let v = videoElementCache.get(url);
  if (!v) {
    v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    v.play().catch(() => {});
    videoElementCache.set(url, v);
  }
  return v;
}

export function renderLyricsVideoFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: LyricLine[],
  trackMeta: TrackMeta,
  config: LyricsRenderConfig,
  audioFrequencyData?: Uint8Array | null
) {
  const { template } = config;
  
  // 1. Resolve Background Settings
  const bgType = config.customBackground?.type || template.defaultBackground.type;
  const bgVal = config.customBackground?.value || template.defaultBackground.value;
  const bgVidUrl = config.customBackground?.videoUrl;

  const albumArtImg = getCachedImage(trackMeta.albumArtUrl);
  const bgVideoEl = bgVidUrl ? getCachedVideo(bgVidUrl) : null;

  // Draw Background Layer
  drawBackgroundCanvas(
    ctx,
    W,
    H,
    currentTime,
    {
      type: bgType,
      value: bgVal,
      videoUrl: bgVidUrl,
      videoElement: bgVideoEl,
      imageElement: albumArtImg
    },
    albumArtImg,
    audioFrequencyData
  );

  // 2. Resolve Artwork & Visualizer Object Style
  const artStyle = config.artworkOverride?.style || template.layout.artworkType;
  const artAnim = config.artworkOverride?.animation || template.layout.artworkAnim;
  const artScale = config.artworkOverride?.sizeScale || 1.0;

  // Calculate Beat Intensity for Beat Sync animations (Pulse, Scale, etc.)
  let beatPulse = 1.0;
  if (audioFrequencyData && audioFrequencyData.length > 0) {
    let bassSum = 0;
    const bassBands = Math.floor(audioFrequencyData.length * 0.08);
    for (let i = 0; i < bassBands; i++) bassSum += audioFrequencyData[i];
    const avgBass = bassSum / Math.max(1, bassBands);
    beatPulse = 1.0 + (avgBass / 255) * 0.06; // subtle 1.00 -> 1.06 pulse
  } else {
    // Simulated smooth beat pulse if audio data not available
    beatPulse = 1.0 + Math.sin(currentTime * 6.28) * 0.02;
  }

  // Render Visualizer / Album Art Object
  if (artStyle !== 'none' && artStyle !== 'background-blur') {
    renderArtworkObject(
      ctx,
      W,
      H,
      currentTime,
      albumArtImg,
      trackMeta,
      artStyle,
      artAnim,
      artScale * beatPulse,
      template,
      config.elementPositions?.artwork
    );
  }

  // 3. Render Song Title & Artist Text if enabled
  if (template.layout.showSongTitle || template.layout.showArtist) {
    renderSongMetaText(ctx, W, H, trackMeta, template, config.elementPositions?.meta);
  }

  // 4. Render Synchronized Lyrics
  renderSynchronizedLyrics(
    ctx,
    W,
    H,
    currentTime,
    lyricsLines,
    config,
    template,
    beatPulse,
    config.elementPositions?.lyrics
  );

  // 5. Render Watermark text
  renderWatermarkText(ctx, W, H, config.watermarkText || 'Made with Joelizer', config.elementPositions?.watermark);

  // 6. Render Safe-Area overlay guide if toggled on
  if (config.showSafeArea) {
    renderSafeAreaGuide(ctx, W, H);
  }
}

// Render Vinyl Record & Artwork Styles
function renderArtworkObject(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  img: HTMLImageElement | null,
  trackMeta: TrackMeta,
  artStyle: ArtworkStyle,
  artAnim: ArtworkAnimation,
  beatScale: number,
  template: LyricVideoTemplate,
  pos?: { x: number; y: number }
) {
  ctx.save();

  // Position calculation
  const isVertical = H > W;
  const size = Math.min(W, H) * (isVertical ? 0.38 : 0.32) * beatScale;
  const cx = pos ? pos.x * W : W / 2;
  const cy = pos ? pos.y * H : (template.layout.artworkPosition === 'center' ? H / 2 : H * 0.32);

  // Animation Offset / Transforms
  let rotAngle = 0;
  let floatY = 0;

  if (artAnim === 'rotate') {
    rotAngle = (currentTime * 0.6) % (Math.PI * 2); // Smooth Vinyl rotation
  } else if (artAnim === 'float') {
    floatY = Math.sin(currentTime * 2) * (H * 0.015);
  } else if (artAnim === 'bounce') {
    floatY = Math.abs(Math.sin(currentTime * 3.5)) * -(H * 0.02);
  }

  ctx.translate(cx, cy + floatY);

  if (artStyle === 'vinyl' || artStyle === 'vinyl-needle') {
    // --- HYPER-REALISTIC ROTATING VINYL RECORD ---
    const recordRadius = size / 2;

    // 1. Vinyl Record Outer Glow
    ctx.shadowBlur = 25;
    ctx.shadowColor = template.typography.glowColor || 'rgba(234, 179, 8, 0.4)';
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Vinyl Record Grooves
    ctx.save();
    ctx.rotate(rotAngle);

    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric Groove Rings
    const ringCount = 12;
    for (let i = 1; i < ringCount; i++) {
      const r = recordRadius * (0.42 + (i / ringCount) * 0.55);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Specular Shine Reflections on Vinyl Grooves
    const shineGrad = ctx.createLinearGradient(-recordRadius, -recordRadius, recordRadius, recordRadius);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    shineGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.02)');
    shineGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
    shineGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.02)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Center Label Artwork Circle
    const labelRadius = recordRadius * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    } else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    }

    ctx.restore();

    // Center Spindle Hole
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#050508';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Tonearm
    if (artStyle === 'vinyl-needle') {
      ctx.save();
      // Pivot is top right of the record
      const pivotX = recordRadius * 0.8;
      const pivotY = -recordRadius * 0.8;
      
      // Gentle sway based on time
      const sway = Math.sin(currentTime * 0.5) * 0.05;
      
      ctx.translate(pivotX, pivotY);
      ctx.rotate(0.3 + sway); // Base angle + sway
      
      // Tonearm shadow
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      
      // The Arm
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-recordRadius * 0.8, recordRadius * 1.1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#a3a3a3';
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Arm bend
      ctx.beginPath();
      ctx.moveTo(-recordRadius * 0.8, recordRadius * 1.1);
      ctx.lineTo(-recordRadius * 0.9, recordRadius * 1.25);
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Stylus/Cartridge
      ctx.fillStyle = '#262626';
      ctx.fillRect(-recordRadius * 0.95, recordRadius * 1.25, 12, 18);
      ctx.fillStyle = '#525252';
      ctx.fillRect(-recordRadius * 0.92, recordRadius * 1.25, 6, 10);
      
      // Pivot Base
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#262626';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#171717';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#a3a3a3';
      ctx.fill();
      
      ctx.restore();
    }

  } else if (artStyle === 'cd' || artStyle === 'cd-needle') {
    // CD glowing ring + center artwork
    const cdRadius = size / 2;
    
    // Outer glow ring
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, cdRadius * 1.1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = cdRadius * 0.2;
    ctx.stroke();

    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, cdRadius * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;

    // Center Label Artwork Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, cdRadius, 0, Math.PI * 2);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -cdRadius, -cdRadius, cdRadius * 2, cdRadius * 2);
    } else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-cdRadius, -cdRadius, cdRadius * 2, cdRadius * 2);
    }
    ctx.restore();

    // Tonearm
    if (artStyle === 'cd-needle') {
      ctx.save();
      // Pivot is top right of the record
      const pivotX = cdRadius * 0.8;
      const pivotY = -cdRadius * 0.8;
      
      const sway = Math.sin(currentTime * 0.5) * 0.05;
      
      ctx.translate(pivotX, pivotY);
      ctx.rotate(0.3 + sway); // Base angle + sway
      
      // Tonearm shadow
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      
      // The Arm
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-cdRadius * 0.8, cdRadius * 1.1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e5e5e5'; // Lighter silver tone
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Arm bend
      ctx.beginPath();
      ctx.moveTo(-cdRadius * 0.8, cdRadius * 1.1);
      ctx.lineTo(-cdRadius * 0.9, cdRadius * 1.25);
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Stylus/Cartridge
      ctx.fillStyle = '#404040';
      ctx.fillRect(-cdRadius * 0.95, cdRadius * 1.25, 12, 18);
      ctx.fillStyle = '#737373';
      ctx.fillRect(-cdRadius * 0.92, cdRadius * 1.25, 6, 10);
      
      // Pivot Base
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#404040';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#262626';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#d4d4d4';
      ctx.fill();
      
      ctx.restore();
    }
  } else if (artStyle === 'circle' || artStyle === 'glowing-disc') {
    const r = size / 2;
    if (artStyle === 'glowing-disc') {
      ctx.shadowBlur = 30;
      ctx.shadowColor = template.typography.glowColor || '#38bdf8';
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -r, -r, size, size);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-r, -r, size, size);
    }
  } else {
    // Default Square / Framed Card
    const half = size / 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = '#18181b';

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-half, -half, size, size, 16);
      ctx.fill();
      ctx.clip();
    } else {
      ctx.fillRect(-half, -half, size, size);
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -half, -half, size, size);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-half, -half, size, size);
    }
  }

  ctx.restore();
}

// Render Song Title & Artist Text
function renderSongMetaText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  trackMeta: TrackMeta,
  template: LyricVideoTemplate,
  pos?: { x: number; y: number }
) {
  ctx.save();
  const fontSize = Math.round(H * 0.024);
  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1f5f9';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;

  const posX = pos ? pos.x * W : W / 2;
  const posY = pos ? pos.y * H : (template.layout.artworkType !== 'none' ? H * 0.53 : H * 0.15);
  
  if (trackMeta.title) {
    ctx.fillText(trackMeta.title, posX, posY);
  }
  if (trackMeta.artist) {
    ctx.font = `500 ${Math.round(fontSize * 0.8)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(trackMeta.artist, posX, posY + fontSize * 1.3);
  }

  ctx.restore();
}

// Synchronized Lyric Engine
function renderSynchronizedLyrics(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: LyricLine[],
  config: LyricsRenderConfig,
  template: LyricVideoTemplate,
  beatPulse: number,
  pos?: { x: number; y: number }
) {
  if (!lyricsLines || lyricsLines.length === 0) return;

  ctx.save();

  // Find active line and context lines
  let activeIndex = lyricsLines.findIndex(l => currentTime >= l.startTime && currentTime <= l.endTime);
  if (activeIndex === -1) {
    // Find next upcoming line if in gap
    activeIndex = lyricsLines.findIndex(l => l.startTime > currentTime);
    if (activeIndex !== -1 && activeIndex > 0 && currentTime < lyricsLines[activeIndex].startTime) {
      activeIndex = activeIndex - 1; // Stay on previous line during short instrumental break
    }
  }

  const activeLine = activeIndex !== -1 ? lyricsLines[activeIndex] : null;
  if (!activeLine) {
    ctx.restore();
    return;
  }

  // Typography Settings & Overrides
  const fontFamily = config.typographyOverride?.fontFamily || template.typography.fontFamily;
  const fontWeight = config.typographyOverride?.fontWeight || template.typography.fontWeight;
  const fontSizeScale = (config.typographyOverride?.fontSizeScale || template.typography.fontSizeScale) * (H * 0.042);
  const baseFontSize = Math.round(fontSizeScale);

  const activeWordColor = config.typographyOverride?.activeWordColor || template.typography.activeWordColor;
  const inactiveWordColor = config.typographyOverride?.inactiveWordColor || template.typography.inactiveWordColor;
  const glowColor = config.typographyOverride?.glowColor || template.typography.glowColor;
  const showPill = config.typographyOverride?.showContainerPill ?? template.typography.showContainerPill;
  const pillBg = config.typographyOverride?.pillBgColor || template.typography.pillBgColor;

  const wordAnim = config.animationOverride?.wordAnimation || template.animations.wordAnimation;

  // Position calculation
  const lyricX = pos ? pos.x * W : W / 2;
  const lyricY = pos ? pos.y * H : (template.layout.lyricPosition === 'center' ? H * 0.52 : H * 0.76);

  ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}, sans-serif`;

  // Process Word-level timing if available
  const rawWords = activeLine.words;
  const hasWordTimings = rawWords && rawWords.length > 0;

  let wordsToRender: Array<{ word: string; start: number; end: number }> = [];

  if (hasWordTimings) {
    wordsToRender = rawWords!.map(w => ({
      word: w.word,
      start: w.start ?? w.startTime ?? activeLine.startTime,
      end: w.end ?? w.endTime ?? activeLine.endTime
    }));
  } else {
    const tokens = activeLine.text.split(' ').filter(Boolean);
    const lineDur = Math.max(0.5, activeLine.endTime - activeLine.startTime);
    const tokenDur = lineDur / tokens.length;

    wordsToRender = tokens.map((tok, idx) => ({
      word: tok,
      start: activeLine.startTime + idx * tokenDur,
      end: activeLine.startTime + (idx + 1) * tokenDur
    }));
  }

  // Measure Total Width for Centered Container Box
  let totalLineW = 0;
  const wordWidths = wordsToRender.map(w => {
    const measured = ctx.measureText(w.word + ' ').width;
    totalLineW += measured;
    return measured;
  });

  const padX = 24;
  const boxW = Math.min(W * 0.92, totalLineW + padX * 2);
  const boxH = baseFontSize * 1.8;
  const boxX = lyricX - boxW / 2;
  const boxY = lyricY - boxH / 1.6;

  // Draw Container Pill
  if (showPill) {
    ctx.save();
    ctx.fillStyle = pillBg;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 14);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Render Words
  let startX = lyricX - totalLineW / 2;

  wordsToRender.forEach((w, idx) => {
    const isWordActive = currentTime >= w.start && currentTime <= w.end;
    const isWordPast = currentTime > w.end;

    const wordDur = Math.max(0.1, w.end - w.start);
    const wordProgress = Math.max(0, Math.min(1, (currentTime - w.start) / wordDur));

    ctx.save();

    if (isWordActive) {
      ctx.fillStyle = activeWordColor;
      
      let scale = 1.0;
      if (wordAnim === 'word-pop' || wordAnim === 'word-bounce') {
        scale = 1.0 + Math.sin(wordProgress * Math.PI) * 0.25;
      }

      if (glowColor && glowColor !== 'transparent') {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16;
      }

      ctx.font = `${fontWeight} ${Math.round(baseFontSize * scale)}px ${fontFamily}, sans-serif`;
    } else if (isWordPast) {
      ctx.fillStyle = activeWordColor;
    } else {
      ctx.fillStyle = inactiveWordColor;
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.word + ' ', startX, lyricY);

    ctx.restore();

    startX += wordWidths[idx];
  });

  // Next Line Preview below
  if (template.layout.showNextLine && activeIndex < lyricsLines.length - 1) {
    const nextLine = lyricsLines[activeIndex + 1];
    ctx.save();
    ctx.font = `500 ${Math.round(baseFontSize * 0.65)}px ${fontFamily}, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(nextLine.text, lyricX, lyricY + baseFontSize * 1.3);
    ctx.restore();
  }

  ctx.restore();
}

// Render Watermark credit text
function renderWatermarkText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  pos?: { x: number; y: number }
) {
  ctx.save();
  const fontSize = Math.max(10, Math.round(H * 0.018));
  ctx.font = `500 ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  
  const posX = pos ? pos.x * W : W / 2;
  const posY = pos ? pos.y * H : H * 0.92;
  
  ctx.fillText(text, posX, posY);
  ctx.restore();
}

// Render Safe Area Margins Guide
function renderSafeAreaGuide(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Soft red outline
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  const marginX = W * 0.05;
  const marginY = H * 0.05;

  ctx.strokeRect(marginX, marginY, W - marginX * 2, H - marginY * 2);

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.fillText('SAFE AREA (16:9 / 9:16 / 1:1)', marginX + 8, marginY + 14);

  ctx.restore();
}
