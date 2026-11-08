import assert from 'node:assert/strict';
import { useMVStore, TimelineClip } from '../store/useMVStore';

const clip: TimelineClip = {
  id: 'manual-a', assetId: 'video-a', type: 'video',
  startTime: 0, endTime: 3, trimStart: 2, trimEnd: 5,
  zoom: 1.35, offsetX: 0.2, offsetY: -0.4,
  effect: 'none', transition: 'morph', transitionManuallyEdited: true,
  editOrigin: 'manual', manuallyEdited: true
};
const next: TimelineClip = {
  ...clip, id: 'manual-b', assetId: 'video-b',
  startTime: 3, endTime: 6, trimStart: 0, trimEnd: 3
};
const store = useMVStore.getState();
useMVStore.setState({ timelineClips: [clip, next], selectedClipId: clip.id, copiedTimelineClip: null });
const before = JSON.stringify([clip, next]);
store.copyTimelineClip(clip.id);
assert.equal(useMVStore.getState().copiedTimelineClip?.id, clip.id, 'Ctrl+C copies selected clip');
store.pasteTimelineClip(1);
let state = useMVStore.getState();
assert.equal(state.timelineClips.length, 3, 'Ctrl+V inserts exactly one clip');
const pasted = state.timelineClips.find(c => c.id === state.selectedClipId)!;
assert.equal(pasted.startTime, 6, 'Paste seeks the first free slot without overwriting neighbors');
assert.equal(pasted.trimStart, clip.trimStart, 'Paste preserves media in-point');
assert.equal(pasted.trimEnd, clip.trimEnd, 'Paste preserves media out-point');
assert.equal(pasted.zoom, clip.zoom, 'Paste preserves zoom and presentation');
assert.equal(pasted.transition, clip.transition, 'Paste preserves transitions');
assert.equal(pasted.locked, false, 'Paste is independently editable');
assert.equal(pasted.editOrigin, 'manual', 'Pasted clips are protected from Auto Edit regeneration');
assert.equal(JSON.stringify(state.timelineClips.filter(c => c.id === clip.id || c.id === next.id)), before,
  'Original timeline clips stay byte-for-byte unchanged');

store.duplicateTimelineClip(clip.id);
state = useMVStore.getState();
assert.equal(state.timelineClips.length, 4, 'Ctrl+D duplicates exactly once');
const duplicated = state.timelineClips.find(c => c.id === state.selectedClipId)!;
assert.equal(duplicated.startTime, 9, 'Duplicate finds the next available slot');
assert.equal(duplicated.trimStart, clip.trimStart);
assert.equal(duplicated.zoom, clip.zoom);
const ordered = [...state.timelineClips].sort((a, b) => a.startTime - b.startTime);
for (let i = 1; i < ordered.length; i++) {
  assert.ok(ordered[i].startTime >= ordered[i - 1].endTime - 0.001, 'Copied clips must not overlap');
}
console.log('MV clipboard regression tests passed');
