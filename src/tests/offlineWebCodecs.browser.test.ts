import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4174;
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port)], {
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
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('console', msg => { if (msg.type() === 'error') process.stderr.write('Browser console: ' + msg.text() + '\n'); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  for (const mode of ['lyrics-video', 'music-video']) {
    const result = await page.evaluate(async mode => {
      const { OfflineWebCodecsRenderer } = await import('/src/lib/renderers/OfflineWebCodecsRenderer.ts');
      const renderer = new OfflineWebCodecsRenderer();
      const project = {
        version: '1.0', projectName: 'offline-browser-smoke', exportMode: mode,
        width: 320, height: 180, fps: 30, resolution: '360p', aspectRatio: '16:9',
        exportRange: { start: 0, end: 1, duration: 1 },
        audio: { url: null, albumArt: null, title: 'Sample', artist: 'CI', duration: 1 },
        background: { type: 'color', value: '#111111', blurAlbumArt: false },
        lyrics: { lines: [{ id: '1', startTime: 0, endTime: 1, text: 'Test lyrics' }],
          fontFamily: 'Outfit', fontWeight: '700', fontSizeScale: 1,
          textColor: '#fff', activeWordColor: '#fde047', inactiveWordColor: '#aaa',
          glowColor: '#fde047', showContainerPill: true, pillBgColor: '#111',
          animationStyle: 'karaoke' },
        videoClips: mode === 'music-video' ? [
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
      const result = await renderer.render(project, () => {});
      const response = await fetch(result.outputUrl);
      const buffer = await response.arrayBuffer();
      URL.revokeObjectURL(result.outputUrl);
      return Array.from(new Uint8Array(buffer));
    }, mode);
    const path = `/tmp/joelizer-offline-${mode}.mp4`;
    writeFileSync(path, Buffer.from(result));
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error',
      '-show_entries', 'stream=codec_type,duration,nb_frames', '-of', 'json', path], { encoding: 'utf8' }));
    const video = probe.streams.find(s => s.codec_type === 'video');
    assert.ok(video, 'H264 stream missing');
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
}
