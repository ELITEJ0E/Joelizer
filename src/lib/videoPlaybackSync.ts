/**
 * Decode-friendly video synchronization.
 * Frequent currentTime writes restart decoding and cause visible jumps. For
 * small drift use modest playbackRate correction; only seek on clip entry or
 * when the source is seriously out of sync.
 */
export type VideoSyncDecision = { seekTo: number | null; playbackRate: number };

export function getVideoSyncDecision(input: {
  targetTime: number;
  actualTime: number;
  clipChanged: boolean;
  playing: boolean;
  seeking: boolean;
  /** Source playback rate set on the clip, independent of drift correction. */
  baseRate?: number;
}): VideoSyncDecision {
  const { targetTime, actualTime, clipChanged, playing, seeking } = input;
  const baseRate = Math.max(0.05, Math.min(8, input.baseRate ?? 1));
  if (!Number.isFinite(targetTime) || !Number.isFinite(actualTime)) {
    return { seekTo: null, playbackRate: baseRate };
  }
  const drift = targetTime - actualTime;
  // A clip decoder may have already been pre-seeked before the cut.
  // Never seek AGAIN at entry when its frame is already close to the desired
  // timestamp, or the seek visibly freezes playback at every edit boundary.
  if (clipChanged) {
    return {
      seekTo: Math.abs(drift) > 0.085 && !seeking ? Math.max(0, targetTime) : null,
      playbackRate: baseRate
    };
  }
  if (!playing && Math.abs(drift) > 0.04 && !seeking) {
    return { seekTo: Math.max(0, targetTime), playbackRate: baseRate };
  }
  // Never enqueue another seek while the prior request is still decoding.
  if (seeking) return { seekTo: null, playbackRate: baseRate };
  // Rate changes and timeline jumps must not display the old source time for
  // a full second before catching up. 0.35s is beyond ordinary A/V jitter.
  if (playing && Math.abs(drift) > (baseRate > 1.01 ? 0.35 : 0.55)) {
    return { seekTo: Math.max(0, targetTime), playbackRate: baseRate };
  }
  // Gradually converge, avoiding the visible discontinuity of repeated seeks.
  if (playing && Math.abs(drift) > 0.12) {
    return { seekTo: null, playbackRate: Math.max(0.05, Math.min(8, baseRate * Math.max(0.92, Math.min(1.08, 1 + drift * 0.12)))) };
  }
  return { seekTo: null, playbackRate: baseRate };
}
