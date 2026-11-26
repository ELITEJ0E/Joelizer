import type { CanonicalProjectJson } from '../types/projectJson';
import { getMVTransitionLead, getMVTransitionPlaybackRate, getMVTransitionSourceTime } from './mvTransitionTiming';
export const clampMVVolume = (value = 1) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
export function clipAudioGain(clip: { audioMuted?: boolean; audioVolume?: number }): number {
  return clip.audioMuted !== false ? 0 : clampMVVolume(clip.audioVolume);
}
export function soundtrackAudioGain(audio: { muted?: boolean; volume?: number }): number {
  return audio.muted ? 0 : clampMVVolume(audio.volume);
}
export function requiresMVAudioMix(project: CanonicalProjectJson): boolean {
  return project.exportMode === 'music-video' && (soundtrackAudioGain(project.audio) !== 1 ||
    project.videoClips.some(c => c.type === 'video' && clipAudioGain(c) > 0));
}
export function mvClipAudioSegments(project: CanonicalProjectJson) {
  if (project.exportMode !== 'music-video') return [];
  const sorted = [...project.videoClips].sort((a,b) => a.startTime-b.startTime);
  return sorted.flatMap((clip, i) => {
    const gain = clipAudioGain(clip);
    const start = Math.max(clip.startTime, project.exportRange.start);
    const end = Math.min(clip.endTime, project.exportRange.end, sorted[i+1]?.startTime ?? Infinity);
    if (clip.type !== 'video' || gain <= 0 || end <= start) return [];
    const lead = getMVTransitionLead(sorted[i-1], clip, clip.transition, clip.transitionDuration);
    return [{ id: clip.id, url: clip.url, gain, offset: getMVTransitionSourceTime(clip, start, lead),
      rate: getMVTransitionPlaybackRate(clip, lead), start: start-project.exportRange.start,
      duration: end-start, trimEnd: clip.trimEnd }];
  });
}
