import { pruneConsumedVideoFrames } from '../lib/renderers/FastMp4Source';
import { getResolutionDimensions } from '../types/projectJson';

console.log('====================================================');
console.log('  1080P / 720P EXPORT PIPELINE & MEMORY AUDIT       ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

// 1. Resolution Dimension Checks for 1080p and 720p (even parity for H.264 4:2:0)
const res1080p169 = getResolutionDimensions('16:9', '1080p');
assert(res1080p169.width === 1920 && res1080p169.height === 1080, '1080p 16:9 dimensions are 1920x1080');

const res720p169 = getResolutionDimensions('16:9', '720p');
assert(res720p169.width === 1280 && res720p169.height === 720, '720p 16:9 dimensions are 1280x720');

const res1080p916 = getResolutionDimensions('9:16', '1080p');
assert(res1080p916.width === 1080 && res1080p916.height === 1920, '1080p 9:16 dimensions are 1080x1920');

const res720p916 = getResolutionDimensions('9:16', '720p');
assert(res720p916.width % 2 === 0 && res720p916.height % 2 === 0, '720p 9:16 dimensions are even numbers for H.264');

// 2. Test production pruning logic, including out-of-order H.264 frame output.
// A decoder may emit B-frames ahead of the current export timestamp. Those
// future frames must never be discarded just to enforce a small GPU pool size.
class MockVideoFrame {
  closed = false;
  constructor(public timestamp: number) {}
  close() { this.closed = true; }
}

const decoded = [0, 33_333, 66_666, 100_000, 133_333, 166_666]
  .map(t => new MockVideoFrame(t));
pruneConsumedVideoFrames(decoded, 40_000);
assert(decoded[0].timestamp === 33_333, 'Keep most recent frame at or before current time');
assert(decoded.length === 5, 'Keep all decoded future frames for subsequent export timestamps');
assert(decoded.every(frame => !frame.closed), 'All retained frames remain open');

// Rendering the next time step must advance to the next decoded source frame.
pruneConsumedVideoFrames(decoded, 70_000);
assert(decoded[0].timestamp === 66_666, 'Subsequent output advances to next source frame without skipping');
assert(decoded.slice(1).every(frame => frame.timestamp > 70_000),
  'Future presentation timestamps remain intact');

// With many decoded frames ahead of the playhead, it is safer to retain them
// than to silently skip footage. Decoder submission uses separate backpressure.
const future = Array.from({ length: 12 }, (_, i) => new MockVideoFrame(1_000_000 + i * 33_333));
pruneConsumedVideoFrames(future, 990_000);
assert(future.length === 12, 'Pruning does not delete future frames under memory pressure');
assert(future.every(frame => !frame.closed), 'Every future frame remains available');
const past = new MockVideoFrame(900_000);
future.unshift(past);
pruneConsumedVideoFrames(future, 1_050_000);
assert(past.closed, 'Obsolete past frame resources are closed');
assert(future[0].timestamp === 1_033_333, 'Closest earlier frame is retained');

// 3. Test Looping Background bounds
const songDuration = 180;
const bgDuration = 10;
const sampleTimes = [0, 9.5, 9.99, 10.0, 10.5, 19.9, 20.0, 179.9];
const loopTimes = sampleTimes.map(t => ((t % bgDuration) + bgDuration) % bgDuration);

const allWithinDuration = loopTimes.every(lt => lt >= 0 && lt < bgDuration);
assert(allWithinDuration, 'Looping background video timestamps are strictly within [0, bgDuration)');

console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
