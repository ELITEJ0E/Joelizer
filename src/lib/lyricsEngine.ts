import { LyricVideoTemplate, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from './lyricsTemplates';
import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { LyricLine, useStore } from '../store/useStore';
import { getDefaultPositions } from './lyricsLayout';
import { computeContinuousLineSweep } from './karaokeSweep';

export interface LyricsRenderConfig {
  template: LyricVideoTemplate;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3';
  animationStyle?: 'karaoke' | 'fade';
  visibleLineCount?: number;
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

  // Resolve element positions with aspect-ratio defaults
  const defaultPos = getDefaultPositions(config.aspectRatio);
  const artworkPos = config.elementPositions?.artwork || defaultPos.artwork;
  const metaPos = config.elementPositions?.meta || defaultPos.meta;
  const lyricsPos = config.elementPositions?.lyrics || defaultPos.lyrics;
  const visualizerPos = config.elementPositions?.visualizer || defaultPos.visualizer;
  const watermarkPos = config.elementPositions?.watermark || defaultPos.watermark;

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
      artworkPos,
      audioFrequencyData
    );
  }

  // 3. Render Song Title & Artist Text with Truncation (Ellipsis)
  if (template.layout.showSongTitle || template.layout.showArtist) {
    renderSongMetaText(ctx, W, H, trackMeta, template, metaPos);
  }

  // 4. Render Synchronized Lyric Line (Karaoke Word-Level or Fade In/Out Line-Level)
  renderSynchronizedLyrics(
    ctx,
    W,
    H,
    currentTime,
    lyricsLines,
    config,
    template,
    lyricsPos
  );

  // 5. Render Horizontal Segment Dots Indicator Row below lyrics
  renderSegmentDots(ctx, W, H, visualizerPos, audioFrequencyData);

  // 6. Render Watermark text
  renderWatermarkText(ctx, W, H, config.watermarkText || 'Made with Joelizer', watermarkPos);

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
      // Classic Deep Black Vinyl Disc Base (#111 to #292929)
      const vinylGrad = ctx.createRadialGradient(0, 0, recordRadius * 0.1, 0, 0, recordRadius);
      vinylGrad.addColorStop(0, '#111111');
      vinylGrad.addColorStop(0.5, '#292929');
      vinylGrad.addColorStop(1, '#050505');
      ctx.fillStyle = vinylGrad;
    }

    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Outer Rim Light Bevel Frame
    ctx.strokeStyle = isCD ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.90)';
    ctx.lineWidth = isCD ? 3.5 : 2.5;
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
      // Realistic Concentric Micro Grooves
      const ringCount = 36;
      for (let i = 1; i < ringCount; i++) {
        const r = recordRadius * (0.42 + (i / ringCount) * 0.56);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      // Specular Conic Reflection Glare
      const conicCon = ctx.createLinearGradient(-recordRadius, -recordRadius, recordRadius, recordRadius);
      conicCon.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      conicCon.addColorStop(0.2, 'rgba(255, 255, 255, 0.03)');
      conicCon.addColorStop(0.5, 'rgba(0, 0, 0, 0.40)');
      conicCon.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
      conicCon.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
      ctx.fillStyle = conicCon;
      ctx.beginPath();
      ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Center Album Artwork Circular Label (~40% of disc diameter)
    const labelRadius = recordRadius * 0.40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
      // Fallback emerald indicator
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, labelRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // Restore clip

    // Metallic Inner Ring Framing the Artwork (Border & Bevel)
    const bevelGrad = ctx.createLinearGradient(-labelRadius, -labelRadius, labelRadius, labelRadius);
    bevelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.60)');
    bevelGrad.addColorStop(0.5, 'rgba(39, 39, 42, 0.80)');
    bevelGrad.addColorStop(1, 'rgba(255, 255, 255, 0.40)');
    ctx.strokeStyle = bevelGrad;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore(); // Restore disc rotation

    // Center Spindle Hole with metallic silver pin
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, labelRadius * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#444444';
    ctx.fill();

    // Static Soft Studio Spotlight Reflection Overlay
    const spotGrad = ctx.createLinearGradient(-recordRadius, -recordRadius, recordRadius, recordRadius);
    spotGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
    spotGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.22)');
    spotGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.arc(0, 0, recordRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Detailed Tonearm & Cartridge (Anchored top-right, smooth pivot onto record)
    ctx.save();
    const pivotX = recordRadius * 0.82;
    const pivotY = -recordRadius * 0.82;

    // Pivot angle: 0.03 rad (2deg) when playing, -0.31 rad (-18deg) when resting
    const targetArmAngle = isPlaying ? 0.03 : -0.31;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(targetArmAngle);

    // Tonearm drop shadow
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 8;

    // Heavy Metallic Pivot Base with Realistic Ring Layers
    const pivotGrad = ctx.createLinearGradient(-16, -16, 16, 16);
    pivotGrad.addColorStop(0, '#71717a');
    pivotGrad.addColorStop(0.5, '#3f3f46');
    pivotGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = pivotGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner Ring
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Aluminum Curved Tube Arm
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0, recordRadius * 0.45, -recordRadius * 0.45, recordRadius * 0.65, -recordRadius * 0.60, recordRadius * 1.10);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Tube Highlight
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0, recordRadius * 0.45, -recordRadius * 0.45, recordRadius * 0.65, -recordRadius * 0.60, recordRadius * 1.10);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Headshell Joint
    ctx.fillStyle = '#52525b';
    ctx.beginPath();
    ctx.arc(-recordRadius * 0.60, recordRadius * 1.10, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark Matte Headshell
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.rect(-recordRadius * 0.65, recordRadius * 1.12, 12, 18);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Red Cartridge Accent (#ef4444)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-recordRadius * 0.63, recordRadius * 1.20, 8, 10);

    // Micro Stylus / Needle Point
    ctx.fillStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.moveTo(-recordRadius * 0.61, recordRadius * 1.30);
    ctx.lineTo(-recordRadius * 0.57, recordRadius * 1.30);
    ctx.lineTo(-recordRadius * 0.59, recordRadius * 1.36);
    ctx.closePath();
    ctx.fill();

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

// Synchronized Lyric Engine (Karaoke Word-Level or Fade In/Out Line-Level)
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

  // Calculate smooth cross-fade opacity for lyric line entry & exit
  const lineDuration = Math.max(0.4, activeLine.endTime - activeLine.startTime);
  const elapsed = currentTime - activeLine.startTime;
  const remaining = activeLine.endTime - currentTime;
  const transitionDuration = Math.min(0.25, lineDuration * 0.25);

  const rawFadeIn = Math.max(0, Math.min(1, elapsed / transitionDuration));
  const rawFadeOut = Math.max(0, Math.min(1, remaining / transitionDuration));
  // Smoothstep easing
  const smoothIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
  const smoothOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
  const lineOpacity = Math.min(smoothIn, smoothOut);

  // Typography Settings
  const fontFamily = config.typographyOverride?.fontFamily || template.typography.fontFamily || 'Outfit';
  const fontWeight = config.typographyOverride?.fontWeight || '700';
  const baseFontSize = Math.max(16, Math.round(H * (isVertical ? 0.038 : 0.045) * (config.typographyOverride?.fontSizeScale || 1.0)));

  const lyricX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.72);
  const lyricY = pos ? pos.y * H : (isVertical ? H * 0.72 : H * 0.45);

  ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const lyricsSettings = useStore.getState().lyricsSettings;
  const isKaraoke = (config.animationStyle ? config.animationStyle === 'karaoke' : null) ??
    (config.animationOverride?.wordAnimation === 'karaoke') ??
    (lyricsSettings?.animationStyle === 'karaoke');

  const accentColor = config.typographyOverride?.activeWordColor || lyricsSettings?.color || template.typography.activeWordColor || '#fef08a';
  const inactiveColor = config.typographyOverride?.inactiveWordColor || template.typography.inactiveWordColor || 'rgba(255, 255, 255, 0.55)';
  const textColor = config.typographyOverride?.textColor || template.typography.textColor || '#ffffff';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;

  const maxLineWidth = isVertical ? W * 0.88 : W * 0.48;

  // Build timed words list
  interface TimedWord {
    word: string;
    startTime: number;
    endTime: number;
  }

  let timedWords: TimedWord[] = [];
  if (Array.isArray(activeLine.words) && activeLine.words.length > 0) {
    timedWords = activeLine.words.map((w: any, idx: number) => {
      const s = w.startTime ?? w.start ?? (activeLine.startTime + (idx / activeLine.words.length) * lineDuration);
      const e = w.endTime ?? w.end ?? (s + lineDuration / activeLine.words.length);
      return { word: w.word || '', startTime: s, endTime: e };
    });
  } else {
    const rawWords = activeLine.text.trim().split(/\s+/).filter(Boolean);
    const totalChars = rawWords.reduce((sum, w) => sum + Math.max(1, w.length), 0);
    let currStart = activeLine.startTime;
    timedWords = rawWords.map((word) => {
      const fraction = Math.max(1, word.length) / Math.max(1, totalChars);
      const dur = lineDuration * fraction;
      const s = currStart;
      const e = s + dur;
      currStart = e;
      return { word, startTime: s, endTime: e };
    });
  }

  // Partition timed words into lines that fit within maxLineWidth
  const spaceWidth = ctx.measureText(' ').width;
  const linesOfWords: TimedWord[][] = [];
  let currentSubline: TimedWord[] = [];
  let currentSublineWidth = 0;

  timedWords.forEach((tw) => {
    const wordWidth = ctx.measureText(tw.word).width;
    const addedWidth = currentSubline.length > 0 ? spaceWidth + wordWidth : wordWidth;

    if (currentSubline.length > 0 && currentSublineWidth + addedWidth > maxLineWidth) {
      linesOfWords.push(currentSubline);
      currentSubline = [tw];
      currentSublineWidth = wordWidth;
    } else {
      currentSubline.push(tw);
      currentSublineWidth += addedWidth;
    }
  });
  if (currentSubline.length > 0) {
    linesOfWords.push(currentSubline);
  }

  const lineGap = baseFontSize * 1.35;
  const totalHeight = (linesOfWords.length - 1) * lineGap;
  const startY = lyricY - totalHeight / 2;

  ctx.globalAlpha = lineOpacity;

  // Render previous line if visibleLineCount > 1
  const visibleCount = config.visibleLineCount || 1;
  if (visibleCount > 1 && activeIndex > 0) {
    const prevLine = lyricsLines[activeIndex - 1];
    ctx.save();
    ctx.globalAlpha = lineOpacity * 0.35;
    ctx.textAlign = 'center';
    ctx.fillStyle = textColor;
    ctx.fillText(truncateCanvasText(ctx, prevLine.text, maxLineWidth), lyricX, startY - lineGap);
    ctx.restore();
  }

  if (isKaraoke) {
    // Continuous Liquid Highlight Sweep Across Entire Lyric Line (No Word Snapping)
    linesOfWords.forEach((subline, lineIdx) => {
      const lineY = startY + lineIdx * lineGap;

      // 1. Measure all words in this subline
      const wordMetrics = subline.map((tw) => ({
        word: tw.word,
        width: ctx.measureText(tw.word).width,
        startTime: tw.startTime,
        endTime: tw.endTime
      }));

      // 2. Compute continuous liquid highlight sweep
      const sweep = computeContinuousLineSweep(wordMetrics, spaceWidth, currentTime);
      const startX = lyricX - sweep.totalWidth / 2;

      // 3. Draw Inactive Base Text (completely stable typography, zero shifts)
      ctx.save();
      ctx.fillStyle = inactiveColor;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      let curX = startX;
      for (let i = 0; i < wordMetrics.length; i++) {
        ctx.fillText(wordMetrics[i].word, curX, lineY);
        curX += wordMetrics[i].width + spaceWidth;
      }
      ctx.restore();

      // 4. Draw Active Text using Feathered Liquid Gradient Sweep (Apple Music / Spotify Style)
      if (sweep.highlightX > 0 && sweep.totalWidth > 0) {
        ctx.save();

        const totalW = sweep.totalWidth;
        const currentX = sweep.highlightX;
        // Soft feather window (12-18px) for liquid, anti-aliased font highlight
        const feather = Math.min(18, Math.max(8, baseFontSize * 0.35));

        const stop1 = Math.max(0, Math.min(0.999, (currentX - feather) / totalW));
        const stop2 = Math.max(0.001, Math.min(1, (currentX + feather) / totalW));

        const grad = ctx.createLinearGradient(startX, 0, startX + totalW, 0);
        if (stop1 > 0) {
          grad.addColorStop(0, accentColor);
        }
        grad.addColorStop(stop1, accentColor);
        grad.addColorStop(stop2, 'rgba(255, 255, 255, 0)');
        if (stop2 < 1) {
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        // Vibrant typography with glowing aura
        ctx.fillStyle = grad;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = sweep.highlightProgress < 1 ? 16 : 4;

        // Re-draw identical text at identical coordinates
        curX = startX;
        for (let i = 0; i < wordMetrics.length; i++) {
          ctx.fillText(wordMetrics[i].word, curX, lineY);
          curX += wordMetrics[i].width + spaceWidth;
        }

        ctx.restore();
      }
    });
  } else {
    // Fade In / Out Mode: Solid Typography with Smooth Line-Level Fade
    ctx.fillStyle = textColor;
    linesOfWords.forEach((subline, lineIdx) => {
      const lineY = startY + lineIdx * lineGap;
      const sublineText = subline.map(w => w.word).join(' ');
      const sublineWidth = ctx.measureText(sublineText).width;
      const startX = lyricX - sublineWidth / 2;
      ctx.fillText(sublineText, startX, lineY);
    });
  }

  // Render next line if visibleLineCount > 1
  if (visibleCount > 1 && activeIndex < lyricsLines.length - 1) {
    const nextLine = lyricsLines[activeIndex + 1];
    ctx.save();
    ctx.globalAlpha = lineOpacity * 0.35;
    ctx.textAlign = 'center';
    ctx.fillStyle = textColor;
    ctx.fillText(truncateCanvasText(ctx, nextLine.text, maxLineWidth), lyricX, startY + linesOfWords.length * lineGap);
    ctx.restore();
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
