import assert from 'node:assert/strict';
import { effectiveLyricEnd, resolvedLyricLines, resolveTimedLyricWords } from '../lib/lyricTiming';
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

const uneven = resolveTimedLyricWords({ text: 'I remember you', startTime: 2, endTime: 3.2 });
assert.equal(uneven[0].startTime, 2);
assert.ok(Math.abs(uneven[1].startTime - 2.1) < 1e-9);
assert.ok(Math.abs(uneven[2].startTime - 2.9) < 1e-9);
assert.ok(Math.abs(uneven[2].endTime - 3.2) < 1e-9);
const short = resolveTimedLyricWords({ text: 'a b', startTime: 5, endTime: 5.2 });
assert.equal(short[1].startTime, 5.2);
const explicit = resolveTimedLyricWords({ text: 'test', startTime: 1, endTime: 2,
  words: [{ word: 'test', startTime: 1.123456, endTime: 1.923456, start: 1.4, end: 1.7 }] });
assert.deepEqual(explicit, [{ word: 'test', startTime: 1.123456, endTime: 1.923456 }]);
assert.deepEqual(resolveTimedLyricWords({ text: 'I remember you', startTime: 2, endTime: 3.2, words: uneven }), uneven);
