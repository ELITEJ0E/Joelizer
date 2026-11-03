import assert from 'node:assert/strict';
import {
  getBrowserExportTime, sampleBrowserExportVideo,
  startBrowserExportClock, stopBrowserExportClock, validateBrowserExportVideo
} from '../lib/browserExportClock';

function run() {
  assert.equal(getBrowserExportTime(), null);
  startBrowserExportClock(5);
  const now = getBrowserExportTime();
  assert.ok(now !== null && now >= 5 && now < 5.5, 'export clock respects nonzero timeline start');

  sampleBrowserExportVideo('clip-a', 3);
  sampleBrowserExportVideo('clip-a', 4);
  validateBrowserExportVideo([{ id: 'clip-a', type: 'video', startTime: 5, endTime: 8 }], 5, 8);

  assert.throws(
    () => validateBrowserExportVideo([{ id: 'missing', type: 'video', startTime: 5, endTime: 8 }], 5, 8),
    /no decodable frames/
  );

  sampleBrowserExportVideo('frozen', 1.25);
  sampleBrowserExportVideo('frozen', 1.25);
  assert.throws(
    () => validateBrowserExportVideo([{ id: 'frozen', type: 'video', startTime: 5, endTime: 8 }], 5, 8),
    /did not advance/
  );

  // Static images need no video-time advancement checks.
  validateBrowserExportVideo([{ id: 'img', type: 'image', startTime: 5, endTime: 8 }], 5, 8);
  // Clips entirely outside the selected range must not trigger a false failure.
  validateBrowserExportVideo([{ id: 'missing', type: 'video', startTime: 0, endTime: 2 }], 5, 8);

  stopBrowserExportClock();
  assert.equal(getBrowserExportTime(), null);
  console.log('browser export clock tests passed');
}

run();
