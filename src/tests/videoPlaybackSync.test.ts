import assert from 'node:assert/strict';
import { getVideoSyncDecision } from '../lib/videoPlaybackSync';

const decision = (actualTime: number, targetTime: number, overrides: Partial<Parameters<typeof getVideoSyncDecision>[0]> = {}) =>
  getVideoSyncDecision({ actualTime, targetTime, playing: true, seeking: false, clipChanged: false, ...overrides });

// Routine decoder/audio jitter must never trigger seeks.
assert.equal(decision(12.01, 12.19).seekTo, null);
assert.ok(Math.abs(decision(12.01, 12.19).playbackRate - 1.0216) < 0.000001);
assert.deepEqual(decision(12.01, 12.03), { seekTo: null, playbackRate: 1 });
assert.ok(decision(12.4, 12).playbackRate < 1, 'video ahead should gently slow down');
assert.ok(decision(12, 12.4).playbackRate > 1, 'video behind should gently speed up');

// An incoming clip is preloaded and pre-seeked before the transition.
// Re-seeking that same timestamp on its first active frame used to stall
// decoding for a noticeable moment at every edit boundary.
assert.deepEqual(decision(8.02, 8.05, { clipChanged: true }),
  { seekTo: null, playbackRate: 1 },
  'Prewarmed incoming video must play immediately without a redundant seek');
assert.deepEqual(decision(8.02, 8.05, { clipChanged: true, seeking: true }),
  { seekTo: null, playbackRate: 1 },
  'Do not enqueue another seek during preloading');
assert.equal(decision(2.1, 12, { clipChanged: true }).seekTo, 12,
  'Direct jumps to uncached footage still seek to the exact trim');

// Timeline edits, seek actions and large errors need a precise reset.
assert.equal(decision(11, 15, { clipChanged: true }).seekTo, 15);
assert.equal(decision(11, 15).seekTo, 15);
assert.equal(decision(11.1, 11.4, { seeking: true }).seekTo, null);
assert.equal(decision(11.1, 11.4, { seeking: true }).playbackRate, 1);
assert.equal(decision(11.1, 11.4, { playing: false }).seekTo, 11.4);
assert.equal(decision(0, 0.8).seekTo, null);
console.log('video playback synchronization tests passed');
