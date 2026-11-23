import assert from 'node:assert/strict';
import { getResolutionDimensions } from '../types/projectJson';
import { getCandidateCodecs } from '../lib/renderers/OfflineWebCodecsRenderer';
import { selectHighResolutionEngine } from '../lib/renderers/highResRouting';

assert.deepEqual(getResolutionDimensions('16:9', '2160p'), { width: 3840, height: 2160 });
assert.deepEqual(getResolutionDimensions('9:16', '2160p'), { width: 2160, height: 3840 });
assert.deepEqual(getResolutionDimensions('9:16', '1440p'), { width: 1440, height: 2560 });

// H.264 4K/60 needs Level 5.2 rather than the old 5.1-only candidate list.
assert.ok(getCandidateCodecs(3840, 2160, 60).includes('avc1.640034'),
  '4K/60 has a Level 5.2 High-profile encoder candidate');
assert.equal(getCandidateCodecs(3840, 2160, 60).includes('avc1.640033'), false,
  '4K/60 must not use an insufficient Level 5.1 profile');
assert.ok(getCandidateCodecs(3840, 2160, 30).includes('avc1.640033'),
  '4K/30 supports Level 5.1');
assert.ok(getCandidateCodecs(2560, 1440, 60).includes('avc1.640033'),
  '1440p/60 supports Level 5.1');

// 4K can use the free browser engine with NO server. Explicitly selected
// server remains preferred if it is actually online.
assert.equal(selectHighResolutionEngine('browser', true, false), 'offline');
assert.equal(selectHighResolutionEngine('offline', true, false), 'offline');
assert.equal(selectHighResolutionEngine('server', true, false), 'offline');
assert.equal(selectHighResolutionEngine('server', true, true), 'server');
assert.equal(selectHighResolutionEngine('browser', false, true), 'server');
assert.equal(selectHighResolutionEngine('browser', false, false), null);
console.log('Free 1440p/4K codec profiles and render engine routing tests passed.');
