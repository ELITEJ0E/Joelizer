/** Pure atomic multi-clip translation. No individual collision resolver is used,
 * so relative spacing and source trims are preserved while dragging a group.
 */
export interface GroupMovableClip {
  id: string;
  startTime: number;
  endTime: number;
  locked?: boolean;
  trimStart?: number;
  trimEnd?: number;
}
export interface GroupMoveResult<T> {
  clips: T[];
  delta: number;
  applied: boolean;
}

export function moveMVClipGroup<T extends GroupMovableClip>(
  clips: readonly T[],
  selectedIds: readonly string[],
  requestedDelta: number,
  timelineEnd: number
): GroupMoveResult<T> {
  const ids = new Set(selectedIds);
  const selected = clips.filter(clip => ids.has(clip.id));
  if (!Number.isFinite(requestedDelta) || selected.length === 0 ||
      selected.some(clip => clip.locked) || !Number.isFinite(timelineEnd)) {
    return { clips: [...clips], delta: 0, applied: false };
  }
  const others = clips.filter(clip => !ids.has(clip.id));
  let minDelta = Math.max(...selected.map(clip => -clip.startTime));
  let maxDelta = Math.min(...selected.map(clip => timelineEnd - clip.endTime));
  for (const moving of selected) {
    for (const other of others) {
      // A clip outside the group acts as a barrier; gaps inside the group stay intact.
      if (other.startTime >= moving.endTime - 0.0001) {
        maxDelta = Math.min(maxDelta, other.startTime - moving.endTime);
      } else if (other.endTime <= moving.startTime + 0.0001) {
        minDelta = Math.max(minDelta, other.endTime - moving.startTime);
      } else {
        return { clips: [...clips], delta: 0, applied: false };
      }
    }
  }
  if (minDelta > maxDelta) return { clips: [...clips], delta: 0, applied: false };
  const delta = Math.round(Math.max(minDelta, Math.min(maxDelta, requestedDelta)) * 1000) / 1000;
  if (Math.abs(delta) < 0.0005) return { clips: [...clips], delta: 0, applied: false };
  return {
    clips: clips.map(clip => ids.has(clip.id) ? {
      ...clip,
      startTime: Math.round((clip.startTime + delta) * 1000) / 1000,
      endTime: Math.round((clip.endTime + delta) * 1000) / 1000,
      editOrigin: 'manual',
      manuallyEdited: true
    } : clip),
    delta,
    applied: true
  };
}

/** Mouse marquee selects clips whose visible timeline interval intersects its span. */
export function getMarqueeMVClipIds<T extends GroupMovableClip>(
  clips: readonly T[], from: number, to: number
): string[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return clips.filter(clip => !clip.locked && clip.endTime > start && clip.startTime < end)
    .map(clip => clip.id);
}
