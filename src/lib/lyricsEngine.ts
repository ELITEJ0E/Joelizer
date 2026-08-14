import { LyricVideoTemplate, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from './lyricsTemplates';
import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { LyricLine, useStore } from '../store/useStore';

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

// Helper to truncate text with ellipsis on 2D canvas
function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
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
  const isPlaying = useStore.getState().isPlaying;
  const isVertical = H > W;
  
  // 1. Resolve Background Settings (Static Mureka Abstract Color Field)
  const bgType = config.customBackground?.type || template.defaultBackground.type;
  const bgVal = config.customBackground?.value || template.defaultBackground.value;
  const bgVidUrl = config.customBackground?.videoUrl;

  const albumArtImg = getCachedImage(trackMeta.albumArtUrl);
  const bgVideoEl = bgVidUrl ? getCachedVideo(bgVidUrl) : null;

  // Draw Background Layer (No audio pulse, static heavily blurred aurora / lava-lamp field)
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

  // 2. Resolve Artwork & Vinyl Object Style
  const artStyle = config.artworkOverride?.style || template.layout.artworkType;
  const artScale = config.artworkOverride?.sizeScale || 1.0;

  // Render Visualizer / Album Art / Vinyl Object
  if (artStyle !== 'none' && artStyle !== 'background-blur') {
    renderArtworkObject(
      ctx,
      W,
      H,
      currentTime,
      isPlaying,
      albumArtImg,
      trackMeta,
      artStyle,
      artScale,
      template,
      config.elementPositions?.artwork,
      audioFrequencyData
    );
  }

  // 3. Render Song Title & Artist Text with Truncation (Ellipsis)
  if (template.layout.showSongTitle || template.layout.showArtist) {
    renderSongMetaText(ctx, W, H, trackMeta, template, config.elementPositions?.meta);
  }

  // 4. Render Synchronized Lyric Line (Single Active Line, Cross-Fade, Static Typography)
  renderSynchronizedLyrics(
    ctx,
    W,
    H,
    currentTime,
    lyricsLines,
    config,
    template,
    config.elementPositions?.lyrics
  );

  // 5. Render Horizontal Segment Dots Indicator Row below lyrics
  renderSegmentDots(ctx, W, H, config.elementPositions?.visualizer, audioFrequencyData);

  // 6. Render Watermark text
  renderWatermarkText(ctx, W, H, config.watermarkText || 'Made with Joelizer', config.elementPositions?.watermark);

  // 7. Render Safe-Area overlay guide if toggled on
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
  isPlaying: boolean,
  img: HTMLImageElement | null,
  trackMeta: TrackMeta,
  artStyle: ArtworkStyle,
  artScale: number,
  template: LyricVideoTemplate,
  pos?: { x: number; y: number },
  audioFrequencyData?: Uint8Array | null
) {
  ctx.save();

  const isVertical = H > W;
  
  // Calculate real-time bass-frequency pulse scale
  let pulseScale = 1.0;
  if (isPlaying && audioFrequencyData && audioFrequencyData.length > 0) {
    let bassSum = 0;
    const bins = Math.min(10, audioFrequencyData.length);
    for (let i = 0; i < bins; i++) {
      bassSum += audioFrequencyData[i];
    }
    const bassAvg = bassSum / bins;
    pulseScale = 1.0 + (bassAvg / 255) * 0.055; // Subtle elastic pulse matching kick/bass beats
  }

  const size = Math.min(W, H) * (isVertical ? 0.42 : 0.35) * artScale * pulseScale;
  const cx = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.28);
  const cy = pos ? pos.y * H : (isVertical ? H * 0.40 : H * 0.40);

  // Constant Linear Rotation for Vinyl (33 1/3 RPM -> 1 rotation per 1.8s)
  const rotAngle = (currentTime / 1.8) * Math.PI * 2;

  ctx.translate(cx, cy);

  if (artStyle === 'vinyl' || artStyle === 'vinyl-needle' || artStyle === 'cd' || artStyle === 'cd-needle') {
    const recordRadius = size / 2;
    const isCD = artStyle === 'cd' || artStyle === 'cd-needle';

    // Radial Visualizer Bars pulsing behind the Rotating Disc!
    if (audioFrequencyData && audioFrequencyData.length > 0) {
      ctx.save();
      const barCount = 64;
      const startRadius = recordRadius * 0.98;
      const maxExtra = recordRadius * 0.32;
      const activeColor = useStore.getState().visualizerSettings?.color || '#00e676';
      
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = Math.max(1.8, recordRadius * 0.015);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = activeColor;
      
      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        const rawValue = audioFrequencyData[i % audioFrequencyData.length];
        const valPercent = rawValue / 255;
        const barHeight = maxExtra * Math.pow(valPercent, 1.2);
        
        // Distribute in a full circle, slightly rotating for extra magic
        const angle = (i / barCount) * Math.PI * 2 + rotAngle * 0.25;
        const x1 = Math.cos(angle) * startRadius;
        const y1 = Math.sin(angle) * startRadius;
        const x2 = Math.cos(angle) * (startRadius + barHeight);
        const y2 = Math.sin(angle) * (startRadius + barHeight);
        
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 1. Outer Disc Base & Soft Drop Shadow
    ctx.shadowBlur = 35;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;

    if (isCD) {
      // CD / Frosted Holo Disc Outer Base
      const cdGrad = ctx.createRadialGradient(0, 0, recordRadius * 0.4, 0, 0, recordRadius);
      cdGrad.addColorStop(0, 'rgba(40, 40, 48, 0.85)');
      cdGrad.addColorStop(0.7, 'rgba(20, 20, 26, 0.90)');
      cdGrad.addColorStop(1, 'rgba(10, 10, 14, 0.95)');
      ctx.fillStyle = cdGrad;
    } else {
      // Classic Black Vinyl Disc Outer Base
      ctx.fillStyle = '#0c0c0e';
    }

    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Outer Silver / Metallic Bevel Rim
    ctx.strokeStyle = isCD ? 'rgba(255, 255, 255, 0.40)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isCD ? 3.5 : 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, recordRadius - 1, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Rotating Disc Content (Grooves + Artwork Label)
    ctx.save();
    ctx.rotate(rotAngle);

    if (isCD) {
      // CD Iridescent / Holographic Sheen Ring
      const holoGrad = ctx.createLinearGradient(-recordRadius, -recordRadius, recordRadius, recordRadius);
      holoGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      holoGrad.addColorStop(0.3, 'rgba(200, 220, 255, 0.08)');
      holoGrad.addColorStop(0.5, 'rgba(255, 200, 220, 0.12)');
      holoGrad.addColorStop(0.8, 'rgba(200, 255, 220, 0.08)');
      holoGrad.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
      ctx.fillStyle = holoGrad;
      ctx.beginPath();
      ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fine Concentric Vinyl Groove Rings
      const ringCount = 22;
      for (let i = 1; i < ringCount; i++) {
        const r = recordRadius * (0.54 + (i / ringCount) * 0.44);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.60)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Specular Glint Reflection Sweeps
      const shineGrad = ctx.createLinearGradient(-recordRadius, -recordRadius, recordRadius, recordRadius);
      shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      shineGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.02)');
      shineGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.30)');
      shineGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.02)');
      shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0.16)');
      ctx.fillStyle = shineGrad;
      ctx.beginPath();
      ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Center Album Artwork Circular Label (~54% of disc diameter, as in Mureka ref)
    const labelRadius = recordRadius * 0.54;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    } else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    }
    ctx.restore(); // Restore clip

    // Metallic Inner Ring Framing the Artwork (Silver Bevel)
    const bevelGrad = ctx.createLinearGradient(-labelRadius, -labelRadius, labelRadius, labelRadius);
    bevelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    bevelGrad.addColorStop(0.5, 'rgba(160, 160, 175, 0.50)');
    bevelGrad.addColorStop(1, 'rgba(255, 255, 255, 0.75)');
    ctx.strokeStyle = bevelGrad;
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore(); // Restore disc rotation

    // Center Spindle Hole (Tiny dark hole at dead center)
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#050508';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Tonearm (Anchored top-right, smooth swing onto record)
    ctx.save();
    const pivotX = recordRadius * 0.85;
    const pivotY = -recordRadius * 0.85;

    // Target angle: 0.38 rad when playing, 0.05 rad when paused
    const targetArmAngle = isPlaying ? 0.38 : 0.05;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(targetArmAngle);

    // Tonearm drop shadow
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Outer Pivot Halo Ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Arm Shaft (Metallic Chrome rod)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-recordRadius * 0.85, recordRadius * 1.15);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arm Elbow Bend
    ctx.beginPath();
    ctx.moveTo(-recordRadius * 0.85, recordRadius * 1.15);
    ctx.lineTo(-recordRadius * 0.94, recordRadius * 1.28);
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Silver Cartridge Headshell
    ctx.fillStyle = '#e4e4e7';
    ctx.fillRect(-recordRadius * 1.02, recordRadius * 1.28, 13, 18);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-recordRadius * 0.99, recordRadius * 1.30, 7, 12);

    // Two small pin holes on cartridge
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(-recordRadius * 0.97, recordRadius * 1.38, 1.2, 0, Math.PI * 2);
    ctx.arc(-recordRadius * 0.93, recordRadius * 1.38, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Pivot Base Cap
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#27272a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#e4e4e7';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();

    ctx.restore();
  } else {
    // --- SQUARE ALBUM ARTWORK CONTAINER (~22% CORNER RADIUS, NO BORDER, DROP SHADOW) ---
    const half = size / 2;
    const cornerRadius = size * 0.22; // ~22% corner radius matching spec

    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#18181b';

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-half, -half, size, size, cornerRadius);
    } else {
      ctx.fillRect(-half, -half, size, size);
    }
    ctx.fill();
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -half, -half, size, size);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-half, -half, size, size);
    }
  }

  ctx.restore();
}

// Render Song Title & Artist Text (Single Line, Ellipsis Truncation)
function renderSongMetaText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  trackMeta: TrackMeta,
  template: LyricVideoTemplate,
  pos?: { x: number; y: number }
) {
  ctx.save();
  const isVertical = H > W;

  const fontSize = Math.max(14, Math.round(H * (isVertical ? 0.026 : 0.028)));
  const posX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.28);
  const posY = pos ? pos.y * H : (isVertical ? H * 0.12 : H * 0.72);

  const maxTextWidth = isVertical ? W * 0.85 : W * 0.40;

  ctx.textAlign = isVertical ? 'center' : 'center';
  ctx.textBaseline = 'top';

  if (trackMeta.title) {
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;

    const truncatedTitle = truncateCanvasText(ctx, trackMeta.title, maxTextWidth);
    ctx.fillText(truncatedTitle, posX, posY);
  }

  if (trackMeta.artist) {
    const artistFontSize = Math.round(fontSize * 0.78);
    ctx.font = `500 ${artistFontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.shadowBlur = 4;

    const truncatedArtist = truncateCanvasText(ctx, trackMeta.artist, maxTextWidth);
    ctx.fillText(truncatedArtist, posX, posY + fontSize * 1.35);
  }

  ctx.restore();
}

// Synchronized Lyric Engine (Single Line, Cross-Fade, No Beat Pulse/Bounce)
function renderSynchronizedLyrics(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: LyricLine[],
  config: LyricsRenderConfig,
  template: LyricVideoTemplate,
  pos?: { x: number; y: number }
) {
  if (!lyricsLines || lyricsLines.length === 0) return;

  ctx.save();
  const isVertical = H > W;

  // Find active line
  let activeIndex = lyricsLines.findIndex(l => currentTime >= l.startTime && currentTime <= l.endTime);
  if (activeIndex === -1) {
    activeIndex = lyricsLines.findIndex(l => l.startTime > currentTime);
    if (activeIndex !== -1 && activeIndex > 0 && currentTime < lyricsLines[activeIndex].startTime) {
      activeIndex = activeIndex - 1;
    }
  }

  const activeLine = activeIndex !== -1 ? lyricsLines[activeIndex] : null;
  if (!activeLine) {
    ctx.restore();
    return;
  }

  // Calculate 250ms smooth cross-fade opacity for lyric line entry & exit
  const lineDuration = Math.max(0.4, activeLine.endTime - activeLine.startTime);
  const elapsed = currentTime - activeLine.startTime;
  const remaining = activeLine.endTime - currentTime;

  const fadeInOpacity = Math.max(0, Math.min(1, elapsed / 0.25));
  const fadeOutOpacity = Math.max(0, Math.min(1, remaining / 0.25));
  const lineOpacity = Math.min(fadeInOpacity, fadeOutOpacity);

  ctx.globalAlpha = lineOpacity;

  // Typography Settings
  const fontFamily = config.typographyOverride?.fontFamily || template.typography.fontFamily || 'Inter';
  const fontWeight = config.typographyOverride?.fontWeight || '600';
  const baseFontSize = Math.max(16, Math.round(H * (isVertical ? 0.038 : 0.045) * (config.typographyOverride?.fontSizeScale || 1.0)));

  const lyricX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.72);
  const lyricY = pos ? pos.y * H : (isVertical ? H * 0.72 : H * 0.45);

  ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lyricsSettings = useStore.getState().lyricsSettings;
  const isKaraoke = lyricsSettings?.animationStyle === 'karaoke';
  const accentColor = config.typographyOverride?.activeWordColor || lyricsSettings?.color || template.typography.activeWordColor || '#00e676';
  const inactiveColor = config.typographyOverride?.inactiveWordColor || template.typography.inactiveWordColor || 'rgba(255, 255, 255, 0.45)';
  const textColor = config.typographyOverride?.textColor || template.typography.textColor || '#ffffff';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;

  const maxLineWidth = isVertical ? W * 0.88 : W * 0.48;

  // Measure text and break if needed
  const measuredW = ctx.measureText(activeLine.text).width;
  const linesToDraw: string[] = [];

  if (measuredW > maxLineWidth && isVertical) {
    const words = activeLine.text.split(' ');
    const mid = Math.ceil(words.length / 2);
    linesToDraw.push(words.slice(0, mid).join(' '));
    linesToDraw.push(words.slice(mid).join(' '));
  } else {
    linesToDraw.push(truncateCanvasText(ctx, activeLine.text, maxLineWidth));
  }

  const lineGap = baseFontSize * 1.25;
  const totalHeight = (linesToDraw.length - 1) * lineGap;
  const startY = lyricY - totalHeight / 2;

  if (isKaraoke) {
    // Smooth Karaoke Highlight rendering
    const progress = Math.max(0, Math.min(1, elapsed / lineDuration));
    const fullText = activeLine.text;
    const totalChars = fullText.length;
    const targetCharIdx = totalChars * progress;

    let charAccumulator = 0;

    linesToDraw.forEach((lineText, index) => {
      const lineY = startY + (index * lineGap);
      const lineW = ctx.measureText(lineText).width;

      // Draw unhighlighted line (semi-transparent)
      ctx.fillStyle = inactiveColor;
      ctx.fillText(lineText, lyricX, lineY);

      // Calculate highlighting progress for this sub-line
      const lineLength = lineText.length;
      const lineStartIdx = charAccumulator;
      const lineEndIdx = lineStartIdx + lineLength;

      let lineProgress = 0;
      if (targetCharIdx >= lineEndIdx) {
        lineProgress = 1;
      } else if (targetCharIdx <= lineStartIdx) {
        lineProgress = 0;
      } else {
        lineProgress = (targetCharIdx - lineStartIdx) / lineLength;
      }

      if (lineProgress > 0) {
        ctx.save();
        const startX = lyricX - (lineW / 2);
        ctx.beginPath();
        ctx.rect(startX, lineY - baseFontSize * 0.7, lineW * lineProgress, baseFontSize * 1.4);
        ctx.clip();
        ctx.fillStyle = accentColor;
        ctx.fillText(lineText, lyricX, lineY);
        ctx.restore();
      }

      charAccumulator += lineLength + 1; // plus space
    });
  } else {
    // Classic Fade In/Out or other styles (Solid text)
    ctx.fillStyle = textColor;
    linesToDraw.forEach((lineText, index) => {
      const lineY = startY + (index * lineGap);
      ctx.fillText(lineText, lyricX, lineY);
    });
  }

  ctx.restore();
}

// Render Horizontal Segment Dots Indicator Row or real-time Audio Visualizer
function renderSegmentDots(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pos?: { x: number; y: number },
  audioFrequencyData?: Uint8Array | null
) {
  ctx.save();
  const isVertical = H > W;

  const posX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.72);
  const posY = pos ? pos.y * H : (isVertical ? H * 0.84 : H * 0.68);

  const visSettings = useStore.getState().visualizerSettings;
  const themeColor = visSettings?.color || '#00e676';

  if (audioFrequencyData && audioFrequencyData.length > 0) {
    // Render real audio-reactive compact spectrum bars centered at posX, posY!
    const barCount = 16;
    const barWidth = Math.max(3, Math.round(W * 0.008));
    const barGap = Math.max(2, Math.round(W * 0.004));
    const totalW = barCount * (barWidth + barGap) - barGap;
    const startX = posX - totalW / 2;
    const maxBarHeight = Math.max(15, H * 0.07);

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = themeColor;
    ctx.fillStyle = themeColor;

    for (let i = 0; i < barCount; i++) {
      const rawValue = audioFrequencyData[i % audioFrequencyData.length];
      const percent = rawValue / 255;
      const barHeight = Math.max(3, maxBarHeight * Math.pow(percent, 1.25));

      const bx = startX + i * (barWidth + barGap);
      const by = posY - barHeight / 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, barWidth, barHeight, barWidth / 2);
      } else {
        ctx.fillRect(bx, by, barWidth, barHeight);
      }
      ctx.fill();
    }
    ctx.restore();
  } else {
    // Fallback to elegant passive design segment dots
    const dotCount = 8;
    const dotRadius = Math.max(1.5, Math.round(H * 0.0035));
    const dotSpacing = Math.max(8, Math.round(H * 0.015));
    const totalW = (dotCount - 1) * dotSpacing;
    const startX = posX - totalW / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < dotCount; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * dotSpacing, posY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
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
  const isVertical = H > W;

  const fontSize = Math.max(10, Math.round(H * 0.018));
  ctx.font = `500 ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const posX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.72);
  const posY = pos ? pos.y * H : (isVertical ? H * 0.92 : H * 0.88);

  ctx.fillText(text, posX, posY);
  ctx.restore();
}

// Render Safe Area Margins Guide
function renderSafeAreaGuide(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  const marginX = W * 0.05;
  const marginY = H * 0.05;

  ctx.strokeRect(marginX, marginY, W - marginX * 2, H - marginY * 2);

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.fillText('SAFE AREA GUIDE', marginX + 8, marginY + 14);

  ctx.restore();
}
