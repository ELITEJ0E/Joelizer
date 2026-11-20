import assert from 'node:assert/strict';
import { clipSourceTime, getClipSpeed, retimeClips } from '../lib/clipSpeed';
import { useMVStore, TimelineClip } from '../store/useMVStore';

const baseline = [
  { id: 'a', startTime: 0, endTime: 4, trimStart: 10, trimEnd: 14 },
  { id: 'b', startTime: 4, endTime: 7, trimStart: 3, trimEnd: 6 },
  { id: 'c', startTime: 9, endTime: 11, trimStart: 0, trimEnd: 2 }
];
assert.equal(getClipSpeed({ speed: undefined }), 1, 'legacy clips play at 1×');
assert.equal(clipSourceTime(baseline[0], 2), 12);

const fast = retimeClips(baseline, 'a', 2);
assert.equal(fast.applied, true);
assert.equal(fast.clips[0].endTime, 2, '2× must halve timeline occupancy');
assert.equal(fast.clips[1].startTime, 4, 'speeding up leaves a gap without moving subsequent clips');
assert.equal(clipSourceTime(fast.clips[0], 1.5), 13, 'preview/export use source seconds');
assert.equal(fast.clips[0].trimEnd, 14, 'changing speed never drops source content');

const slow = retimeClips(baseline, 'a', 0.5);
assert.equal(slow.applied, true);
assert.equal(slow.clips[0].endTime, 8);
assert.equal(slow.clips[1].startTime, 8, 'only overlapping followers move');
assert.equal(slow.clips[1].endTime, 11);
assert.equal(slow.clips[2].startTime, 11, 'ripple preserves order without overlap');
assert.equal(clipSourceTime(slow.clips[0], 2), 11);

const restored = retimeClips(slow.clips, 'a', 1);
assert.equal(restored.clips[0].endTime, 4, 'speed adjustments preserve in/out points across edits');

const lockBarrier = retimeClips([{ ...baseline[0] }, { ...baseline[1], locked: true }], 'a', 0.5);
assert.equal(lockBarrier.applied, false, 'locked clips cannot be silently moved');
assert.equal(lockBarrier.clips[0].endTime, 4, 'failed edit leaves original timeline intact');
assert.equal(retimeClips(baseline, 'a', Number.NaN).applied, false);
assert.equal(retimeClips([{ ...baseline[0], locked: true }], 'a', 2).applied, false);

const mvClips: TimelineClip[] = baseline.map((clip, index) => ({ ...clip, assetId: `asset-${index}`, type: 'video' }));
useMVStore.setState({ timelineClips: mvClips });
const mv = useMVStore.getState();
assert.equal(mv.setClipSpeed('a', 2).applied, true);
assert.equal(useMVStore.getState().timelineClips[0].speed, 2);
assert.equal(useMVStore.getState().timelineClips[0].manuallyEdited, true);
mv.splitTimelineClip('a', 1);
const split = useMVStore.getState().timelineClips;
assert.equal(split[0].trimEnd, 12, 'splitting at 1s of 2× footage cuts 2 source seconds');
assert.equal(split[1].trimStart, 12);
assert.equal(split[1].speed, 2, 'both halves keep the chosen speed');
mv.updateTimelineClip(split[1].id, { endTime: 2.5 });
assert.equal(useMVStore.getState().timelineClips[1].trimEnd, 15,
  'trimming one timeline second at 2× consumes two source seconds');
mv.setSoundtrackSpeed(0.5);
assert.equal(useMVStore.getState().soundtrackSpeed, 0.5, 'the MV soundtrack has an independent speed control');
mv.setSoundtrackSpeed(20);
assert.equal(useMVStore.getState().soundtrackSpeed, 8, 'soundtrack speed is safely bounded');
mv.setSoundtrackSpeed(1);

console.log('clip speed/retiming tests passed');
