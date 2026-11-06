import assert from 'node:assert/strict';
import { getClipEnvelope, normalizedClipFades, scheduleClipEnvelope, splitClipFades } from '../lib/dawAudioProcessing';
import type { DAWClip } from '../types/daw';

const clip: DAWClip = { id: 'clip', trackId: 'track', name: 'test', audioUrl: '',
  startTime: 0, sourceStart: 0, sourceEnd: 4, duration: 4, volume: 0.8, fadeIn: 1, fadeOut: 2 };
assert.equal(getClipEnvelope(clip, 0), 0);
assert.equal(getClipEnvelope(clip, 0.5), 0.4);
assert.equal(getClipEnvelope(clip, 1), 0.8);
assert.equal(getClipEnvelope(clip, 3), 0.4);
assert.equal(getClipEnvelope(clip, 4), 0);
assert.equal(getClipEnvelope(clip, -1), 0);
assert.deepEqual(normalizedClipFades({ duration: 2, fadeIn: 4, fadeOut: 4 }),
  { duration: 2, fadeIn: 1, fadeOut: 1 });
assert.deepEqual(normalizedClipFades({ duration: 2, fadeIn: NaN, fadeOut: -2 }),
  { duration: 2, fadeIn: 0, fadeOut: 0 });
const events: Array<[string, number, number]> = [];
const param = {
  setValueAtTime: (value: number, time: number) => events.push(['set', value, time]),
  linearRampToValueAtTime: (value: number, time: number) => events.push(['ramp', value, time]),
} as unknown as AudioParam;
scheduleClipEnvelope(param, clip, 10, 3);
assert.deepEqual(events, [['set', 0.4, 10], ['ramp', 0, 11]], 'Seek inside release starts at its actual envelope level');
events.length = 0;
scheduleClipEnvelope(param, clip, 10, 0.5);
assert.deepEqual(events, [['set', 0.4, 10], ['ramp', 0.8, 10.5], ['ramp', 0.8, 11.5], ['ramp', 0, 13.5]]);
for (const split of [0.25, 1, 1.5, 2, 3.5]) {
  const fades = splitClipFades(clip, split);
  const left = { ...clip, ...fades.left, duration: split };
  const right = { ...clip, ...fades.right, duration: clip.duration - split };
  for (let i = 0; i <= 100; i++) {
    const time = clip.duration * i / 100;
    const local = time <= split ? getClipEnvelope(left, time) : getClipEnvelope(right, time - split);
    assert.ok(Math.abs(local - getClipEnvelope(clip, time)) < 1e-12, `Split ${split}, time ${time}`);
  }
  assert.ok(Math.abs(getClipEnvelope(left, split) - getClipEnvelope(right, 0)) < 1e-12, 'No gain step at the split');
  const splitAgain = right.duration / 3;
  const again = splitClipFades(right, splitAgain);
  const tail = { ...right, ...again.right, duration: right.duration - splitAgain };
  assert.ok(Math.abs(getClipEnvelope(tail, tail.duration / 2) - getClipEnvelope(clip, split + splitAgain + tail.duration / 2)) < 1e-12,
    'Repeated splitting retains the original envelope position');
}
const short = { ...clip, duration: 0.5, fadeIn: 0.1, fadeOut: 0.1 };
const attackSplit = splitClipFades(short, 0.03);
assert.equal(attackSplit.left.fadeIn, 0.03);
assert.equal(attackSplit.left.fadeOut, 0);
assert.equal(attackSplit.right.fadeEnvelope!.offset, 0.03);
events.length = 0;
scheduleClipEnvelope(param, { ...short, ...attackSplit.right, duration: 0.47 }, 10);
assert.ok(Math.abs(events[0][1] - 0.24) < 1e-12, 'Attack split begins at the original nonzero gain');
assert.deepEqual(events.map(event => event[0]), ['set', 'ramp', 'ramp', 'ramp']);
assert.ok(Math.abs(events[1][2] - 10.07) < 1e-12);
assert.ok(Math.abs(events[2][2] - 10.37) < 1e-12);
assert.ok(Math.abs(events[3][2] - 10.47) < 1e-12);
const roundedEnd = { ...clip, duration: 0.2, fadeIn: 0, fadeOut: 0,
  fadeEnvelope: { duration: 0.3, offset: 0.1, fadeIn: 0, fadeOut: 0 } };
assert.equal(getClipEnvelope(roundedEnd, 0.2), clip.volume, 'Floating-point endpoint arithmetic must not add a release');
console.log('DAW envelope boundaries, overlap, seeks and repeated splits inside attack/plateau/release passed.');
