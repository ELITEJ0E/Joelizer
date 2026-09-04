import { AspectRatioType } from '../types/projectJson';

export interface NormalizedElementPosition {
  x: number;
  y: number;
}

export interface LyricsElementPositions {
  artwork: NormalizedElementPosition;
  meta: NormalizedElementPosition;
  lyrics: NormalizedElementPosition;
  visualizer: NormalizedElementPosition;
  watermark: NormalizedElementPosition;
}

const LANDSCAPE: LyricsElementPositions = {
  artwork: { x: 0.28, y: 0.40 },
  meta: { x: 0.28, y: 0.72 },
  lyrics: { x: 0.72, y: 0.45 },
  visualizer: { x: 0.72, y: 0.68 },
  watermark: { x: 0.72, y: 0.88 }
};

const PORTRAIT: LyricsElementPositions = {
  meta: { x: 0.50, y: 0.11 },
  artwork: { x: 0.50, y: 0.39 },
  lyrics: { x: 0.50, y: 0.70 },
  visualizer: { x: 0.50, y: 0.83 },
  watermark: { x: 0.50, y: 0.93 }
};

const SQUARE: LyricsElementPositions = {
  meta: { x: 0.50, y: 0.10 },
  artwork: { x: 0.50, y: 0.36 },
  lyrics: { x: 0.50, y: 0.73 },
  visualizer: { x: 0.50, y: 0.85 },
  watermark: { x: 0.50, y: 0.93 }
};

const FOUR_THREE: LyricsElementPositions = {
  artwork: { x: 0.30, y: 0.40 },
  meta: { x: 0.30, y: 0.73 },
  lyrics: { x: 0.70, y: 0.46 },
  visualizer: { x: 0.70, y: 0.69 },
  watermark: { x: 0.70, y: 0.89 }
};

export function getDefaultLyricsElementPositions(aspectRatio: AspectRatioType | string = '16:9'): LyricsElementPositions {
  if (aspectRatio === '1:1') return SQUARE;
  if (aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio === '4:5') return PORTRAIT;
  if (aspectRatio === '4:3') return FOUR_THREE;
  return LANDSCAPE;
}

export function clampNormalizedPosition(position: NormalizedElementPosition): NormalizedElementPosition {
  return {
    x: Math.max(0.05, Math.min(0.95, position.x)),
    y: Math.max(0.05, Math.min(0.95, position.y))
  };
}
