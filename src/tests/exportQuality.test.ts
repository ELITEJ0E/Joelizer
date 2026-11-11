import assert from 'node:assert/strict';
import { getResolutionDimensions } from '../types/projectJson';
import { getExportVideoBitrate, getExportCrf } from '../lib/renderers/exportQuality';

assert.deepEqual(getResolutionDimensions('9:16', '1080p'), { width: 1080, height: 1920 });
assert.deepEqual(getResolutionDimensions('9:16', '1440p'), { width: 1440, height: 2560 });
assert.deepEqual(getResolutionDimensions('9:16', '2160p'), { width: 2160, height: 3840 });
assert.deepEqual(getResolutionDimensions('16:9', '2160p'), { width: 3840, height: 2160 });
const bitrates = (['balanced', 'high', 'maximum'] as const).map(quality =>
  getExportVideoBitrate(1080, 1920, 30, quality));
assert.ok(bitrates[0] < bitrates[1] && bitrates[1] < bitrates[2],
  'Higher encoding quality must target a greater bitrate');
assert.ok(getExportVideoBitrate(1080, 1920, 60, 'high') >
  getExportVideoBitrate(1080, 1920, 30, 'high'),
  '60 FPS should receive greater bitrate than 30 FPS');
assert.ok(getExportCrf('maximum') < getExportCrf('high') &&
  getExportCrf('high') < getExportCrf('balanced'),
  'More detail requires lower H.264 CRF');
console.log('Video export quality and resolution tests passed');
