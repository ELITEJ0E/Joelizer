import assert from 'node:assert/strict';
import { playbackRateForTab, sourceTimeToTimelineTime } from '../lib/playbackClock';

for (const speed of [0.5, 1, 1.5, 2]) {
  assert.equal(playbackRateForTab('lrc', speed, 1), speed);
  assert.equal(sourceTimeToTimelineTime(83.25, 'lrc', 1), 83.25);
  assert.equal(sourceTimeToTimelineTime(83.25, 'lyrics', 1), 83.25);
  assert.equal(playbackRateForTab('lyrics', speed, 2), 1);
}
assert.equal(sourceTimeToTimelineTime(90, 'mv-studio', 1.5), 60);
assert.equal(sourceTimeToTimelineTime(90, 'lyrics', 1.5), 90);
assert.equal(playbackRateForTab('audio-lab', 1.5, 2), 1);
console.log('Shared LRC/Lyrics playback clock tests passed');
