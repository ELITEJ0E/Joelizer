import type { LyricsVideoState } from '../store/useLyricsVideoStore';
/** MV preview and both exporters must resolve the same chosen lyric style.
 * Main lyric settings apply to ordinary MV clips; a selected Kinetic mode
 * intentionally takes precedence for the word-by-word effect.
 */
export function resolveMVLyricsStyle(
  mainStyle: 'karaoke' | 'fade' | 'none' | undefined,
  videoStyle: LyricsVideoState['animationStyle']
): LyricsVideoState['animationStyle'] {
  return videoStyle === 'kinetic' ? 'kinetic' : (mainStyle ?? videoStyle);
}
