import assert from 'node:assert/strict';
import { effectiveLyricEnd, resolvedLyricLines } from '../lib/lyricTiming';
const lyrics = [
  { id: 'a', startTime: 10, endTime: 11, endTimeAuto: true, text: 'First' },
  { id: 'b', startTime: 20, endTime: 21, text: 'Second' },
  { id: 'c', startTime: 30, endTime: 31, endTimeAuto: true, text: 'Last' }
];
assert.equal(effectiveLyricEnd(lyrics[0], lyrics, 60), 20);
assert.equal(effectiveLyricEnd(lyrics[2], lyrics, 60), 60);
assert.equal(effectiveLyricEnd(lyrics[1], lyrics, 60), 21);
assert.deepEqual(resolvedLyricLines(lyrics, 60).map(l => l.endTime), [20, 21, 60]);
assert.equal(lyrics[0].endTime, 11, 'Clearing must not change the stored original end');
console.log('LRC automatic end tests passed');
