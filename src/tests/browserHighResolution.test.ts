import assert from 'node:assert/strict';
import { getCandidateCodecs } from '../lib/renderers/OfflineWebCodecsRenderer';
import { getExportVideoBitrate } from '../lib/renderers/exportQuality';
import { getResolutionDimensions } from '../types/projectJson';

// High-resolution browser exports require an H.264 level that allows UHD.
// A 4K/60 FPS encoder needs Level 5.2, not 4.2 or 5.1.
assert.equal(getCandidateCodecs(3840, 2160, 30)[0], 'avc1.640033');
assert.equal(getCandidateCodecs(3840, 2160, 60)[0], 'avc1.640034');
assert.equal(getCandidateCodecs(2160, 3840, 60)[0], 'avc1.640034');
assert.ok(getCandidateCodecs(2560, 1440, 30).includes('avc1.640033'));

const landscape = getResolutionDimensions('16:9', '2160p');
const portrait = getResolutionDimensions('9:16', '2160p');
assert.deepEqual(landscape, { width: 3840, height: 2160 });
assert.deepEqual(portrait, { width: 2160, height: 3840 });

assert.ok(getExportVideoBitrate(3840, 2160, 30, 'maximum') >
  getExportVideoBitrate(1920, 1080, 30, 'maximum'));
console.log('PASS: browser high-resolution codec levels and native output dimensions');
