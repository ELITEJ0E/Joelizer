/** Shared timestamp interpretation for Joelizer's persistent audio player.
 * LRC and Lyrics Video use unscaled source-file seconds; rate only affects speed.
 * MV Studio retains its existing stretched video-timeline timecode mapping.
 */
export type PlaybackTab = 'lrc' | 'lyrics' | 'mv-studio' | 'audio-lab' | 'youtube-audio' | 'daw';

export function playbackRateForTab(tab: PlaybackTab, lrcRate: number, mvRate: number): number {
  const selected = tab === 'lrc' ? lrcRate : tab === 'mv-studio' ? mvRate : 1;
  return Number.isFinite(selected) ? Math.max(0.1, Math.min(8, selected)) : 1;
}

export function sourceTimeToTimelineTime(sourceSeconds: number, tab: PlaybackTab, mvRate: number): number {
  return tab === 'mv-studio'
    ? sourceSeconds / playbackRateForTab('mv-studio', 1, mvRate)
    : sourceSeconds;
}
