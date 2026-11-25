import assert from 'node:assert/strict';
import { getMVClipMotion } from '../lib/mvClipMotion';
import { parseExportTimeInput } from '../lib/exportTimeInput';
import { resolveMVLyricsStyle } from '../lib/mvLyricsStyle';

assert.equal(parseExportTimeInput('040185'), 241.85);
assert.equal(parseExportTimeInput('0123'), 83);
assert.equal(parseExportTimeInput('83.25'), 83.25);
assert.equal(parseExportTimeInput('04:01.85'), 241.85);
assert.equal(parseExportTimeInput('005975'), 59.75);
assert.equal(parseExportTimeInput('046185'), null);
assert.equal(parseExportTimeInput(''), null);

assert.deepEqual(getMVClipMotion('none', 0.5, 1920, 1080), {scale: 1, x: 0, y: 0});
assert.ok(getMVClipMotion('ken-burns-in', 1, 1920, 1080).scale >
  getMVClipMotion('ken-burns-in', 0, 1920, 1080).scale);
assert.ok(getMVClipMotion('pan-left', 0.7, 1920, 1080).x < 0);
assert.ok(getMVClipMotion('pan-up', 0.7, 1920, 1080).y < 0);
assert.equal(resolveMVLyricsStyle('fade', 'karaoke'), 'fade',
  'ordinary MV captions must export the fade that the preview shows');
assert.equal(resolveMVLyricsStyle('none', 'karaoke'), 'none');
assert.equal(resolveMVLyricsStyle('fade', 'kinetic'), 'kinetic');
console.log('MV clip motion, lyric style and compact timecode tests passed');
