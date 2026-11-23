import assert from 'node:assert/strict';
import { getCandidateCodecs, canEncodeBrowserResolution } from '../lib/renderers/OfflineWebCodecsRenderer';
import { getExportVideoBitrate } from '../lib/renderers/exportQuality';
import { getResolutionDimensions } from '../types/projectJson';

// High-resolution browser exports require an H.264 level that allows UHD.
// A 4K/60 FPS encoder needs Level 5.2, not 4.2 or 5.1.
assert.equal(getCandidateCodecs(3840, 2160, 30)[0], 'avc1.640033');
assert.equal(getCandidateCodecs(3840, 2160, 60)[0], 'avc1.640034');
assert.ok(!getCandidateCodecs(3840, 2160, 60).includes('avc1.640033'),
  '4K60 must not offer a noncompliant Level 5.1 profile');
assert.ok(!getCandidateCodecs(2560, 1440, 60).includes('avc1.64002a'),
  '1440p60 must not offer an insufficient Level 4.2 profile');
assert.equal(getCandidateCodecs(2160, 3840, 60)[0], 'avc1.640034');
assert.ok(getCandidateCodecs(2560, 1440, 30).includes('avc1.640033'));

const landscape = getResolutionDimensions('16:9', '2160p');
const portrait = getResolutionDimensions('9:16', '2160p');
assert.deepEqual(landscape, { width: 3840, height: 2160 });
assert.deepEqual(portrait, { width: 2160, height: 3840 });

assert.ok(getExportVideoBitrate(3840, 2160, 30, 'maximum') >
  getExportVideoBitrate(1920, 1080, 30, 'maximum'));
// This test deliberately simulates a device that supports 1440p but not 4K.
const globals = globalThis as any;
const prior = { window: globals.window, VideoFrame: globals.VideoFrame, VideoEncoder: globals.VideoEncoder };
try {
  globals.window = {};
  globals.VideoFrame = class {};
  globals.VideoEncoder = {
    isConfigSupported: async (config: any) => ({
      supported: config.width <= 2560 && config.height <= 2560,
      config
    })
  };
  assert.equal(await canEncodeBrowserResolution('1440p', '16:9', 30), true,
    '1440p capability is checked against actual requested dimensions');
  assert.equal(await canEncodeBrowserResolution('2160p', '16:9', 30), false,
    '1080p/1440p support does not incorrectly unlock incompatible 4K encoding');
} finally {
  for (const key of ['window', 'VideoFrame', 'VideoEncoder'] as const) {
    if (prior[key] === undefined) delete globals[key];
    else globals[key] = prior[key];
  }
}
console.log('PASS: browser high-resolution codec levels, exact-output preflight and native dimensions');
