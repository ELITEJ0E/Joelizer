import type { ExportQualityType } from '../../types/projectJson';

/** A target bitrate that scales with delivered pixels, frame-rate and quality.
 * This determines how much detail the encoder retains; increasing it cannot
 * restore information already missing in source media.
 */
export function getExportVideoBitrate(
  width: number, height: number, fps: number,
  quality: ExportQualityType = 'high'
): number {
  const bitsPerPixel = quality === 'maximum' ? 0.24
    : quality === 'high' ? 0.16 : 0.10;
  const ceiling = quality === 'maximum' ? 90_000_000
    : quality === 'high' ? 65_000_000 : 40_000_000;
  return Math.min(ceiling, Math.max(4_000_000,
    Math.round(width * height * fps * bitsPerPixel)));
}
export function getExportCrf(quality: ExportQualityType | undefined): number {
  return quality === 'maximum' ? 14 : quality === 'balanced' ? 20 : 16;
}
