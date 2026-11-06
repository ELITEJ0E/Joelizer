import type { DAWClip, DAWTrack } from '../types/daw';
import { splitClipFades } from './dawAudioProcessing';

export interface ArrangementMarker { id: string; name: string; time: number; color: string }
export interface ArrangementSnapshot { tracks: DAWTrack[]; markers: ArrangementMarker[] }
export const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value, min)));

export function secondsPerBar(bpm: number, signature: string): number {
  const [numerator, denominator] = signature.split('/').map(Number);
  return 60 / clamp(bpm, 40, 280) * (numerator > 0 ? numerator : 4) * 4 / (denominator > 0 ? denominator : 4);
}

export function gridSeconds(bpm: number, division: string): number {
  const denominator = Number(division.split('/')[1]);
  return division === 'off' || !(denominator > 0) ? 0 : 60 / clamp(bpm, 40, 280) * 4 / denominator;
}

export function snapTime(time: number, bpm: number, division: string, enabled = true): number {
  const step = enabled ? gridSeconds(bpm, division) : 0;
  return Math.max(0, step ? Math.round(finite(time) / step) * step : finite(time));
}

export function normalizeMarkers(value: unknown): ArrangementMarker[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 500).flatMap(marker => {
    if (!marker || typeof marker.id !== 'string' || ids.has(marker.id) || !Number.isFinite(marker.time)) return [];
    ids.add(marker.id);
    return [{ id: marker.id, name: String(marker.name || 'Marker').slice(0, 80), time: Math.max(0, marker.time),
      color: /^#[a-f0-9]{6}$/i.test(marker.color) ? marker.color : '#a78bfa' }];
  }).sort((a, b) => a.time - b.time);
}

// Keep timing edits inside the original source. Fades never extend past a clip.
export function normalizeClipEdit(clip: DAWClip, updates: Partial<DAWClip>): DAWClip {
  const merged = { ...clip, ...updates, id: clip.id, trackId: clip.trackId };
  merged.startTime = Math.max(0, finite(merged.startTime));
  merged.duration = Math.max(.01, finite(merged.duration, clip.duration));
  merged.sourceStart = Math.max(0, finite(merged.sourceStart));
  merged.sourceEnd = merged.sourceStart + merged.duration;
  merged.volume = clamp(merged.volume, 0, 1.5);
  merged.fadeIn = clamp(merged.fadeIn, 0, merged.duration);
  merged.fadeOut = clamp(merged.fadeOut, 0, merged.duration);
  if (updates.fadeIn !== undefined || updates.fadeOut !== undefined) merged.fadeEnvelope = undefined;
  else if (clip.fadeEnvelope) {
    const offset = clip.fadeEnvelope.offset + merged.sourceStart - clip.sourceStart;
    merged.fadeEnvelope = offset >= 0 && offset + merged.duration <= clip.fadeEnvelope.duration + .000001
      ? { ...clip.fadeEnvelope, offset } : undefined;
    if (merged.fadeEnvelope) Object.assign(merged, splitClipFades(merged, merged.duration).left);
  }
  return merged;
}
