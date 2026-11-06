import type { DAWClip } from '../types/daw';

/** Linear clip gain envelope shared by real-time playback and offline bounce. */
export function dawClipEnvelopeGain(clip: Pick<DAWClip, 'duration' | 'volume' | 'fadeIn' | 'fadeOut'>, timeInClip: number): number {
  const duration = Math.max(0, clip.duration);
  const at = Math.max(0, Math.min(duration, timeInClip));
  const fadeIn = Math.max(0, Math.min(duration, clip.fadeIn || 0));
  const fadeOut = Math.max(0, Math.min(duration, clip.fadeOut || 0));
  const up = fadeIn > 0 ? Math.min(1, at / fadeIn) : 1;
  const down = fadeOut > 0 ? Math.min(1, (duration - at) / fadeOut) : 1;
  return Math.max(0, (clip.volume ?? 1) * Math.min(up, down));
}

type GainAutomation = Pick<AudioParam, 'cancelScheduledValues' | 'setValueAtTime' | 'linearRampToValueAtTime'>;

/** Schedule only the curve segments intersecting the audible region. */
export function scheduleDawClipEnvelope(
  param: GainAutomation,
  clip: Pick<DAWClip, 'duration' | 'volume' | 'fadeIn' | 'fadeOut'>,
  when: number,
  clipOffset: number,
  renderDuration: number
): void {
  const offset = Math.max(0, clipOffset);
  const end = Math.min(clip.duration, offset + Math.max(0, renderDuration));
  if (end <= offset) return;
  const fadeIn = Math.max(0,Math.min(clip.duration,clip.fadeIn||0));
  const fadeOut = Math.max(0,Math.min(clip.duration,clip.fadeOut||0));
  // When fade-in and fade-out overlap, the intersection is a slope change.
  const crossing = fadeIn + fadeOut > clip.duration
    ? clip.duration * fadeIn / Math.max(.001,fadeIn+fadeOut)
    : null;
  const times = [
    offset, end, fadeIn, clip.duration-fadeOut,
    ...(crossing === null ? [] : [crossing])
  ].filter(time=>time>=offset && time<=end).sort((a,b)=>a-b);
  const unique = [...new Set(times)];
  param.cancelScheduledValues(when);
  param.setValueAtTime(dawClipEnvelopeGain(clip,offset),when);
  for (const time of unique) {
    if (time <= offset) continue;
    param.linearRampToValueAtTime(dawClipEnvelopeGain(clip,time),when+time-offset);
  }
}

export function dawSafePeakGain(peak: number,ceilingDb=-1): number {
  if(!Number.isFinite(peak)||peak<=0)return 1;
  const ceiling=Math.pow(10,Math.max(-12,Math.min(-.1,ceilingDb))/20);
  return Math.min(1,ceiling/peak);
}

/** Length of actual arranged audio, ignoring the DAW's editing canvas reserve. */
export function dawProjectAudioEnd(tracks: Array<{clips:Array<{startTime:number;duration:number}>}>): number {
  let end = 0;
  for (const track of tracks) for (const clip of track.clips) {
    if (Number.isFinite(clip.startTime) && Number.isFinite(clip.duration) && clip.duration > 0)
      end = Math.max(end, Math.max(0,clip.startTime) + clip.duration);
  }
  return end;
}
