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

import {clipAudioGain,soundtrackAudioGain,mvClipAudioSegments} from '../lib/mvAudioMix';
assert.equal(clipAudioGain({}),0,'Older projects remain muted');
assert.equal(clipAudioGain({audioMuted:false,audioVolume:0.35}),0.35);
assert.equal(clipAudioGain({audioMuted:true,audioVolume:0.35}),0);
assert.equal(soundtrackAudioGain({muted:true}),0);
assert.equal(soundtrackAudioGain({volume:0.4}),0.4);
const mixProject={exportMode:'music-video',exportRange:{start:2,end:4,duration:2},videoClips:[{id:'audio',url:'test.mp4',type:'video',startTime:1,endTime:5,trimStart:3,trimEnd:7,speed:1,audioMuted:false,audioVolume:.5}],audio:{}} as any;
assert.deepEqual(mvClipAudioSegments(mixProject),[{id:'audio',url:'test.mp4',gain:.5,offset:4,rate:1,start:0,duration:2,trimEnd:7}]);
