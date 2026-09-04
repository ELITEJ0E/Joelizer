import assert from 'node:assert';
import { computeContinuousLineSweep, TimedWordMetric } from '../lib/karaokeSweep';

console.log('Testing Karaoke Sweep Engine...');

const words: TimedWordMetric[] = [
  { word: 'Never', width: 80, startTime: 1.0, endTime: 1.5 },
  { word: 'gonna', width: 90, startTime: 1.55, endTime: 2.0 },
  { word: 'give', width: 70, startTime: 2.05, endTime: 2.4 },
  { word: 'you', width: 60, startTime: 2.45, endTime: 2.8 },
  { word: 'up', width: 50, startTime: 2.85, endTime: 3.2 }
];

const spaceWidth = 14;

// 1. Before line starts: highlight is 0
const resBefore = computeContinuousLineSweep(words, spaceWidth, 0.5);
assert.strictEqual(resBefore.highlightX, 0, 'Highlight should be 0 before start');
assert.strictEqual(resBefore.highlightProgress, 0, 'Progress should be 0 before start');

// 2. Monotonic increase during playback
let lastX = -1;
for (let t = 1.0; t <= 3.2; t += 0.05) {
  const res = computeContinuousLineSweep(words, spaceWidth, t);
  assert(res.highlightX >= lastX, `Highlight must be monotonically non-decreasing at t=${t} (got ${res.highlightX}, previous ${lastX})`);
  lastX = res.highlightX;
}

// 3. After line completes: highlight is totalWidth
const resAfter = computeContinuousLineSweep(words, spaceWidth, 3.5);
assert.strictEqual(resAfter.highlightX, resAfter.totalWidth, 'Highlight should be totalWidth after end');
assert.strictEqual(resAfter.highlightProgress, 1, 'Progress should be 1 after end');

console.log('Karaoke Sweep Engine tests passed successfully!');
