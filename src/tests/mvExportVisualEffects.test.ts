import { getMVActiveClip, getMVTransitionLead, getMVTransitionPlaybackRate, getMVTransitionSourceTime, getMVTransitionVisual } from '../lib/mvTransitionTiming';
import assert from 'node:assert/strict';
import { overlayActive, getOverlayLayers, drawOverlayEffects } from '../lib/overlayEffects';
import { getEffectiveMVTransition } from '../lib/mvTransitionSettings';
import { getUncoveredMVIntervals } from '../lib/mvAutoEdit';

const overlay = { effect: 'light-leak' as const, intensity: 0.75, startTime: 2, endTime: 6 };
assert.equal(overlayActive(overlay, 1.99), false);
assert.equal(overlayActive(overlay, 3), true);
assert.ok(getOverlayLayers(overlay, 3).length > 0, 'Remotion export requires a real overlay layer');
assert.deepEqual(getOverlayLayers(overlay, 7), [], 'Overlay end time must be respected');
assert.equal(typeof drawOverlayEffects, 'function', 'Offline exporter must use the same overlay renderer as preview');

const transition = getEffectiveMVTransition({
  transition: 'cut', transitionDuration: 0.2, editOrigin: 'auto', manuallyEdited: false
}, true, 'morph', 0.8);
assert.deepEqual(transition, { type: 'morph', duration: 0.8 },
  'Old generated hard cuts must resolve to currently configured morph blends');
assert.deepEqual(getUncoveredMVIntervals([{ startTime: 0, endTime: 4 }], 8),
  [{ start: 4, end: 8 }], 'Timeline clips keep their exact time interval');

console.log('MV export visual effect configuration regression tests passed');

const first = { id: 'a', startTime: 0, endTime: 2, trimStart: 0, trimEnd: 2, type: 'video' };
const second = { id: 'b', startTime: 2, endTime: 4, trimStart: 5, trimEnd: 7, type: 'video' };
const lead = getMVTransitionLead(first, second, 'morph', 0.5);
assert.equal(lead, 0.5);
assert.equal(getMVTransitionLead(first, second, 'cut', 0.5), 0);
assert.equal(getMVTransitionLead(first, {...second, startTime: 2.1}, 'fade', 0.5), 0);
assert.equal(getMVTransitionLead(first, {...second, type: 'visualizer'}, 'fade', 0.5), 0);
assert.equal(getMVTransitionLead(first, {...second, startTime: 1.8}, 'fade', 0.5), 0.5);
assert.equal(getMVActiveClip([first, second], 2)?.id, 'b');
assert.equal(getMVActiveClip([first, {...second, startTime: 1.8}], 1.9)?.id, 'b');
assert.equal(getMVActiveClip([first, {...second, startTime: 2.001}], 2.0005)?.id, 'a');
assert.equal(getMVTransitionPlaybackRate(second, lead), 0.8);
assert.equal(getMVTransitionSourceTime(second, 1.5, lead), 5);
assert.equal(getMVTransitionSourceTime(second, 2, lead), 5.4);
assert.ok(getMVTransitionSourceTime(second, 3.999, lead) < 7);
assert.equal(getMVTransitionVisual('glitch', 0.5, 1920, 1080).filter, 'hue-rotate(45deg)');
assert.equal(getMVTransitionVisual('slide', 1, 1920, 1080).x, 0);
console.log('MV transition boundary, source range and visual parity assertions passed');
