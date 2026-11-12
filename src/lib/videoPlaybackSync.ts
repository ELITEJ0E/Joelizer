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
}): VideoSyncDecision {
  const { targetTime, actualTime, clipChanged, playing, seeking } = input;
  if (!Number.isFinite(targetTime) || !Number.isFinite(actualTime)) {
    return { seekTo: null, playbackRate: 1 };
  }
  const drift = targetTime - actualTime;
  // A clip decoder may have already been pre-seeked before the cut.
  // Never seek AGAIN at entry when its frame is already close to the desired
  // timestamp, or the seek visibly freezes playback at every edit boundary.
  if (clipChanged) {
    return {
      seekTo: Math.abs(drift) > 0.085 && !seeking ? Math.max(0, targetTime) : null,
      playbackRate: 1
    };
  }
  if (!playing && Math.abs(drift) > 0.04 && !seeking) {
    return { seekTo: Math.max(0, targetTime), playbackRate: 1 };
  }
  // Never enqueue another seek while the prior request is still decoding.
  if (seeking) return { seekTo: null, playbackRate: 1 };
  if (playing && Math.abs(drift) > 1) {
    return { seekTo: Math.max(0, targetTime), playbackRate: 1 };
  }
  // Gradually converge, avoiding the visible discontinuity of repeated seeks.
  if (playing && Math.abs(drift) > 0.12) {
    return { seekTo: null, playbackRate: Math.max(0.92, Math.min(1.08, 1 + drift * 0.12)) };
  }
  return { seekTo: null, playbackRate: 1 };
}
