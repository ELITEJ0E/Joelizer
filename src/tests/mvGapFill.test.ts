import assert from 'node:assert/strict';
import { generateGapFill } from '../lib/mvAutoEdit';
import { useMVStore, TimelineClip, MediaAsset } from '../store/useMVStore';

const original: TimelineClip[] = [
  { id: 'manual-intro', assetId: 'image', type: 'image', startTime: 0, endTime: 2,
    trimStart: 0, trimEnd: 2, zoom: 1.4, offsetY: -0.2, effect: 'pan-left', transition: 'dissolve' },
  { id: 'manual-chorus', assetId: 'video', type: 'video', startTime: 5, endTime: 8,
    trimStart: 2, trimEnd: 5, zoom: 0.8, offsetX: 0.6, transition: 'dissolve', locked: true },
  { id: 'manual-outro', assetId: 'image', type: 'image', startTime: 10, endTime: 12,
    trimStart: 0, trimEnd: 2, effect: 'pan-left', transition: 'dissolve' }
];
const assets: MediaAsset[] = [
  { id: 'image', url: '/image.jpg', name: 'Image', type: 'image', duration: 10, thumbnail: '', status: 'ready' },
  { id: 'video', url: '/video.mp4', name: 'Video', type: 'video', duration: 1, thumbnail: '', status: 'ready' }
];

const before = JSON.stringify(original);
const fills = generateGapFill({
  songDuration: 12, lyricsLines: [], mediaAssets: assets,
  style: 'Cinematic', pacing: 'Balanced', beatSync: 'Strong', seed: 17,
  existingClips: original
});
assert.equal(JSON.stringify(original), before, 'Generator cannot mutate existing clips');
assert.ok(fills.length > 0, 'Empty slots should be filled');
assert.ok(fills.every(c => c.id.startsWith('gap-')), 'Fill must only return new clips');
assert.ok(fills.every(c => c.transition === 'dissolve'),
  'Fill should inherit the manually edited dominant transition');

const store = useMVStore.getState();
useMVStore.setState({ timelineClips: structuredClone(original) });
const count = store.addGapFillClips(fills);
assert.equal(count, fills.length, 'All valid fill clips should be inserted');
const result = useMVStore.getState().timelineClips;
assert.deepEqual(result.filter(c => c.id.startsWith('manual-')), original,
  'All original manual clip properties must stay exactly unchanged');
const sorted = [...result].sort((a, b) => a.startTime - b.startTime);
for (let i = 1; i < sorted.length; i++) {
  assert.ok(sorted[i].startTime >= sorted[i - 1].endTime - 0.0001,
    'Auto-filled scenes cannot overlap existing or other generated scenes');
}
for (const [start, end] of [[2, 5], [8, 10]]) {
  const pieces = result.filter(c => c.startTime < end && c.endTime > start)
    .sort((a, b) => a.startTime - b.startTime);
  let cursor = start;
  for (const piece of pieces) {
    assert.ok(piece.startTime - cursor < 0.11, 'No substantial gaps should remain');
    cursor = Math.max(cursor, piece.endTime);
  }
  assert.ok(end - cursor < 0.11, 'Gap should be covered to its end');
}
assert.equal(store.addGapFillClips(fills), 0, 'Running fill twice must not duplicate already placed clips');
console.log('MV gap fill regression tests passed');
