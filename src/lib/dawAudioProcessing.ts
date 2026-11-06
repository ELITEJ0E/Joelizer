import type { DAWClip, DAWTrack } from '../types/daw';

const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
export const clampGain = (value: number) => Math.max(0, Math.min(1.5, finite(value, 1)));

/** Fade lengths share the clip duration; overlap is scaled into a triangle. */
export function normalizedClipFades(clip: Pick<DAWClip, 'duration' | 'fadeIn' | 'fadeOut'>) {
  const duration = Math.max(0, finite(clip.duration));
  let fadeIn = Math.max(0, Math.min(duration, finite(clip.fadeIn)));
  let fadeOut = Math.max(0, Math.min(duration, finite(clip.fadeOut)));
  if (fadeIn + fadeOut > duration) {
    const scale = duration / (fadeIn + fadeOut);
    fadeIn *= scale;
    fadeOut *= scale;
  }
  return { duration, fadeIn, fadeOut };
}

function envelopeShape(clip: DAWClip) {
  return { ...normalizedClipFades(clip.fadeEnvelope ?? clip), offset: Math.max(0, finite(clip.fadeEnvelope?.offset)) };
}

export function getClipEnvelope(clip: DAWClip, elapsed: number) {
  const { duration, fadeIn, fadeOut, offset } = envelopeShape(clip);
  // Split/trim arithmetic can exceed the original endpoint by rounding alone.
  if (elapsed < 0 || elapsed > clip.duration || elapsed + offset > duration + 0.000001) return 0;
  const time = Math.min(duration, elapsed + offset);
  const attack = fadeIn > 0 ? Math.min(1, time / fadeIn) : 1;
  const release = fadeOut > 0 ? Math.min(1, (duration - time) / fadeOut) : 1;
  return clampGain(clip.volume ?? 1) * Math.max(0, Math.min(attack, release));
}

/** Shared by real-time playback and offline bounce, including seeks mid-fade. */
export function scheduleClipEnvelope(param: AudioParam, clip: DAWClip, when: number, elapsed = 0) {
  const { duration, fadeIn, fadeOut, offset } = envelopeShape(clip);
  param.setValueAtTime(getClipEnvelope(clip, elapsed), when);
  const breakpoints = [...new Set([fadeIn - offset, duration - fadeOut - offset, clip.duration])]
    .filter(time => time > elapsed && time <= clip.duration).sort((a, b) => a - b);
  for (const time of breakpoints) {
    param.linearRampToValueAtTime(getClipEnvelope(clip, time), when + time - elapsed);
  }
}

/** Splitting is an envelope view, never a second attack or release at the seam. */
export function splitClipFades(clip: DAWClip, leftDuration: number): { left: Partial<DAWClip>; right: Partial<DAWClip> } {
  const shape = envelopeShape(clip);
  const split = Math.max(0, Math.min(clip.duration, finite(leftDuration)));
  const view = (offset: number, duration: number): Partial<DAWClip> => ({
    fadeEnvelope: { ...shape, offset },
    fadeIn: Math.max(0, Math.min(duration, shape.fadeIn - offset)),
    fadeOut: Math.max(0, Math.min(duration, offset + duration - (shape.duration - shape.fadeOut))),
  });
  return { left: view(shape.offset, split), right: view(shape.offset + split, clip.duration - split) };
}

export interface TrackEQNodes {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
}

export function createTrackEQ(context: BaseAudioContext): TrackEQNodes {
  const low = context.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 120;
  const mid = context.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.7;
  const high = context.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = 6000;
  low.connect(mid); mid.connect(high);
  return { low, mid, high };
}

export function applyTrackEQ(nodes: TrackEQNodes, eq: DAWTrack['eq'], when: number, smooth = false) {
  for (const band of ['low', 'mid', 'high'] as const) {
    const value = eq?.bypass ? 0 : Math.max(-12, Math.min(12, finite(eq?.[band])));
    if (smooth) nodes[band].gain.setTargetAtTime(value, when, 0.02);
    else {
      nodes[band].gain.cancelScheduledValues(when);
      nodes[band].gain.setValueAtTime(value, when);
    }
  }
}
