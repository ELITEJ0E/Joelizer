import assert from 'node:assert/strict';
import { getEffectiveMVTransition } from '../lib/mvTransitionSettings';

const auto = { transition: 'cut' as const, transitionDuration: 0.2,
  editOrigin: 'auto' as const, manuallyEdited: false };
assert.deepEqual(getEffectiveMVTransition(auto, true, 'morph', 0.6),
  { type: 'morph', duration: 0.6 },
  'Old generated hard cuts must now follow the selected morph transition');
assert.deepEqual(getEffectiveMVTransition({ ...auto, manuallyEdited: true, editOrigin: 'manual' },
  true, 'slide', 0.7), { type: 'slide', duration: 0.7 },
  'Manually trimmed clips must still use the global transition');
assert.deepEqual(getEffectiveMVTransition({ ...auto, transition: 'fade',
  transitionManuallyEdited: true }, true, 'morph', 0.6),
  { type: 'fade', duration: 0.2 },
  'An explicitly chosen per-clip transition is preserved');
assert.deepEqual(getEffectiveMVTransition(auto, false, 'morph', 0.6),
  { type: 'cut', duration: 0.6 },
  'Disabling automatic transitions yields a hard cut');
console.log('MV transition settings regression tests passed');
