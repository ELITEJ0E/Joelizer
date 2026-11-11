import type { OverlaySettings } from '../lib/overlayEffects';
export type AspectRatioType = '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3';
export type ExportResolutionType = '2160p' | '1440p' | '1080p' | '720p' | '360p';
export type ExportQualityType = 'balanced' | 'high' | 'maximum';
export type ExportModeType = 'lyrics-video' | 'music-video';

export interface CanonicalWordTiming {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

export interface CanonicalLyricLine {
  id: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
  secondaryText?: string;
  words?: CanonicalWordTiming[];
}

export interface CanonicalAudioTrack {
  url: string | null;
  audioDataUri?: string | null; // For local user audio files embedded safely
  title: string;
  artist: string;
  albumArt: string | null;
  duration: number; // seconds
  bpm?: number;
  key?: string;
}

export interface CanonicalLyricsConfig {
  lines: CanonicalLyricLine[];
  fontFamily: string;
  fontWeight: string;
  fontSizeScale: number;
  textColor: string;
  activeWordColor: string;
  inactiveWordColor: string;
  glowColor: string;
  showContainerPill: boolean;
  pillBgColor: string;
  animationStyle: 'karaoke' | 'fade' | 'slide-up' | 'pop';
  position?: 'bottom' | 'center' | 'top';
  showBackgroundBox?: boolean;
  visibleLineCount?: 1 | 2 | 5;
  bilingualEnabled?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeEasing?: 'linear' | 'smooth' | 'ease';
}

export interface CanonicalBackgroundConfig {
  type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
  value: string;
  videoUrl?: string;
  fit?: 'cover' | 'contain';
  zoom?: number;
  heightScale?: number;
  offsetX?: number;
  offsetY?: number;
  blurAlbumArt: boolean;
  blur?: number;
  dim?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  vignette?: number;
}

export interface CanonicalArtworkConfig {
  style: 'none' | 'square' | 'circle' | 'vinyl' | 'cd' | 'vinyl-needle' | 'cd-needle' | 'glowing-disc' | 'glowing-disc-needle' | 'floating' | 'framed' | 'background-blur';
  animation: 'none' | 'rotate' | 'scale-beat' | 'pulse' | 'float' | 'bounce';
  sizeScale: number;
  enabled?: boolean;
}

export interface CanonicalVisualizerConfig {
  style: 'bars' | 'waveform' | 'radial' | 'particles' | 'kaleidoscope' | 'orb';
  color: string;
  sensitivity: number;
  smoothing: number;
  segments: number;
  hitResponse: number;
  glitchIntensity: number;
  shakeIntensity: number;
  showGrain: boolean;
  showScanlines: boolean;
  scale?: number;
  enabled?: boolean;
}

export interface CanonicalVideoClip {
  id: string;
  assetId: string;
  url: string; // Object URL or http URL or base64 data URI
  type: 'video' | 'image' | 'vinyl-lyrics' | 'visualizer';
  startTime: number; // Timeline start in seconds
  endTime: number;   // Timeline end in seconds
  duration: number;  // Clip duration on timeline
  trimStart: number; // Internal trim start
  trimEnd: number;   // Internal trim end
  fit?: 'cover' | 'contain';
  zoom?: number;
  heightScale?: number;
  offsetX?: number;
  offsetY?: number;
  effect?: 'ken-burns-in' | 'ken-burns-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'none';
  transition?: 'cut' | 'fade' | 'dissolve' | 'glitch' | 'crossfade' | 'morph' | 'slide' | 'zoom';
  transitionDuration?: number;
}

export interface CanonicalEffectsConfig {
  showGrain: boolean;
  showScanlines: boolean;
  glow: boolean;
  vignette: boolean;
}

export interface CanonicalElementPositions {
  artwork?: { x: number; y: number };
  meta?: { x: number; y: number };
  lyrics?: { x: number; y: number };
  visualizer?: { x: number; y: number };
  watermark?: { x: number; y: number };
}

export interface CanonicalProjectJson {
  version: '1.0';
  exportMode: ExportModeType;
  projectName: string;
  aspectRatio: AspectRatioType;
  fps: number; // 30
  resolution: ExportResolutionType;
  /** Controls encoding quality, separate from pixel dimensions. */
  exportQuality?: ExportQualityType;
  width: number;
  height: number;
  exportRange: {
    start: number;
    end: number;
    duration: number;
  };
  audio: CanonicalAudioTrack;
  lyrics: CanonicalLyricsConfig;
  background: CanonicalBackgroundConfig;
  artwork: CanonicalArtworkConfig;
  visualizer: CanonicalVisualizerConfig;
  videoClips: CanonicalVideoClip[];
  effects: CanonicalEffectsConfig;
  overlayEffects?: OverlaySettings;
  elementPositions?: CanonicalElementPositions;
  watermarkText?: string;
  safeArea: boolean;
  templateId?: string;
  showArtwork?: boolean;
  showVisualizer?: boolean;
  /** Circular audio ring around vinyl/CD artwork, independent of the movable spectrum. */
  showVinylRing?: boolean;
  /** Export-frame audio energy, derived from the actual soundtrack by the server.
   * Indexed by composition frame (relative to exportRange.start), not wall time. */
  visualizerAudioLevels?: number[];
  showLyrics?: boolean;
  showMeta?: boolean;
}

// Utility to compute dimensions
export function getResolutionDimensions(
  aspectRatio: AspectRatioType,
  resolution: ExportResolutionType = '1080p'
): { width: number; height: number } {
  let base = 1080;
  if (resolution === '2160p') base = 2160;
  if (resolution === '1440p') base = 1440;
  if (resolution === '720p') base = 720;
  if (resolution === '360p') base = 360;

  let width: number;
  let height: number;

  switch (aspectRatio) {
    case '16:9':
      width = Math.round(base * (16 / 9));
      height = base;
      break;
    case '9:16':
      width = base;
      height = Math.round(base * (16 / 9));
      break;
    case '1:1':
      width = base;
      height = base;
      break;
    case '4:5':
      width = base;
      height = Math.round(base * (5 / 4));
      break;
    case '3:4':
      width = base;
      height = Math.round(base * (4 / 3));
      break;
    case '4:3':
      width = Math.round(base * (4 / 3));
      height = base;
      break;
    default:
      width = Math.round(base * (16 / 9));
      height = base;
      break;
  }

  // Ensure even dimensions required by H.264 4:2:0 encoding
  return {
    width: Math.max(2, Math.round(width / 2) * 2),
    height: Math.max(2, Math.round(height / 2) * 2)
  };
}
