import { clampPreviewVideoTime, isPreviewFrameReady } from '../lib/mvPreviewFrames';
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
assert.equal(decision(0, 0.8).seekTo, 0.8,
  'after retiming or seeking, correct a large source mismatch immediately');
assert.equal(decision(12, 12.02, { baseRate: 2 }).playbackRate, 2,
  'a sped-up clip must play at its chosen rate even with no decoder drift');
assert.ok(decision(12, 12.3, { baseRate: 0.5 }).playbackRate > 0.5,
  'drift correction must be relative to the clip rate');
assert.equal(decision(10, 10.36, { baseRate: 2 }).seekTo, 10.36,
  '2× clips must resync promptly without needing a manual rewind');
console.log('video playback synchronization tests passed');

assert.equal(decision(5, 5, { baseRate: 0.08 }).playbackRate, 0.08, 'Slow transition pre-roll retains effective playback rate');
assert.ok(decision(5, 5.3, { baseRate: 8 }).playbackRate <= 8);

const frame = { readyState: 2, seeking: false, currentTime: 9.99, videoWidth: 1920, videoHeight: 1080 };
assert.equal(clampPreviewVideoTime(10.3, 10), 9.999);
assert.equal(clampPreviewVideoTime(2, Infinity), 2);
assert.equal(isPreviewFrameReady(frame, 9.999, 1), true);
assert.equal(isPreviewFrameReady({ ...frame, seeking: true }, 9.999, 1), false);
assert.equal(isPreviewFrameReady({ ...frame, readyState: 1 }, 9.999, 1), false);
assert.equal(isPreviewFrameReady({ ...frame, videoWidth: 0 }, 9.999, 1), false);
assert.equal(isPreviewFrameReady(frame, 1, 1), false);
