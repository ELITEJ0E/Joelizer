/** One source clip may occupy a different amount of timeline time when retimed. */
export const MIN_CLIP_SPEED = 0.1;
export const MAX_CLIP_SPEED = 8;

export interface SpeedTimedClip {
  id: string;
  startTime: number;
  endTime: number;
  trimStart: number;
  trimEnd: number;
  speed?: number;
  locked?: boolean;
}

export function getClipSpeed(clip: Pick<SpeedTimedClip, 'speed'>): number {
  return Number.isFinite(clip.speed) && (clip.speed ?? 0) > 0
    ? Math.max(MIN_CLIP_SPEED, Math.min(MAX_CLIP_SPEED, clip.speed!)) : 1;
}

export function clipSourceTime(clip: SpeedTimedClip, timelineTime: number, leadSeconds = 0): number {
  return clip.trimStart + (timelineTime - clip.startTime + leadSeconds) * getClipSpeed(clip);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Retimes one clip while preserving its full source in/out points.
 * Shorter clips leave an editable gap. Longer clips push subsequent unlocked
 * clips only as far as necessary to prevent collisions; locked clips are barriers.
 */
export function retimeClips<T extends SpeedTimedClip>(
  clips: T[], id: string, requestedSpeed: number, minDuration = 0.1
): { clips: T[]; applied: boolean; error?: string } {
  const selected = clips.find(clip => clip.id === id);
  if (!selected || selected.locked) return { clips, applied: false, error: 'Unlock the clip before changing speed.' };
  if (!Number.isFinite(requestedSpeed) || requestedSpeed <= 0) {
    return { clips, applied: false, error: 'Enter a speed greater than zero.' };
  }

  const oldDuration = selected.endTime - selected.startTime;
  const sourceDuration = selected.trimEnd - selected.trimStart > 0
    ? selected.trimEnd - selected.trimStart : oldDuration * getClipSpeed(selected);
  const speed = Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED,
    Math.min(requestedSpeed, sourceDuration / minDuration)));
  const newEnd = round(selected.startTime + sourceDuration / speed);
  const retimed = { ...selected, speed: round(speed), endTime: newEnd } as T;
  const ordered = [...clips].sort((a, b) => a.startTime - b.startTime);
  const updated = new Map<string, T>([[id, retimed]]);
  let previousEnd = newEnd;
  for (const next of ordered) {
    if (next.id === id || next.startTime < selected.endTime - 0.0001) continue;
    if (next.startTime < previousEnd - 0.0001) {
      if (next.locked) return { clips, applied: false, error: 'A locked clip is blocking this slower speed.' };
      const shift = round(previousEnd - next.startTime);
      updated.set(next.id, { ...next, startTime: round(next.startTime + shift), endTime: round(next.endTime + shift) });
      previousEnd = round(next.endTime + shift);
    } else {
      previousEnd = next.endTime;
    }
  }

  return { clips: clips.map(c => updated.get(c.id) ?? c), applied: true };
}
