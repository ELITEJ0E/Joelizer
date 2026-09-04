import { AspectRatio } from '../store/useStore';

export interface ElementPos {
  x: number; // Normalized 0..1 ratio
  y: number; // Normalized 0..1 ratio
}

export interface CanvasElementPositions {
  artwork: ElementPos;
  meta: ElementPos;
  lyrics: ElementPos;
  visualizer: ElementPos;
  watermark: ElementPos;
}

// 16:9 Landscape - Artwork and metadata on left, lyrics and visualizer on right
export const DEFAULT_POSITIONS_16_9: CanvasElementPositions = {
  artwork: { x: 0.28, y: 0.40 },
  meta: { x: 0.28, y: 0.72 },
  lyrics: { x: 0.72, y: 0.44 },
  visualizer: { x: 0.72, y: 0.68 },
  watermark: { x: 0.72, y: 0.88 },
};

// 4:3 Landscape - Classic landscape with slightly wider margins
export const DEFAULT_POSITIONS_4_3: CanvasElementPositions = {
  artwork: { x: 0.30, y: 0.38 },
  meta: { x: 0.30, y: 0.72 },
  lyrics: { x: 0.70, y: 0.44 },
  visualizer: { x: 0.70, y: 0.68 },
  watermark: { x: 0.70, y: 0.88 },
};

// 1:1 Square - Centered balanced composition
export const DEFAULT_POSITIONS_1_1: CanvasElementPositions = {
  meta: { x: 0.50, y: 0.11 },
  artwork: { x: 0.50, y: 0.36 },
  lyrics: { x: 0.50, y: 0.72 },
  visualizer: { x: 0.50, y: 0.84 },
  watermark: { x: 0.50, y: 0.93 },
};

// 9:16 Portrait - Vertical mobile standard
export const DEFAULT_POSITIONS_9_16: CanvasElementPositions = {
  meta: { x: 0.50, y: 0.12 },
  artwork: { x: 0.50, y: 0.38 },
  lyrics: { x: 0.50, y: 0.70 },
  visualizer: { x: 0.50, y: 0.83 },
  watermark: { x: 0.50, y: 0.93 },
};

// 4:5 Portrait - Instagram portrait feed
export const DEFAULT_POSITIONS_4_5: CanvasElementPositions = {
  meta: { x: 0.50, y: 0.11 },
  artwork: { x: 0.50, y: 0.36 },
  lyrics: { x: 0.50, y: 0.69 },
  visualizer: { x: 0.50, y: 0.82 },
  watermark: { x: 0.50, y: 0.92 },
};

// 3:4 Portrait - Standard tablet portrait
export const DEFAULT_POSITIONS_3_4: CanvasElementPositions = {
  meta: { x: 0.50, y: 0.11 },
  artwork: { x: 0.50, y: 0.36 },
  lyrics: { x: 0.50, y: 0.68 },
  visualizer: { x: 0.50, y: 0.82 },
  watermark: { x: 0.50, y: 0.92 },
};

/**
 * Returns the default normalized layout positions for a given aspect ratio
 */
export function getDefaultPositions(aspectRatio: AspectRatio | string = '16:9'): CanvasElementPositions {
  switch (aspectRatio) {
    case '9:16':
      return { ...DEFAULT_POSITIONS_9_16 };
    case '4:5':
      return { ...DEFAULT_POSITIONS_4_5 };
    case '3:4':
      return { ...DEFAULT_POSITIONS_3_4 };
    case '1:1':
      return { ...DEFAULT_POSITIONS_1_1 };
    case '4:3':
      return { ...DEFAULT_POSITIONS_4_3 };
    case '16:9':
    default:
      return { ...DEFAULT_POSITIONS_16_9 };
  }
}

/**
 * Clamps normalized coordinates to safe visible canvas range (0.05 to 0.95)
 */
export function clampNormalizedPos(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(0.05, Math.min(0.95, pos.x)),
    y: Math.max(0.05, Math.min(0.95, pos.y)),
  };
}

/**
 * Calculates adaptive element pixel sizes based on short-edge of the canvas
 */
export function getAdaptiveElementSizes(
  aspectRatio: AspectRatio | string,
  width: number,
  height: number,
  artScale: number = 1.0
) {
  const isPortrait = height > width;
  const minDim = Math.min(width, height);

  // Artwork diameter based on short edge
  let artworkSizeRatio = 0.42;
  if (aspectRatio === '1:1') {
    artworkSizeRatio = 0.38;
  } else if (isPortrait) {
    artworkSizeRatio = aspectRatio === '9:16' ? 0.42 : 0.40;
  } else {
    artworkSizeRatio = 0.44;
  }

  const artworkSize = Math.round(minDim * artworkSizeRatio * artScale);

  // Lyrics font size
  const baseFontSize = Math.max(16, Math.round(minDim * (isPortrait ? 0.048 : 0.045)));

  // Meta (title/artist) font size
  const metaTitleFontSize = Math.max(14, Math.round(minDim * (isPortrait ? 0.038 : 0.035)));
  const metaArtistFontSize = Math.round(metaTitleFontSize * 0.78);

  return {
    artworkSize,
    baseFontSize,
    metaTitleFontSize,
    metaArtistFontSize,
    isPortrait,
  };
}
