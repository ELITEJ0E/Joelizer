export type AspectRatioType = '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3';
export type ExportResolutionType = '1080p' | '720p' | '360p';
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
}

export interface CanonicalBackgroundConfig {
  type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
  value: string;
  videoUrl?: string;
  blurAlbumArt: boolean;
}

export interface CanonicalArtworkConfig {
  style: 'none' | 'square' | 'circle' | 'vinyl' | 'cd' | 'vinyl-needle' | 'cd-needle' | 'glowing-disc' | 'floating' | 'framed' | 'background-blur';
  animation: 'none' | 'rotate' | 'scale-beat' | 'pulse' | 'float' | 'bounce';
  sizeScale: number;
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
}

export interface CanonicalVideoClip {
  id: string;
  assetId: string;
  url: string; // Object URL or http URL or base64 data URI
  mediaType: 'video' | 'image';
  startTime: number; // Timeline start in seconds
  endTime: number;   // Timeline end in seconds
  duration: number;  // Clip duration on timeline
  trimStart: number; // Internal trim start
  trimEnd: number;   // Internal trim end
  effect?: 'ken-burns-in' | 'ken-burns-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'none';
  transition?: 'cut' | 'fade' | 'dissolve' | 'glitch';
}

export interface CanonicalEffectsConfig {
  showGrain: boolean;
  showScanlines: boolean;
  glow: boolean;
  vignette: boolean;
}

export interface CanonicalProjectJson {
  version: '1.0';
  exportMode: ExportModeType;
  projectName: string;
  aspectRatio: AspectRatioType;
  fps: number; // 30
  resolution: ExportResolutionType;
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
  safeArea: boolean;
  templateId?: string;
}

// Utility to compute dimensions
export function getResolutionDimensions(
  aspectRatio: AspectRatioType,
  resolution: ExportResolutionType = '1080p'
): { width: number; height: number } {
  let baseHeight = 1080;
  if (resolution === '720p') baseHeight = 720;
  if (resolution === '360p') baseHeight = 360;

  switch (aspectRatio) {
    case '16:9':
      return { width: Math.round(baseHeight * (16 / 9)), height: baseHeight };
    case '9:16':
      return { width: Math.round(baseHeight * (9 / 16)), height: baseHeight };
    case '1:1':
      return { width: baseHeight, height: baseHeight };
    case '4:5':
      return { width: Math.round(baseHeight * (4 / 5)), height: baseHeight };
    case '3:4':
      return { width: Math.round(baseHeight * (3 / 4)), height: baseHeight };
    case '4:3':
      return { width: Math.round(baseHeight * (4 / 3)), height: baseHeight };
    default:
      return { width: Math.round(baseHeight * (16 / 9)), height: baseHeight };
  }
}
