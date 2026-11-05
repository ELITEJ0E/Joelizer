import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeExportAudioEnergy } from '../../server/renderEngine';

// Synthetic 120 Hz song with two clearly timed bass hits, one second apart.
// In a real MP4 export these must move the visualizer at their timestamps.
const rate = 8000;
const duration = 3;
const pcmSamples = rate * duration;
const wav = Buffer.alloc(44 + pcmSamples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(pcmSamples * 2, 40);
for (let sample = 0; sample < pcmSamples; sample++) {
  const t = sample / rate;
  const phase = t % 1;
  const loud = phase > 0.10 && phase < 0.26;
  const amplitude = loud ? 0.8 : 0;
  wav.writeInt16LE(Math.round(32767 * amplitude * Math.sin(2 * Math.PI * 120 * t)), 44 + sample * 2);
}
const filename = path.join(os.tmpdir(), 'joelizer-audio-sync-' + process.pid + '.wav');
try {
  fs.writeFileSync(filename, wav);
  const levels = analyzeExportAudioEnergy(filename, 0, 2.5, 30);
  assert.equal(levels.length, 75, 'One audio envelope measurement per video frame');
  assert.ok(levels[5] > 0.5, 'First bass hit must activate visualizer near 0.17 seconds');
  assert.ok(levels[35] > 0.5, 'Second bass hit must activate visualizer near 1.17 seconds');
  assert.ok(levels[20] < 0.15, 'Visualizer must settle between bass hits, not oscillate at a fake BPM');
  const trimmed = analyzeExportAudioEnergy(filename, 1, 1, 30);
  assert.ok(trimmed[5] > 0.5, 'Export range offset must preserve beat alignment');
  assert.ok(trimmed[20] < 0.15, 'Trimmed export must settle between beats');
  console.log('Server audio-driven export visualizer sync verified');
} finally {
  try { fs.unlinkSync(filename); } catch {}
}
