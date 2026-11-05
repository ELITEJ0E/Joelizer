import assert from 'node:assert/strict';
import {
  MASTER_PRESETS, cleanMasterFilename, encodeLabWav, measureAudio, SPECTRAL_BANDS
} from '../lib/audioLabEngine';
import {
  detectAudioContainer, inspectAudioFile, waveformStructureCorrelation
} from '../lib/audioProvenance';

function syntheticBuffer(amplitude: number, seconds = 1, rate = 48000): AudioBuffer {
  const length = Math.floor(seconds * rate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    left[i] = amplitude * Math.sin(i * 440 * Math.PI * 2 / rate);
    right[i] = left[i];
  }
  return {
    length, numberOfChannels: 2, duration: seconds, sampleRate: rate,
    getChannelData: (index: number) => index === 0 ? left : right
  } as unknown as AudioBuffer;
}

const buffer = syntheticBuffer(0.5);
const metrics = measureAudio(buffer);
assert.equal(metrics.channels, 2);
assert.equal(metrics.sampleRate, 48000);
assert.ok(Math.abs(metrics.samplePeakDbfs + 6.0206) < 0.1, 'Sample peak must reflect a -6 dBFS sine');
assert.ok(Math.abs(metrics.rmsDbfs + 9.0309) < 0.1, 'RMS level must be waveform-based, not LUFS');
assert.ok(Math.abs(metrics.crestDb - 3.0103) < 0.1, 'Sine wave crest factor must be about 3 dB');
assert.ok(metrics.stereoCorrelation !== null && metrics.stereoCorrelation > 0.999);
assert.equal(metrics.waveform.length, 160);
assert.equal(metrics.spectrumDb.length, SPECTRAL_BANDS.length);
assert.equal(metrics.clippedPercent, 0);

for (const depth of [16, 24] as const) {
  const blob = encodeLabWav(buffer, depth);
  const header = new DataView(await blob.arrayBuffer());
  const text = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => String.fromCharCode(header.getUint8(offset + i))).join('');
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(text(12, 4), 'fmt ');
  assert.equal(header.getUint16(22, true), 2);
  assert.equal(header.getUint16(34, true), depth);
  assert.equal(header.getUint32(24, true), 48000);
  assert.equal(header.getUint32(4, true), blob.size - 8);
  const listLength = header.getUint32(40, true);
  const dataOffset = 44 + listLength;
  assert.equal(text(dataOffset, 4), 'data');
  assert.equal(header.getUint32(dataOffset + 4, true), 48000 * 2 * depth / 8);
  assert.equal(blob.size, dataOffset + 8 + 48000 * 2 * depth / 8);
}
assert.equal(cleanMasterFilename('my track.wav'), 'my track-joelizer-master.wav');

const bytes = new Uint8Array(200);
bytes.set(new TextEncoder().encode('RIFF'), 0);
bytes.set(new TextEncoder().encode('WAVE'), 8);
bytes.set(new TextEncoder().encode('c2pa Suno'), 40);
const file = new File([bytes], 'test.wav', { type: 'audio/wav' });
assert.equal(detectAudioContainer(bytes, file.name), 'WAV / RIFF');
const inspection = await inspectAudioFile(file);
assert.ok(inspection.markerHints.some(hint => hint.includes('C2PA')));
assert.ok(inspection.markerHints.some(hint => hint.includes('Suno')));
assert.ok(inspection.scopeNote.includes('not proof'), 'Marker scan must disclaim verification limits');

assert.ok(Math.abs(waveformStructureCorrelation([1, 2, 3, 4], [2, 4, 6, 8])! - 1) < 1e-12);
assert.ok(Math.abs(waveformStructureCorrelation([1, 2, 3, 4], [8, 6, 4, 2])! + 1) < 1e-12);
assert.ok(MASTER_PRESETS.balanced.samplePeakCeilingDbfs < 0);

console.log('Audio Lab metrics, RIFF export, provenance hints, and waveform comparisons pass.');
