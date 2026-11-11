import assert from 'node:assert/strict';
import { prepareBeatReactiveSpectrum } from '../lib/positionedLyricsVisualizer';

function waveform(amplitude: number, count = 1024): Uint8Array {
  return Uint8Array.from({ length: count }, (_, i) =>
    Math.max(0, Math.min(255, Math.round(128 + amplitude * Math.sin(i * 0.1)))));
}
const varied = Uint8Array.from({ length: 1024 }, (_, i) =>
  Math.round(160 + (i % 16) * 6));
const loud = prepareBeatReactiveSpectrum(varied, waveform(110));
const quiet = prepareBeatReactiveSpectrum(Uint8Array.from(varied, v => v / 3), waveform(18));
assert.equal(loud.length, varied.length);
assert.ok(Math.max(...loud) < 255, 'Loud tracks should not push every FFT bin into hard clipping');
assert.ok(Math.max(...loud) - Math.min(...loud) > 12,
  'Loud mastered audio must retain visible differences between spectral bands');
assert.ok(Math.max(...quiet) > 25, 'Quiet music should still respond');
assert.deepEqual(prepareBeatReactiveSpectrum(varied, waveform(110), false), varied,
  'Disabling Auto Level should preserve raw analyzer bins');
assert.ok(prepareBeatReactiveSpectrum(new Uint8Array(512), waveform(0)).every(v => v === 0),
  'Silence must not create artificial beats');
console.log('Adaptive visualizer spectrum tests passed');
