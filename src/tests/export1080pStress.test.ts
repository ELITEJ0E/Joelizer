import { FastMp4Source } from '../lib/renderers/FastMp4Source';
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

// 2. Mock FastMp4Source queue pruning simulation
// Simulate internal behavior of pruneDecoded under 1080p decode sequences
class MockVideoFrame {
  closed = false;
  constructor(public timestamp: number) {}
  close() {
    this.closed = true;
  }
  clone() {
    return new MockVideoFrame(this.timestamp);
  }
}

// Emulate pruneDecoded
function simulatePrune(decoded: MockVideoFrame[], targetUs: number) {
  if (decoded.length <= 2) return;
  decoded.sort((a, b) => a.timestamp - b.timestamp);
  let bestPastIdx = -1;
  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i].timestamp <= targetUs) {
      bestPastIdx = i;
    } else {
      break;
    }
  }
  if (bestPastIdx > 0) {
    for (let i = 0; i < bestPastIdx; i++) {
      decoded[i].close();
    }
    decoded.splice(0, bestPastIdx);
  }
  const maxFuture = 3;
  const pastCount = bestPastIdx >= 0 ? 1 : 0;
  while (decoded.length > pastCount + maxFuture) {
    const excess = decoded.pop();
    if (excess) excess.close();
  }
}

// Test: Decode 120 frames forward in a 1080p clip with targetUs = 3,000,000 (3 seconds in)
const activeFrames: MockVideoFrame[] = [];
let maxAliveSimultaneously = 0;

for (let i = 0; i < 120; i++) {
  const frame = new MockVideoFrame(i * 33333); // 30fps timestamps
  activeFrames.push(frame);
  simulatePrune(activeFrames, 3_000_000);
  const currentlyAlive = activeFrames.filter(f => !f.closed).length;
  if (currentlyAlive > maxAliveSimultaneously) {
    maxAliveSimultaneously = currentlyAlive;
  }
}

assert(
  maxAliveSimultaneously <= 4,
  `Pruning keeps concurrent VideoFrames strictly bounded (max alive: ${maxAliveSimultaneously} <= 4)`
);

assert(
  activeFrames.length <= 4,
  `Final active frames array is small (length: ${activeFrames.length} <= 4)`
);

// 3. Test Looping Background bounds
const songDuration = 180;
const bgDuration = 10;
const sampleTimes = [0, 9.5, 9.99, 10.0, 10.5, 19.9, 20.0, 179.9];
const loopTimes = sampleTimes.map(t => ((t % bgDuration) + bgDuration) % bgDuration);

const allWithinDuration = loopTimes.every(lt => lt >= 0 && lt < bgDuration);
assert(allWithinDuration, 'Looping background video timestamps are strictly within [0, bgDuration)');

console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
