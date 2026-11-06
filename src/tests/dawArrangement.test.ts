import assert from 'node:assert/strict';
import { gridSeconds, secondsPerBar, snapTime, normalizeMarkers, normalizeClipEdit } from '../lib/dawArrangement';
import type { DAWClip } from '../types/daw';
import { splitClipFades } from '../lib/dawAudioProcessing';

assert.equal(secondsPerBar(120, '4/4'), 2);
assert.equal(secondsPerBar(120, '3/4'), 1.5);
assert.equal(secondsPerBar(120, '6/8'), 1.5);
assert.equal(secondsPerBar(120, 'invalid'), 2);
assert.equal(gridSeconds(120, '1/4'), .5);
assert.equal(gridSeconds(120, '1/16'), .125);
assert.equal(gridSeconds(120, '1/32'), .0625);
assert.equal(snapTime(.33, 120, '1/4'), .5);
assert.equal(snapTime(.33, 120, '1/16'), .375);
assert.equal(snapTime(.33, 120, 'off'), .33);
assert.equal(snapTime(.33, 120, '1/4', false), .33);
assert.equal(snapTime(-5, 120, '1/4'), 0);

const markers = normalizeMarkers([
  { id: 'b', name: 'Drop', time: 8, color: '#ff00ff' },
  { id: 'a', name: 'Intro', time: -3, color: 'url(x)' },
  { id: 'b', name: 'Duplicate ID', time: 2 },
  { id: 'bad', time: NaN }, null,
]);
assert.deepEqual(markers.map(m => [m.id, m.time]), [['a', 0], ['b', 8]]);
assert.equal(markers[0].color, '#a78bfa');
assert.deepEqual(normalizeMarkers(undefined), []);

const clip: DAWClip = { id:'clip',trackId:'track',name:'Test',audioUrl:'test',startTime:1,duration:2,sourceStart:3,sourceEnd:5,volume:1,fadeIn:0,fadeOut:0 };
const edited = normalizeClipEdit(clip, { id:'wrong',trackId:'wrong',startTime:-3,volume:9,fadeIn:5,fadeOut:-2 });
assert.equal(edited.id, clip.id);
assert.equal(edited.trackId, clip.trackId);
assert.equal(edited.startTime, 0);
assert.equal(edited.volume, 1.5);
assert.equal(edited.fadeIn, 2);
assert.equal(edited.fadeOut, 0);
assert.equal(clip.volume, 1, 'Edits must not mutate original clips or history snapshots');
const original = { ...clip, duration:4, sourceStart:0, sourceEnd:4, fadeIn:1, fadeOut:1 };
const splitRight = { ...original, ...splitClipFades(original, .5).right, sourceStart:.5, sourceEnd:4, duration:3.5 };
assert.deepEqual(normalizeClipEdit(splitRight, { volume:.5 }).fadeEnvelope, splitRight.fadeEnvelope,
  'Gain changes retain the original split fade shape');
const trimmed = normalizeClipEdit(splitRight, { sourceStart:.75, duration:3.25 });
assert.equal(trimmed.fadeEnvelope?.offset, .75);
assert.equal(trimmed.fadeIn, .25, 'Trimming an envelope view updates the displayed fade length');
assert.equal(normalizeClipEdit(splitRight, {fadeIn:.1}).fadeEnvelope, undefined,
  'Explicit fade edits create a local envelope');
console.log('Arrangement meter, snapping, marker validation and non-destructive clip edits passed.');
