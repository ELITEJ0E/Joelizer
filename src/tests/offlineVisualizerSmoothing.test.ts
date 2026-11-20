import assert from 'node:assert/strict';
import { OfflineAudioAnalysis } from '../lib/renderers/offlineAudioAnalysis';

// A deliberately uneven soundtrack with rapidly alternating kick energy.
// Export frequency levels should follow it without per-frame strobing.
const rate = 48000;
const samples = new Float32Array(rate);
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  const envelope = Math.floor(t * 20) % 2 === 0 ? 0.72 : 0.08;
  samples[i] = Math.sin(2 * Math.PI * 110 * t) * envelope;
}
const buffer = { sampleRate: rate, getChannelData: () => samples } as AudioBuffer;

function measureJitter(smoothing: number, fps: number) {
  const analyser = new OfflineAudioAnalysis();
  analyser.setSmoothing(smoothing);
  analyser.setBuffer(buffer);
  let previous: number | null = null;
  let changes = 0;
  for (let frame = 0; frame < fps; frame++) {
    const fft = analyser.atTime(frame / fps).frequency;
    const bass = fft.slice(1, 24).reduce((total, value) => total + value, 0);
    if (previous !== null) changes += Math.abs(bass - previous);
    previous = bass;
  }
  return changes;
}

assert.ok(measureJitter(0.75, 60) < measureJitter(0, 60),
  'Temporal smoothing must reduce frame-to-frame spectral flicker at 60 FPS');
assert.ok(measureJitter(0.75, 30) < measureJitter(0, 30),
  'Temporal smoothing must also work at 30 FPS');

const analyser = new OfflineAudioAnalysis();
analyser.setBuffer(buffer);
analyser.setSmoothing(0.75);
analyser.atTime(0.1);
assert.ok(analyser.atTime(0.9).frequency.some(value => value > 0),
  'Seeking to a new timestamp must reset history and still produce FFT output');
console.log('Offline visualizer smoothing tests passed');
