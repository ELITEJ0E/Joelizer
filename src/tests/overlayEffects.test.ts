import assert from 'node:assert/strict';
import { clampOverlay, getOverlayLayers, overlayActive, OVERLAY_PRESETS } from '../lib/overlayEffects';

const timed = { effect: 'light-leak' as const, intensity: 0.65, startTime: 3, endTime: 7 };
assert.equal(overlayActive(timed, 2.99), false, 'Effect must not render before start');
assert.equal(overlayActive(timed, 3), true, 'Effect begins exactly at its start time');
assert.equal(overlayActive(timed, 7), false, 'Effect must stop at the end time');
assert.equal(getOverlayLayers(timed, 5).length, 1);
assert.deepEqual(getOverlayLayers(timed, 8), [], 'Inactive effects cannot leak into export frames');
assert.ok(getOverlayLayers(timed, 5)[0].background.includes('radial-gradient'));
assert.deepEqual(getOverlayLayers(timed, 5), getOverlayLayers(timed, 5),
  'The same export timeline time must produce deterministic visuals');
assert.equal(clampOverlay({ effect: 'cinematic', intensity: 100 }).intensity, 1);
assert.equal(clampOverlay({ effect: 'vignette', intensity: -5 }).intensity, 0);
assert.equal(clampOverlay({ effect: 'none', intensity: 0.5 }).effect, 'none');
for (const preset of OVERLAY_PRESETS) {
  const result = getOverlayLayers({ effect: preset.id, intensity: 1, startTime: 0, endTime: 0 }, 1);
  assert.equal(preset.id === 'none', result.length === 0,
    `The ${preset.label} preset should render correctly`);
}
console.log('Shared overlay effects regression tests passed');
