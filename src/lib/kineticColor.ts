/** Color treatment is independent of timing or pop animation. */
export type KineticPalette = 'solid' | 'neon' | 'sunset' | 'candy' | 'rainbow';

const PALETTES: Record<Exclude<KineticPalette, 'solid'>, readonly string[]> = {
  neon: ['#00f5d4', '#fb37ff', '#ffe45e', '#60a5fa'],
  sunset: ['#ff5d73', '#ffbe0b', '#ff6d00', '#e879f9'],
  candy: ['#ff69b4', '#a78bfa', '#67e8f9', '#f9a8d4'],
  rainbow: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']
};

/** Invalid/legacy values cannot inject a CSS color expression. */
export function normalizedSolidKineticColor(color: string | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
}

/** Stable across preview, offline canvas and Remotion server export. */
export function kineticWordColor(
  palette: KineticPalette | undefined,
  solidColor: string | undefined,
  lineIndex: number,
  wordIndex: number,
  sublineIndex: number
): string {
  if (!palette || palette === 'solid' || !(palette in PALETTES)) {
    return normalizedSolidKineticColor(solidColor);
  }
  const colors = PALETTES[palette];
  return colors[((lineIndex + wordIndex + sublineIndex) % colors.length + colors.length) % colors.length];
}

export function kineticGlowEnabled(palette: KineticPalette | undefined, explicit?: boolean): boolean {
  return explicit ?? (palette !== undefined && palette !== 'solid');
}
