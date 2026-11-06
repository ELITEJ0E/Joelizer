import assert from 'node:assert/strict';
import {
  PHONK_SOUNDS, PHONK_LANES, PHONK_PATTERNS,
  makePhonkSettings, midiToHz, normalizePhonkPCM,
  renderPhonkOneShot, renderPhonkBeat, filenameForPhonk
} from '../lib/phonkSynthEngine';

assert.ok(Math.abs(midiToHz(69) - 440) < 1e-10);
assert.equal(PHONK_SOUNDS.length, 9, 'All nine original phonk sound engines must be available');
const duration = 0.35;
for (const { id, label } of PHONK_SOUNDS) {
  const settings = { ...makePhonkSettings('brazilian', id), duration };
  const pcm = renderPhonkOneShot(settings, 16000);
  const second = renderPhonkOneShot(settings, 16000);
  assert.equal(pcm.left.length, Math.round(duration * 16000), label + ' length');
  assert.equal(pcm.right.length, pcm.left.length, label + ' stereo size');
  assert.equal(pcm.left[100], second.left[100], label + ' deterministic seed');
  assert.ok(Array.from(pcm.left).every(Number.isFinite), label + ' finite signal');
  assert.ok(Array.from(pcm.right).every(Number.isFinite), label + ' finite stereo signal');
  assert.ok(pcm.left.some(value => Math.abs(value) > 0.00001), label + ' should not be silent');
  const mastered = normalizePhonkPCM(pcm, -1);
  const peak = Math.max(...mastered.left.map(Math.abs), ...mastered.right.map(Math.abs));
  assert.ok(peak <= Math.pow(10, -1 / 20) + 0.0001, label + ' must have safe peak');
  assert.ok(peak > 0.01, label + ' mastered sample should be audible');
}

const beat = renderPhonkBeat(PHONK_PATTERNS.drift, 120,
  makePhonkSettings('drift', 'cowbell'), 2, 16000);
assert.ok(Math.abs(beat.duration - 4) < 1 / beat.sampleRate, '2 bars at 120 BPM is 4 seconds');
assert.equal(beat.left.length, beat.right.length);
assert.ok(Math.max(...beat.left.subarray(0, 500)) > 0, 'Beat starts with a kick');
for (const lane of PHONK_LANES) {
  assert.equal(PHONK_PATTERNS.drift[lane].length, 16, lane + ' must contain 16 steps');
  assert.equal(PHONK_PATTERNS.brazilian[lane].length, 16);
  assert.equal(PHONK_PATTERNS.dark[lane].length, 16);
}
const empty = Object.fromEntries(PHONK_LANES.map(lane => [lane, Array(16).fill(false)])) as typeof PHONK_PATTERNS.drift;
const silence = renderPhonkBeat(empty, 140, makePhonkSettings('dark', 'bass'), 1, 8000);
assert.ok(silence.left.every(value => value === 0), 'Empty pattern should export silence');
assert.equal(filenameForPhonk('cowbell', 'drift'), 'joelizer-drift-phonk-cowbell.wav');
assert.equal(filenameForPhonk('beat', 'brazilian'), 'joelizer-brazilian-phonk-beat.wav');
console.log('Original phonk synthesis: nine generators, seeded variation, peak safety, sequencer timing and empty pattern passed.');
