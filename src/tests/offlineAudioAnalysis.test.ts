import assert from 'node:assert/strict';
import { OfflineAudioAnalysis } from '../lib/renderers/offlineAudioAnalysis';
import { prepareBeatReactiveSpectrum } from '../lib/positionedLyricsVisualizer';

// Audio data contains both bass and high-frequency energy. The former
// 512-point FFT only populated bins 0..255 in a 1024-bin array, leaving the
// outer vinyl and lyric visualizer nearly empty at higher positions.
const sampleRate = 48000;
const samples = new Float32Array(sampleRate);
for (let i = 0; i < samples.length; i++) {
  const amplitude = i < sampleRate / 2 ? 0.36 : 0.08;
  samples[i] = amplitude * (0.55 * Math.sin(2 * Math.PI * 220 * i / sampleRate) +
    0.45 * Math.sin(2 * Math.PI * 18750 * i / sampleRate));
}
const fakeAudioBuffer = {
  sampleRate, getChannelData: (_channel: number) => samples
} as unknown as AudioBuffer;
const analysis = new OfflineAudioAnalysis();
analysis.setBuffer(fakeAudioBuffer);
const strong = analysis.atTime(0.25), quiet = analysis.atTime(0.75);
assert.equal(strong.frequency.length, 1024);
assert.ok(strong.frequency.slice(550, 940).some(x => x > 15),
  'Upper frequency bins should contain musical energy instead of all being zero');
assert.ok(strong.frequency.some(x => x > 40),
  'Vinyl visualizer should receive visible audio energy');
assert.notDeepEqual([...strong.frequency], [...quiet.frequency],
  'Visualizer spectrum should update in response to different musical amplitudes');
assert.ok(strong.waveform.some(x => x !== 128), 'Waveform should receive decoded PCM data');
console.log('Offline vinyl and lyric visualizer frequency bins verified');

// Regression for an exported song with a beat: the same FFT magnitude must
// render visibly taller on a strong PCM hit than on a quiet section. Silence
// must never be animated artificially.
const inputSpectrum = new Uint8Array(1024).fill(35);
const quietPcm = new Uint8Array(1024).fill(128);
const loudPcm = new Uint8Array(1024).fill(128).map((_, i) => i % 2 ? 173 : 83);
const quietBars = prepareBeatReactiveSpectrum(inputSpectrum, quietPcm);
const loudBars = prepareBeatReactiveSpectrum(inputSpectrum, loudPcm);
assert.ok(loudBars[16] > quietBars[16] + 20,
  'Exported spectrum must grow with the actual soundtrack beat energy');
assert.equal(prepareBeatReactiveSpectrum(new Uint8Array(1024), loudPcm)[16], 0,
  'No spectral energy means no fabricated beat animation');
console.log('Beat-reactive exported visualizer response verified');
