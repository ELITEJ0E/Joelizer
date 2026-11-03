import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4174;
// Spawn Vite directly rather than via npx/cmd. Shell wrappers leave orphan
// child processes and keep CI alive long after the browser test has ended.
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
  env: process.env, stdio: 'pipe'
});
let log = '';
server.stdout.on('data', d => { log += String(d); });
server.stderr.on('data', d => { log += String(d); });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) { ready = true; break; } } catch {}
    await sleep(500);
  }
  assert.ok(ready, 'Vite failed to start: ' + log);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('console', msg => { process.stderr.write('Browser ' + msg.type() + ': ' + msg.text() + '\n'); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  const encoderSupport = await page.evaluate(async () => {
    const Encoder = (globalThis as any).VideoEncoder;
    if (!Encoder) return { hasEncoder: false, configs: [] };
    const configs = [];
    for (const codec of ['avc1.64002a', 'avc1.4d002a', 'avc1.42001f', 'avc1.42001e', 'vp09.00.10.08']) {
      for (const options of [
        { hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality', avc: { format: 'avc' } },
        { hardwareAcceleration: 'no-preference', latencyMode: 'realtime' },
        {}
      ]) {
        try {
          const result = await Encoder.isConfigSupported({
            codec, width: 320, height: 180, bitrate: 800000, framerate: 30, ...options
          });
          configs.push({ codec, options, supported: result.supported });
        } catch (error) {
          configs.push({ codec, options, error: String(error) });
        }
      }
    }
    return { hasEncoder: true, configs };
  });
  console.log('Chrome WebCodecs encoder support:', JSON.stringify(encoderSupport));


  const h264 = encoderSupport.configs?.some((probe: any) =>
    probe.codec.startsWith('avc1.') && probe.supported === true);
  if (!h264) {
    console.log('SKIP offline MP4 browser integration: this CI Chrome build has no H.264 VideoEncoder. Server-side MP4 tests still verify exported files.');
  }
  const AACsupported = await page.evaluate(async () => {
    const Audio = (globalThis as any).AudioEncoder;
    if (!Audio) return false;
    try {
      return (await Audio.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 256000 })).supported;
    } catch { return false; }
  });
  const modes = ['lyrics-video', 'music-video', ...(AACsupported ? ['music-video-with-audio'] : [])];
  for (const mode of (h264 ? modes : [])) {
    const result = await page.evaluate(async mode => {
      const modulePath = '/src/lib/renderers/OfflineWebCodecsRenderer.ts';
      const { OfflineWebCodecsRenderer } = await import(/* @vite-ignore */ modulePath);
      const renderer = new OfflineWebCodecsRenderer();
      const project = {
        version: '1.0', projectName: 'offline-browser-smoke', exportMode: mode === 'music-video-with-audio' ? 'music-video' : mode,
        width: 320, height: 180, fps: 30, resolution: '360p', aspectRatio: '16:9',
        exportRange: { start: 0, end: 1, duration: 1 },
        audio: { url: mode === 'music-video-with-audio' ? '/staged/smoke-audio.wav' : null,
          albumArt: null, title: 'Sample', artist: 'CI', duration: 1 },
        background: { type: 'color', value: '#111111', blurAlbumArt: false },
        lyrics: { lines: [{ id: '1', startTime: 0, endTime: 1, text: 'Test lyrics' }],
          fontFamily: 'Outfit', fontWeight: '700', fontSizeScale: 1,
          textColor: '#fff', activeWordColor: '#fde047', inactiveWordColor: '#aaa',
          glowColor: '#fde047', showContainerPill: true, pillBgColor: '#111',
          animationStyle: 'karaoke' },
        videoClips: mode !== 'lyrics-video' ? [
          { id: 'v1', assetId: 'v1', url: '/staged/smoke-video.mp4', type: 'video',
            startTime: 0, endTime: 1, duration: 1, trimStart: 0, trimEnd: 1, effect: 'none', transition: 'cut' }
        ] : [],
        artwork: { style: 'none', animation: 'none', sizeScale: 1 },
        visualizer: { style: 'bars', color: '#00e676', sensitivity: 1, smoothing: 0.5,
          segments: 8, hitResponse: 0.1, glitchIntensity: 0, shakeIntensity: 0,
          showGrain: false, showScanlines: false },
        effects: { showGrain: false, showScanlines: false, glow: false, vignette: false },
        safeArea: false, templateId: 'vinyl'
      };
      let lastLogged = '';
      const result = await Promise.race([
        renderer.render(project, (progress) => {
          const label = progress.stage + ' ' + Math.floor(progress.progress / 10) * 10 + '%';
          if (label !== lastLogged) {
            console.log('Offline MP4 test progress', mode, label, progress.stageMessage);
            lastLogged = label;
          }
        }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Offline WebCodecs render exceeded 90 seconds: check video seek/decode or encoder flush')), 90000))
      ]);
      const response = await fetch(result.outputUrl);
      const buffer = await response.arrayBuffer();
      URL.revokeObjectURL(result.outputUrl);
      return Array.from(new Uint8Array(buffer));
    }, mode);
    const path = join(tmpdir(), `joelizer-offline-${mode}.mp4`);
    writeFileSync(path, Buffer.from(result));
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error',
      '-show_entries', 'stream=codec_type,duration,nb_frames', '-of', 'json', path], { encoding: 'utf8' }));
    const video = probe.streams.find(s => s.codec_type === 'video');
    assert.ok(video, 'H264 stream missing');
    if (mode === 'music-video-with-audio') {
      assert.ok(probe.streams.some(s => s.codec_type === 'audio'), 'AAC track missing from offline MP4');
    }
    assert.equal(Number(video.nb_frames), 30, 'Offline MP4 must have exactly 30 encoded video frames');
    assert.ok(Number(video.duration) >= 0.95, 'Offline MP4 must not be truncated');
    const md5 = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', 'fps=10,scale=80:45', '-f', 'framemd5', '-'],
      { encoding: 'utf8' }).split('\n').filter(line => line && !line.startsWith('#'));
    assert.ok(new Set(md5).size > 1, 'Offline MP4 must contain visibly changing video frames');
    console.log(`Browser WebCodecs ${mode} export passed: ${video.nb_frames} exact frames, ${video.duration}s, ${new Set(md5).size} distinct samples`);
    unlinkSync(path);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  server.stdout.destroy();
  server.stderr.destroy();
}
