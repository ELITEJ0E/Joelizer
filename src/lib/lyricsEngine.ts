import { useStore, LyricLine } from '../store/useStore';
import {
  LyricVideoTemplate,
  ArtworkStyle,
  ArtworkAnimation,
  LineAnimation,
  WordAnimation
} from './lyricsTemplates';
import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { CanvasElementPositions, getDefaultPositions, ElementPos } from './lyricsLayout';
import { renderVisualizer } from './renderers';
import { computeContinuousLineSweep, TimedWordMetric } from './karaokeSweep';

export interface LyricsVideoMetadata {
  title: string;
  artist: string;
  albumArtUrl?: string;
}

export interface RenderLyricsVideoOptions {
  template: LyricVideoTemplate;
  aspectRatio: string;
  animationStyle?: string;
  visibleLineCount?: number;
  customBackground?: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    value: string;
    videoUrl?: string;
    imageElement?: HTMLImageElement | null;
    videoElement?: HTMLVideoElement | null;
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
    intensity?: number;
  };
  elementPositions?: CanvasElementPositions;
  watermarkText?: string;
  showSafeArea?: boolean;
  showBackgroundVisualizer?: boolean;
}

// Media cache to avoid reconstructing elements every frame
const imageCache = new Map<string, HTMLImageElement>();
const videoCache = new Map<string, HTMLVideoElement>();

function getOrLoadImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    imageCache.set(url, img);
  }
  return img;
}

function getOrLoadVideo(url?: string): HTMLVideoElement | null {
  if (!url) return null;
  let vid = videoCache.get(url);
  if (!vid) {
    vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.play().catch(() => {});
    videoCache.set(url, vid);
  }
  return vid;
}

// Draw image covering bounds (like CSS object-fit: cover)
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number
) {
  if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const destRatio = dWidth / dHeight;
  const srcRatio = nw / nh;
  let sx = 0;
  let sy = 0;
  let sw = nw;
  let sh = nh;

  if (srcRatio > destRatio) {
    sw = nh * destRatio;
    sx = (nw - sw) / 2;
  } else {
    sh = nw / destRatio;
    sy = (nh - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

// Truncate text with ellipsis if it exceeds max width
function truncateWithEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(trimmed + '…').width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + '…';
}

// Render Artwork (Vinyl, CD, Neon Vinyl & Needle, Square, Circle)
function renderArtwork(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  isPlaying: boolean,
  albumArtImg: HTMLImageElement | null,
  metadata: LyricsVideoMetadata,
  style: ArtworkStyle,
  sizeScale: number,
  template: LyricVideoTemplate,
  pos?: ElementPos,
  audioFrequencyData?: Uint8Array | null
) {
  if (style === 'none' || style === 'background-blur') return;

  ctx.save();
  const isPortrait = H > W;
  let beatPulse = 1;

  if (isPlaying && audioFrequencyData && audioFrequencyData.length > 0) {
    let bassSum = 0;
    const bassCount = Math.min(10, audioFrequencyData.length);
    for (let i = 0; i < bassCount; i++) bassSum += audioFrequencyData[i];
    beatPulse = 1 + (bassSum / bassCount / 255) * 0.055;
  }

  const baseSize = Math.min(W, H) * (isPortrait ? 0.42 : 0.35) * sizeScale * beatPulse;
  const posX = pos ? pos.x * W : (isPortrait ? W / 2 : W * 0.28);
  const posY = pos ? pos.y * H : H * 0.4;
  const rotationAngle = (currentTime / 1.8) * Math.PI * 2;

  ctx.translate(posX, posY);

  if (style === 'vinyl' || style === 'vinyl-needle' || style === 'cd' || style === 'cd-needle') {
    const radius = baseSize / 2;
    const isCD = style === 'cd' || style === 'cd-needle';
    const hasNeedle = style === 'vinyl-needle' || style === 'cd-needle';

    // Audio reactive outer perimeter glow
    if (audioFrequencyData && audioFrequencyData.length > 0) {
      ctx.save();
      const numSpokes = 64;
      const innerR = radius * 0.98;
      const maxSpokeLen = radius * 0.32;
      const themeColor = useStore.getState().visualizerSettings?.color || '#00e676';
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = Math.max(1.8, radius * 0.015);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = themeColor;
      ctx.beginPath();
      for (let i = 0; i < numSpokes; i++) {
        const val = audioFrequencyData[i % audioFrequencyData.length] / 255;
        const len = maxSpokeLen * Math.pow(val, 1.2);
        const ang = (i / numSpokes) * Math.PI * 2 + rotationAngle * 0.25;
        const x1 = Math.cos(ang) * innerR;
        const y1 = Math.sin(ang) * innerR;
        const x2 = Math.cos(ang) * (innerR + len);
        const y2 = Math.sin(ang) * (innerR + len);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Outer drop shadow
    ctx.shadowBlur = 35;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;

    if (isCD) {
      const grad = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius);
      grad.addColorStop(0, 'rgba(40, 40, 48, 0.85)');
      grad.addColorStop(0.7, 'rgba(20, 20, 26, 0.90)');
      grad.addColorStop(1, 'rgba(10, 10, 14, 0.95)');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
      grad.addColorStop(0, '#111111');
      grad.addColorStop(0.5, '#292929');
      grad.addColorStop(1, '#050505');
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isCD ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.90)';
    ctx.lineWidth = isCD ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating disc surface
    ctx.save();
    ctx.rotate(rotationAngle);

    if (isCD) {
      const iridescent = ctx.createLinearGradient(-radius, -radius, radius, radius);
      iridescent.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      iridescent.addColorStop(0.3, 'rgba(200, 220, 255, 0.08)');
      iridescent.addColorStop(0.5, 'rgba(255, 200, 220, 0.12)');
      iridescent.addColorStop(0.8, 'rgba(200, 255, 220, 0.08)');
      iridescent.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
      ctx.fillStyle = iridescent;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Concentric vinyl grooves
      for (let k = 1; k < 36; k++) {
        const rGroove = radius * (0.42 + (k / 36) * 0.56);
        ctx.beginPath();
        ctx.arc(0, 0, rGroove, 0, Math.PI * 2);
        ctx.strokeStyle = k % 2 === 0 ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      // Angular glare highlight
      const glare = ctx.createLinearGradient(-radius, -radius, radius, radius);
      glare.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      glare.addColorStop(0.2, 'rgba(255, 255, 255, 0.03)');
      glare.addColorStop(0.5, 'rgba(0, 0, 0, 0.40)');
      glare.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
      glare.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
      ctx.fillStyle = glare;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center circular album art label
    const labelRadius = radius * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.clip();

    if (albumArtImg && albumArtImg.complete && albumArtImg.naturalWidth > 0) {
      drawImageCover(ctx, albumArtImg, -labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-labelRadius, -labelRadius, labelRadius * 2, labelRadius * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, labelRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Center label ring border
    const rimGrad = ctx.createLinearGradient(-labelRadius, -labelRadius, labelRadius, labelRadius);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.60)');
    rimGrad.addColorStop(0.5, 'rgba(39, 39, 42, 0.80)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.40)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, labelRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Spindle Hole
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

    // Surface sheen sweep
    const sheen = ctx.createLinearGradient(-radius, -radius, radius, radius);
    sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.22)');
    sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Turntable Tonearm / Needle
    if (hasNeedle) {
      ctx.save();
      const armBaseX = radius * 0.82;
      const armBaseY = -radius * 0.82;
      const armAngle = isPlaying ? 0.03 : -0.31;

      ctx.translate(armBaseX, armBaseY);
      ctx.rotate(armAngle);
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 8;

      // Arm base pivot
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

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Curved tone arm tube
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0, radius * 0.45, -radius * 0.45, radius * 0.65, -radius * 0.6, radius * 1.1);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0, radius * 0.45, -radius * 0.45, radius * 0.65, -radius * 0.6, radius * 1.1);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Headshell and stylus cartridge
      ctx.fillStyle = '#52525b';
      ctx.beginPath();
      ctx.arc(-radius * 0.6, radius * 1.1, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.rect(-radius * 0.65, radius * 1.12, 12, 18);
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Red Cartridge
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-radius * 0.63, radius * 1.2, 8, 10);

      // Needle stylus tip
      ctx.fillStyle = '#d4d4d8';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.61, radius * 1.3);
      ctx.lineTo(-radius * 0.57, radius * 1.3);
      ctx.lineTo(-radius * 0.59, radius * 1.36);
      ctx.closePath();
      ctx.fill();

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
    }
  } else if (style === 'glowing-disc' || style === 'glowing-disc-needle') {
    const discRadius = (baseSize / 2) * 0.94;
    const ringRadius = (baseSize / 2) * 1.05;
    const hasNeedle = style === 'glowing-disc-needle';

    ctx.save();
    // Glowing neon outer ring
    ctx.shadowBlur = 24;
    ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
    const ringGrad = ctx.createLinearGradient(-ringRadius, -ringRadius, ringRadius, ringRadius);
    ringGrad.addColorStop(0, '#06b6d4');
    ringGrad.addColorStop(0.5, '#a855f7');
    ringGrad.addColorStop(1, '#ec4899');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner dark circular backdrop
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius - 2, 0, Math.PI * 2);
    const innerBackdrop = ctx.createRadialGradient(0, 0, 0, 0, 0, ringRadius);
    innerBackdrop.addColorStop(0, '#151624');
    innerBackdrop.addColorStop(0.7, '#0c0d16');
    innerBackdrop.addColorStop(1, '#07080e');
    ctx.fillStyle = innerBackdrop;
    ctx.fill();

    // Rotating vinyl disc inside
    ctx.save();
    ctx.rotate(rotationAngle);
    ctx.shadowBlur = 25;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';

    const vinylGrad = ctx.createRadialGradient(0, 0, discRadius * 0.1, 0, 0, discRadius);
    vinylGrad.addColorStop(0, '#111111');
    vinylGrad.addColorStop(0.5, '#292929');
    vinylGrad.addColorStop(1, '#050505');
    ctx.fillStyle = vinylGrad;
    ctx.beginPath();
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let rad = discRadius * 0.44; rad < discRadius * 0.94; rad += 4.5) {
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Subtle sheen
    const sheen = ctx.createLinearGradient(-discRadius, -discRadius, discRadius, discRadius);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    sheen.addColorStop(0.5, 'transparent');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0.10)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
    ctx.fill();

    // Center circular album artwork
    const labelR = discRadius * 0.38;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.clip();

    if (albumArtImg && albumArtImg.complete && albumArtImg.naturalWidth > 0) {
      drawImageCover(ctx, albumArtImg, -labelR, -labelR, labelR * 2, labelR * 2);
    } else {
      const fallbackGrad = ctx.createLinearGradient(-labelR, -labelR, labelR, labelR);
      fallbackGrad.addColorStop(0, '#ea580c');
      fallbackGrad.addColorStop(1, '#f97316');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(-labelR, -labelR, labelR * 2, labelR * 2);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.stroke();

    // Spindle Hole
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, 0, labelR * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore(); // disc rotation
    ctx.restore(); // neon ring

    // Turntable Tonearm for Neon Vinyl & Needle
    if (hasNeedle) {
      ctx.save();
      const armX = discRadius * 0.9;
      const armY = -discRadius * 0.85;

      ctx.translate(armX, armY);
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';

      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0, discRadius * 0.45, -discRadius * 0.45, discRadius * 0.65, -discRadius * 0.6, discRadius * 1.1);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(0, discRadius * 0.45, -discRadius * 0.45, discRadius * 0.65, -discRadius * 0.6, discRadius * 1.1);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#52525b';
      ctx.beginPath();
      ctx.arc(-discRadius * 0.6, discRadius * 1.1, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.rect(-discRadius * 0.65, discRadius * 1.12, 12, 18);
      ctx.fill();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-discRadius * 0.63, discRadius * 1.2, 8, 10);

      ctx.fillStyle = '#d4d4d8';
      ctx.beginPath();
      ctx.moveTo(-discRadius * 0.61, discRadius * 1.3);
      ctx.lineTo(-discRadius * 0.57, discRadius * 1.3);
      ctx.lineTo(-discRadius * 0.59, discRadius * 1.36);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
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
    }
  } else if (style === 'circle') {
    const radius = baseSize / 2;
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    if (albumArtImg && albumArtImg.complete && albumArtImg.naturalWidth > 0) {
      drawImageCover(ctx, albumArtImg, -radius, -radius, baseSize, baseSize);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-radius, -radius, baseSize, baseSize);
    }
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Standard Rounded Square or Floating Card
    const half = baseSize / 2;
    const cornerRadius = baseSize * 0.2;
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#18181b';

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-half, -half, baseSize, baseSize, cornerRadius);
      ctx.fill();
    } else {
      ctx.fillRect(-half, -half, baseSize, baseSize);
    }

    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-half, -half, baseSize, baseSize, cornerRadius);
    } else {
      ctx.rect(-half, -half, baseSize, baseSize);
    }
    ctx.clip();

    if (albumArtImg && albumArtImg.complete && albumArtImg.naturalWidth > 0) {
      drawImageCover(ctx, albumArtImg, -half, -half, baseSize, baseSize);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-half, -half, baseSize, baseSize);
    }
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-half, -half, baseSize, baseSize, cornerRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(-half, -half, baseSize, baseSize);
    }
  }

  ctx.restore();
}

// Render Song Metadata (Title and Artist)
function renderSongMeta(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  metadata: LyricsVideoMetadata,
  template: LyricVideoTemplate,
  pos?: ElementPos
) {
  ctx.save();
  const isPortrait = H > W;
  const fontSize = Math.max(14, Math.round(H * (isPortrait ? 0.026 : 0.028)));

  const posX = pos ? pos.x * W : (isPortrait ? W / 2 : W * 0.28);
  const posY = pos ? pos.y * H : (isPortrait ? H * 0.12 : H * 0.72);
  const maxWidth = isPortrait ? W * 0.85 : W * 0.4;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (metadata.title) {
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    const titleText = truncateWithEllipsis(ctx, metadata.title, maxWidth);
    ctx.fillText(titleText, posX, posY);
  }

  if (metadata.artist) {
    const artistSize = Math.round(fontSize * 0.78);
    ctx.font = `500 ${artistSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.shadowBlur = 4;
    const artistText = truncateWithEllipsis(ctx, metadata.artist, maxWidth);
    ctx.fillText(artistText, posX, posY + fontSize * 1.35);
  }

  ctx.restore();
}

// Render Synchronized Lyrics with Liquid Karaoke Sweep & Fade
function renderLyrics(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: LyricLine[],
  options: RenderLyricsVideoOptions,
  template: LyricVideoTemplate,
  pos?: ElementPos
) {
  if (!lyricsLines || lyricsLines.length === 0) return;

  ctx.save();
  const isPortrait = H > W;
  const visibleCount = options.visibleLineCount || 1;

  // Find active line or upcoming line
  let activeIndex = lyricsLines.findIndex(
    (l) => currentTime >= l.startTime && currentTime <= l.endTime
  );

  if (activeIndex === -1) {
    const nextIdx = lyricsLines.findIndex((l) => l.startTime > currentTime);
    if (nextIdx !== -1) {
      // Allow a smooth 0.3s trail fade-out for the previous line before shifting active index
      if (nextIdx > 0 && currentTime < lyricsLines[nextIdx - 1].endTime + 0.3) {
        activeIndex = nextIdx - 1;
      } else {
        activeIndex = nextIdx;
      }
    } else {
      activeIndex = lyricsLines.length - 1;
    }
  }

  const activeLine = activeIndex !== -1 ? lyricsLines[activeIndex] : null;
  if (!activeLine) {
    ctx.restore();
    return;
  }

  // Cross-fade opacity computation for the active line ONLY
  const lineDuration = Math.max(0.4, activeLine.endTime - activeLine.startTime);
  const elapsed = currentTime - activeLine.startTime;
  const remaining = activeLine.endTime - currentTime;
  const transitionDuration = Math.min(0.28, Math.max(0.15, lineDuration * 0.2));

  let activeLineOpacity = 1.0;
  if (visibleCount === 1) {
    const rawFadeIn = Math.max(0, Math.min(1, (currentTime - (activeLine.startTime - 0.25)) / 0.25));
    const rawFadeOut = Math.max(0, Math.min(1, remaining / transitionDuration));
    const smoothIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
    const smoothOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
    activeLineOpacity = Math.min(smoothIn, smoothOut);
  } else {
    // Multi-line / 2-line mode:
    // When waiting before line start: steady preview opacity (0.55)
    // When line starts singing: smooth transition up to 1.0
    // When line is finishing: ONLY this active line fades out smoothly (1.0 -> 0)
    if (currentTime < activeLine.startTime) {
      activeLineOpacity = 0.55;
    } else if (currentTime > activeLine.endTime) {
      const trail = Math.max(0, Math.min(1, (activeLine.endTime + 0.3 - currentTime) / 0.3));
      activeLineOpacity = trail * trail;
    } else {
      const rawFadeIn = Math.max(0, Math.min(1, elapsed / transitionDuration));
      const rawFadeOut = Math.max(0, Math.min(1, remaining / transitionDuration));
      const smoothIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
      const smoothOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
      activeLineOpacity = (0.55 + 0.45 * smoothIn) * smoothOut;
    }
  }

  // Typography settings
  const fontFamily =
    options.typographyOverride?.fontFamily || template.typography.fontFamily || 'Outfit';
  const fontWeight = options.typographyOverride?.fontWeight || '700';
  const fontSizeScale = options.typographyOverride?.fontSizeScale || 1;
  const fontSize = Math.max(16, Math.round(H * (isPortrait ? 0.038 : 0.045) * fontSizeScale));

  const posX = pos ? pos.x * W : (isPortrait ? W / 2 : W * 0.72);
  const posY = pos ? pos.y * H : (isPortrait ? H * 0.72 : H * 0.45);

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const isKaraoke =
    (options.animationStyle ? options.animationStyle === 'karaoke' : null) ??
    (options.animationOverride?.wordAnimation === 'karaoke') ??
    (useStore.getState().lyricsSettings?.animationStyle === 'karaoke');

  const activeWordColor =
    options.typographyOverride?.activeWordColor ||
    useStore.getState().lyricsSettings?.color ||
    template.typography.activeWordColor ||
    '#fef08a';

  const inactiveWordColor =
    options.typographyOverride?.inactiveWordColor ||
    template.typography.inactiveWordColor ||
    'rgba(255, 255, 255, 0.55)';

  const textColor =
    options.typographyOverride?.textColor || template.typography.textColor || '#ffffff';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;

  const maxLineWidth = isPortrait ? W * 0.88 : W * 0.48;

  // Build timed words list
  let timedWords: { word: string; startTime: number; endTime: number }[] = [];
  if (Array.isArray(activeLine.words) && activeLine.words.length > 0) {
    timedWords = activeLine.words.map((w, idx) => {
      const s =
        w.startTime ??
        w.start ??
        activeLine.startTime + (idx / activeLine.words!.length) * lineDuration;
      const e = w.endTime ?? w.end ?? s + lineDuration / activeLine.words!.length;
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

  // Partition timed words into sublines matching canvas layout
  const spaceWidth = ctx.measureText(' ').width;
  const sublines: { word: string; startTime: number; endTime: number }[][] = [];
  let currentSubline: { word: string; startTime: number; endTime: number }[] = [];
  let currentSublineWidth = 0;

  timedWords.forEach((tw) => {
    const wordWidth = ctx.measureText(tw.word).width;
    const addedWidth = currentSubline.length > 0 ? spaceWidth + wordWidth : wordWidth;

    if (currentSubline.length > 0 && currentSublineWidth + addedWidth > maxLineWidth) {
      sublines.push(currentSubline);
      currentSubline = [tw];
      currentSublineWidth = wordWidth;
    } else {
      currentSubline.push(tw);
      currentSublineWidth += addedWidth;
    }
  });
  if (currentSubline.length > 0) {
    sublines.push(currentSubline);
  }

  const lineHeight = fontSize * 1.35;

  // Compute vertical layout based on visibleCount
  let startY = posY - ((sublines.length - 1) * lineHeight) / 2;
  if (visibleCount === 2) {
    const hasNextLine = activeIndex < lyricsLines.length - 1;
    const totalLines = sublines.length + (hasNextLine ? 1 : 0);
    startY = posY - ((totalLines - 1) * lineHeight) / 2;
  } else if (visibleCount > 2) {
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < lyricsLines.length - 1;
    const totalLines =
      sublines.length +
      (hasPrev ? (visibleCount >= 5 && activeIndex > 1 ? 2 : 1) : 0) +
      (hasNext ? (visibleCount >= 5 && activeIndex < lyricsLines.length - 2 ? 2 : 1) : 0);
    const prevCount = hasPrev ? (visibleCount >= 5 && activeIndex > 1 ? 2 : 1) : 0;
    startY = posY - ((totalLines - 1) * lineHeight) / 2 + prevCount * lineHeight;
  }

  // 1. Previous line(s) preview ONLY when visibleLineCount > 2
  if (visibleCount > 2) {
    if (visibleCount >= 5 && activeIndex > 1) {
      const prev2Line = lyricsLines[activeIndex - 2];
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.textAlign = 'center';
      ctx.fillStyle = inactiveWordColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(truncateWithEllipsis(ctx, prev2Line.text, maxLineWidth), posX, startY - 2 * lineHeight);
      ctx.restore();
    }
    if (activeIndex > 0) {
      const prevLine = lyricsLines[activeIndex - 1];
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.textAlign = 'center';
      ctx.fillStyle = inactiveWordColor;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.fillText(truncateWithEllipsis(ctx, prevLine.text, maxLineWidth), posX, startY - lineHeight);
      ctx.restore();
    }
  }

  // 2. Active line rendering (Line 1 in 2-line mode) with individual opacity
  if (activeLineOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = activeLineOpacity;

    if (isKaraoke) {
      sublines.forEach((sublineWords, sIdx) => {
        const lineY = startY + sIdx * lineHeight;
        const wordMetrics: TimedWordMetric[] = sublineWords.map((w) => ({
          word: w.word,
          width: ctx.measureText(w.word).width,
          startTime: w.startTime,
          endTime: w.endTime
        }));

        const sweepResult = computeContinuousLineSweep(wordMetrics, spaceWidth, currentTime);
        const sublineStartX = posX - sweepResult.totalWidth / 2;

        // Inactive base text pass
        ctx.save();
        ctx.fillStyle = inactiveWordColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        let curX = sublineStartX;
        for (let i = 0; i < wordMetrics.length; i++) {
          ctx.fillText(wordMetrics[i].word, curX, lineY);
          curX += wordMetrics[i].width + spaceWidth;
        }
        ctx.restore();

        // Liquid highlight sweep pass
        if (sweepResult.highlightX > 0 && sweepResult.totalWidth > 0) {
          ctx.save();
          const totalW = sweepResult.totalWidth;
          const hx = sweepResult.highlightX;
          const spread = Math.min(18, Math.max(8, fontSize * 0.35));
          const gradStart = Math.max(0, Math.min(0.999, (hx - spread) / totalW));
          const gradEnd = Math.max(gradStart + 0.001, Math.min(1, (hx + spread) / totalW));

          const grad = ctx.createLinearGradient(sublineStartX, 0, sublineStartX + totalW, 0);
          if (gradStart > 0) grad.addColorStop(0, activeWordColor);
          grad.addColorStop(gradStart, activeWordColor);
          grad.addColorStop(gradEnd, 'rgba(255, 255, 255, 0)');
          if (gradEnd < 1) grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = grad;
          ctx.shadowColor = activeWordColor;
          ctx.shadowBlur = sweepResult.highlightProgress < 1 ? 16 : 4;

          let curHx = sublineStartX;
          for (let i = 0; i < wordMetrics.length; i++) {
            ctx.fillText(wordMetrics[i].word, curHx, lineY);
            curHx += wordMetrics[i].width + spaceWidth;
          }
          ctx.restore();
        }
      });
    } else {
      // Smooth crossfade mode
      ctx.fillStyle = textColor;
      sublines.forEach((sublineWords, sIdx) => {
        const lineY = startY + sIdx * lineHeight;
        const fullText = sublineWords.map((w) => w.word).join(' ');
        const textW = ctx.measureText(fullText).width;
        const textX = posX - textW / 2;
        ctx.fillText(fullText, textX, lineY);
      });
    }

    ctx.restore();
  }

  // 3. Next line preview (Line 2 in 2-line mode, steady opacity independent of active line)
  if (visibleCount > 1 && activeIndex < lyricsLines.length - 1) {
    const nextLine = lyricsLines[activeIndex + 1];
    ctx.save();
    // Steady, calm opacity that does not fade out when Line 1 fades
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'center';
    ctx.fillStyle = inactiveWordColor;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText(
      truncateWithEllipsis(ctx, nextLine.text, maxLineWidth),
      posX,
      startY + sublines.length * lineHeight
    );
    ctx.restore();

    // Additional upcoming line in 5-line mode
    if (visibleCount >= 5 && activeIndex < lyricsLines.length - 2) {
      const next2Line = lyricsLines[activeIndex + 2];
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.textAlign = 'center';
      ctx.fillStyle = inactiveWordColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(
        truncateWithEllipsis(ctx, next2Line.text, maxLineWidth),
        posX,
        startY + (sublines.length + 1) * lineHeight
      );
      ctx.restore();
    }
  }

  ctx.restore();
}

// Render Audio Spectrum Bars / Visualizer Dots
export function renderSegmentDots(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pos?: { x: number; y: number },
  audioFrequencyData?: Uint8Array | null,
  audioTimeData?: Uint8Array | null
) {
  ctx.save();
  const isVertical = H > W;

  const posX = pos ? pos.x * W : (isVertical ? W / 2 : W * 0.72);
  const posY = pos ? pos.y * H : (isVertical ? H * 0.84 : H * 0.68);

  const visSettings = useStore.getState().visualizerSettings;
  const themeColor = visSettings?.color || '#00e676';

  if (
    visSettings &&
    audioFrequencyData &&
    audioFrequencyData.length > 0 &&
    audioTimeData
  ) {
    const boxW = Math.max(300, W * 0.35);
    const boxH = Math.max(100, H * 0.15);

    ctx.translate(posX - boxW / 2, posY - boxH / 2);
    renderVisualizer(ctx, audioFrequencyData, audioTimeData, visSettings, boxW, boxH);
  } else if (audioFrequencyData && audioFrequencyData.length > 0) {
    // Compact spectrum bars
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
    // Passive dot pattern fallback
    const dotCount = 8;
    const dotRadius = Math.max(1.5, Math.round(H * 0.0035));
    const dotGap = Math.max(8, Math.round(H * 0.015));
    const totalW = 7 * dotGap;
    const startX = posX - totalW / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < dotCount; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * dotGap, posY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Render Watermark credit text
export function renderWatermarkText(
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
export function renderSafeAreaGuide(ctx: CanvasRenderingContext2D, W: number, H: number) {
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

/**
 * Main Frame Rendering Engine for Lyrics Videos and Vinyl Scenes
 */
export function renderLyricsVideoFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: LyricLine[],
  metadata: LyricsVideoMetadata,
  options: RenderLyricsVideoOptions,
  audioFrequencyData?: Uint8Array | null,
  audioTimeData?: Uint8Array | null
) {
  const { template } = options;
  const isPlaying = useStore.getState().isPlaying;

  // Background Settings Resolution
  const bgType = options.customBackground?.type || template.defaultBackground.type;
  const bgValue = options.customBackground?.value || template.defaultBackground.value;
  const bgVideoUrl = options.customBackground?.videoUrl;

  const albumArtImg = getOrLoadImage(metadata.albumArtUrl);
  const videoElem = bgVideoUrl ? getOrLoadVideo(bgVideoUrl) : null;

  // 1. Draw Canvas Background
  drawBackgroundCanvas(
    ctx,
    W,
    H,
    currentTime,
    {
      type: bgType,
      value: bgValue,
      videoElement: videoElem,
      imageElement: albumArtImg
    },
    albumArtImg,
    audioFrequencyData
  );

  // Background Full Visualizer layer if enabled (only when in MV Studio if explicitly needed)
  const visSettings = useStore.getState().visualizerSettings;
  if (
    options.showBackgroundVisualizer &&
    visSettings &&
    (visSettings.style === 'particles' ||
      visSettings.style === 'waveform' ||
      visSettings.style === 'radial' ||
      visSettings.style === 'bars') &&
    audioFrequencyData &&
    audioTimeData
  ) {
    ctx.save();
    renderVisualizer(ctx, audioFrequencyData, audioTimeData, visSettings, W, H);
    ctx.restore();
  }

  // 2. Resolve Element Positions
  const defaultPositions = getDefaultPositions(options.aspectRatio, template.id);
  const artworkPos = options.elementPositions?.artwork || defaultPositions.artwork;
  const metaPos = options.elementPositions?.meta || defaultPositions.meta;
  const lyricsPos = options.elementPositions?.lyrics || defaultPositions.lyrics;
  const visualizerPos = options.elementPositions?.visualizer || defaultPositions.visualizer;
  const watermarkPos = options.elementPositions?.watermark || defaultPositions.watermark;

  const artworkStyle = options.artworkOverride?.style || template.layout.artworkType;
  const artworkSizeScale = options.artworkOverride?.sizeScale || 1;

  // 3. Render Artwork (Vinyl record, CD, Neon Turntable, etc.)
  if (artworkStyle !== 'none' && artworkStyle !== 'background-blur') {
    renderArtwork(
      ctx,
      W,
      H,
      currentTime,
      isPlaying,
      albumArtImg,
      metadata,
      artworkStyle,
      artworkSizeScale,
      template,
      artworkPos,
      audioFrequencyData
    );
  }

  // 4. Render Song Title & Artist
  if (template.layout.showSongTitle || template.layout.showArtist) {
    renderSongMeta(ctx, W, H, metadata, template, metaPos);
  }

  // 5. Render Lyrics
  renderLyrics(ctx, W, H, currentTime, lyricsLines, options, template, lyricsPos);

  // 6. Render Segment Dots / Visualizer (if not glowing-disc)
  if (!(artworkStyle === 'glowing-disc' || artworkStyle === 'glowing-disc-needle')) {
    const activeVis = useStore.getState().visualizerSettings;
    if (activeVis && activeVis.style !== 'particles') {
      renderSegmentDots(ctx, W, H, visualizerPos, audioFrequencyData, audioTimeData);
    }
  }

  // 7. Render Watermark Text
  renderWatermarkText(ctx, W, H, options.watermarkText || 'Made with Joelizer', watermarkPos);

  // 8. Safe Area Guide (optional overlay)
  if (options.showSafeArea) {
    renderSafeAreaGuide(ctx, W, H);
  }
}
