import assert from 'node:assert/strict';
import { getMarqueeMVClipIds, moveMVClipGroup } from '../lib/mvGroupMove';

const clips = [
  { id: 'a', startTime: 0, endTime: 2, trimStart: 10, trimEnd: 12 },
  { id: 'b', startTime: 2, endTime: 4, trimStart: 7, trimEnd: 9 },
  { id: 'c', startTime: 7, endTime: 9, trimStart: 0, trimEnd: 2 },
  { id: 'locked', startTime: 12, endTime: 14, locked: true, trimStart: 1, trimEnd: 3 }
];
const group = moveMVClipGroup(clips, ['a', 'b'], 2, 15);
assert.equal(group.applied, true);
assert.equal(group.delta, 2);
assert.deepEqual(group.clips.slice(0, 2).map(c => [c.startTime, c.endTime]), [[2, 4], [4, 6]]);
assert.equal(group.clips[0].trimStart, 10, 'group move never changes a source trim');
assert.equal(group.clips[1].trimEnd, 9);
assert.equal(group.clips[2], clips[2], 'unselected clips must not move');
const barrier = moveMVClipGroup(clips, ['a', 'b'], 5, 15);
assert.equal(barrier.delta, 3, 'stop group at the next unselected clip');
const back = moveMVClipGroup(clips, ['a', 'b'], -5, 15);
assert.equal(back.delta, 0, 'cannot move before timeline zero');
assert.equal(moveMVClipGroup(clips, ['c', 'locked'], -1, 15).applied, false);
assert.deepEqual(getMarqueeMVClipIds(clips, 3, 8), ['b', 'c']);
assert.deepEqual(getMarqueeMVClipIds(clips, 8, 3), ['b', 'c']);
assert.deepEqual(getMarqueeMVClipIds(clips, 0, 0), []);
assert.equal(moveMVClipGroup(clips, ['c'], -2, 15).delta, -2);
console.log('MV marquee and atomic group dragging tests passed');
