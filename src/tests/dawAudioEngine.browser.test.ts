import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4193;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { env: process.env, stdio: 'pipe' });
let output = '';
server.stdout.on('data', value => { output += value; });
server.stderr.on('data', value => { output += value; });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch { /* startup */ }
    await sleep(300);
  }
  assert.ok(ready, 'Vite failed to start: ' + output);
  console.log('Audio test server ready.');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  console.log('Audio test browser launched.');
  const page = await browser.newPage();
  page.on('console', message => { if (message.text().startsWith('Audio PCM:')) console.log(message.text()); });
  page.on('requestfailed', request => console.log('Audio test request failed:', request.url(), request.failure()?.errorText));
  // Test the actual engine modules in isolation from unrelated app startup.
  await page.route(`http://127.0.0.1:${port}/audio-test`, route => route.fulfill({ contentType: 'text/html', body: '<html><body>Audio engine test</body></html>' }));
  await page.goto(`http://127.0.0.1:${port}/audio-test`, { waitUntil: 'domcontentloaded' });
  console.log('Audio test page loaded.');
  // tsx preserves nested function names with this helper when serializing evaluate.
  await page.evaluate('globalThis.__name = (fn) => fn');
  const results = await page.evaluate(async () => {
    const enginePath = '/src/lib/dawAudioEngine.ts';
    const processingPath = '/src/lib/dawAudioProcessing.ts';
    const { DAWAudioEngine } = await import(/* @vite-ignore */ enginePath);
    const { scheduleClipEnvelope, splitClipFades } = await import(/* @vite-ignore */ processingPath);
    console.log('Audio PCM: engine modules loaded');
    const engine = new DAWAudioEngine();
    const rate = 44100;
    const duration = 0.5;
    const urls: string[] = [];
    async function tone(frequency: number) {
      const frames = Math.round(rate * duration);
      const data = new DataView(new ArrayBuffer(44 + frames * 2));
      const str = (offset: number, text: string) => [...text].forEach((char, i) => data.setUint8(offset + i, char.charCodeAt(0)));
      str(0, 'RIFF'); data.setUint32(4, data.byteLength - 8, true); str(8, 'WAVEfmt ');
      data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
      data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true);
      data.setUint16(32, 2, true); data.setUint16(34, 16, true); str(36, 'data');
      data.setUint32(40, frames * 2, true);
      for (let i = 0; i < frames; i++) data.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * frequency / rate) * 10000), true);
      const url = URL.createObjectURL(new Blob([data.buffer], { type: 'audio/wav' }));
      urls.push(url);
      await engine.loadAudioBuffer(url);
      return url;
    }
    function track(url: string) {
      return { id: 't', name: 'Tone', type: 'AUDIO', color: '#fff', volume: 1, pan: 0, muted: false, solo: false, armed: false,
        clips: [{ id: 'c', trackId: 't', name: 'Tone', audioUrl: url, startTime: 0, sourceStart: 0, sourceEnd: duration,
          duration, volume: 1, fadeIn: 0, fadeOut: 0 }] };
    }
    async function render(tracks: any[], master = 1) {
      const blob = await engine.bounceProjectToWav(tracks, duration, rate, master);
      // Read exported PCM directly: decoding via a live context can resample it.
      const pcm = new DataView(await blob.arrayBuffer());
      const values = new Float32Array((pcm.byteLength - 44) / 4);
      for (let i = 0; i < values.length; i++) values[i] = pcm.getInt16(44 + i * 4, true) / 32768;
      return values;
    }
    function rms(values: Float32Array, start = 0.1, end = 0.4) {
      let total = 0; const a = Math.round(start * rate), b = Math.round(end * rate);
      for (let i = a; i < b; i++) total += values[i] ** 2;
      return Math.sqrt(total / (b - a));
    }
    const baseTrack = track(await tone(1000));
    console.log('Audio PCM: source decoded');
    const baseline = rms(await render([baseTrack]));
    console.log('Audio PCM: first mix rendered');
    const masterRatio = rms(await render([baseTrack], 0.5)) / baseline;
    const clipGainRatio = rms(await render([{ ...baseTrack, clips: [{ ...baseTrack.clips[0], volume: 0.4 }] }])) / baseline;
    const muted = rms(await render([{ ...baseTrack, muted: true }]));
    const clipMuted = rms(await render([{ ...baseTrack, clips: [{ ...baseTrack.clips[0], isMuted: true }] }]));
    const soloMuted = rms(await render([baseTrack, { ...baseTrack, id: 'solo', solo: true, muted: true, clips: [] }]));
    const fade = await render([{ ...baseTrack, clips: [{ ...baseTrack.clips[0], fadeIn: 0.1, fadeOut: 0.1 }] }]);
    const flat = await render([baseTrack]);
    const fadeAttackRatio = rms(fade, 0.001, 0.01) / rms(flat, 0.001, 0.01);
    const fadeReleaseRatio = rms(fade, 0.49, 0.499) / rms(flat, 0.49, 0.499);
    const splitErrors: Array<{ at: number; peak: number; rms: number }> = [];
    const fadedClip = { ...baseTrack.clips[0], fadeIn: 0.1, fadeOut: 0.1 };
    for (const at of [0.03, 0.25, 0.47]) {
      const fades = splitClipFades(fadedClip, at);
      const splitMix = await render([{ ...baseTrack, clips: [
        { ...fadedClip, ...fades.left, id: 'left', duration: at, sourceEnd: at },
        { ...fadedClip, ...fades.right, id: 'right', startTime: at, sourceStart: at, duration: duration - at },
      ] }]);
      let peak = 0, squared = 0;
      for (let i = 0; i < fade.length; i++) {
        const error = Math.abs(fade[i] - splitMix[i]); peak = Math.max(peak, error); squared += error ** 2;
      }
      splitErrors.push({ at, peak, rms: Math.sqrt(squared / fade.length) });
    }
    const cuts: Record<string, number> = {};
    for (const [band, frequency] of [['low', 50], ['mid', 1000], ['high', 12000]] as const) {
      const testTrack = track(await tone(frequency));
      const eq = { low: 0, mid: 0, high: 0, [band]: -12 };
      cuts[band] = rms(await render([{ ...testTrack, eq }])) / rms(await render([testTrack]));
    }
    const bypass = rms(await render([{ ...baseTrack, eq: { low: 0, mid: -12, high: 0, bypass: true } }])) / baseline;
    console.log('Audio PCM: EQ and gain mixes rendered');
    await engine.getContext().resume();
    await engine.play(0, [{ ...baseTrack, muted: true, eq: { low: -3, mid: 4, high: 6 } }]);
    await new Promise(resolve => setTimeout(resolve, 60));
    const liveNodes = (engine as any).trackNodes.get('t');
    const live = { low: liveNodes.eq.low.gain.value, mid: liveNodes.eq.mid.gain.value,
      high: liveNodes.eq.high.gain.value, mutedGain: liveNodes.gain.gain.value };
    engine.stop();
    const initialMasterEngine = new DAWAudioEngine();
    initialMasterEngine.setMasterVolume(0.25); initialMasterEngine.getContext();
    const initialMaster = (initialMasterEngine as any).masterGain.gain.value;
    // Exercise the same gain automation used by live playback while seeking into a fade.
    const offline = new OfflineAudioContext(1, Math.round(0.1 * rate), rate);
    const constant = offline.createConstantSource(); constant.offset.value = 1;
    const gain = offline.createGain(); constant.connect(gain); gain.connect(offline.destination);
    scheduleClipEnvelope(gain.gain, { ...baseTrack.clips[0], fadeOut: 0.1 }, 0, 0.45);
    constant.start(0); constant.stop(0.05);
    const seekFade = (await offline.startRendering()).getChannelData(0);
    // A paused decode must not reappear in a later playback generation.
    const delayedEngine = new DAWAudioEngine();
    let release!: (buffer: AudioBuffer) => void;
    const decoded = engine.getCachedBuffer(baseTrack.clips[0].audioUrl)!;
    delayedEngine.loadAudioBuffer = () => new Promise<AudioBuffer>(resolve => { release = resolve; });
    await delayedEngine.play(0, [{ ...baseTrack, clips: [{ ...baseTrack.clips[0], audioUrl: 'delayed' }] }]);
    delayedEngine.pause(); await delayedEngine.play(0, []); release(decoded);
    await Promise.resolve();
    const staleSources = (delayedEngine as any).activeSources.size;
    delayedEngine.stop(); engine.stop();
    for (const url of urls) URL.revokeObjectURL(url);
    return { baseline, masterRatio, clipGainRatio, muted, clipMuted, soloMuted, fadeAttackRatio, fadeReleaseRatio, cuts, bypass,
      live, initialMaster, splitErrors,
      seekStart: seekFade[0], seekMiddle: seekFade[Math.round(0.025 * rate)], seekEnd: seekFade[Math.round(0.06 * rate)], staleSources };
  });
  assert.ok(results.baseline > 0.1);
  assert.ok(Math.abs(results.masterRatio - 0.5) < 0.002, JSON.stringify(results));
  assert.ok(Math.abs(results.clipGainRatio - 0.4) < 0.002);
  assert.equal(results.muted, 0); assert.equal(results.clipMuted, 0); assert.equal(results.soloMuted, 0);
  assert.ok(results.fadeAttackRatio < 0.1 && results.fadeReleaseRatio < 0.1);
  for (const ratio of Object.values(results.cuts)) assert.ok(ratio < 0.4 && ratio > 0.2, JSON.stringify(results.cuts));
  assert.ok(Math.abs(results.bypass - 1) < 0.002);
  assert.ok(Math.abs(results.seekStart - 0.5) < 0.002 && Math.abs(results.seekMiddle - 0.25) < 0.002);
  assert.equal(results.seekEnd, 0);
  assert.equal(results.staleSources, 0);
  assert.deepEqual(results.live, { low: -3, mid: 4, high: 6, mutedGain: 0 });
  assert.equal(results.initialMaster, 0.25);
  for (const error of results.splitErrors) assert.ok(error.peak < 0.0002 && error.rms < 0.00005, 'Split must preserve original PCM: ' + JSON.stringify(error));
  console.log('DAW real Web Audio PCM: gains, mute/solo, EQ/bypass, fades/seeks, split continuity inside attack/plateau/release and stale decode cancellation passed.');
} finally {
  await browser?.close();
  server.kill();
  // Windows esbuild descendants may retain Vite's inherited pipe handles.
  server.stdin.destroy(); server.stdout.destroy(); server.stderr.destroy();
  server.unref();
}
