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
  let usedSlowMp4Fallback = false;
  page.on('console', msg => {
    if (msg.text().includes('Fast MP4 decoder unavailable') ||
        msg.text().includes('Switching stalled clip to browser decoder') ||
        msg.text().includes('Fast background decoder unavailable')) usedSlowMp4Fallback = true;
    process.stderr.write('Browser ' + msg.type() + ': ' + msg.text() + '\n');
  });
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
  const smoothRendererAvailable = await page.evaluate(async () => {
    const rendererPath = '/src/lib/renderers/OfflineWebCodecsRenderer.ts';
    const { OfflineWebCodecsRenderer } = await import(/* @vite-ignore */ rendererPath);
    return new OfflineWebCodecsRenderer().isAvailable();
  });
  console.log('Smooth export engine available for 1080p:', smoothRendererAvailable);


  const h264 = encoderSupport.configs?.some((probe: any) =>
    probe.codec.startsWith('avc1.') && probe.supported === true);
  if (!h264) {
    console.log('SKIP MP4 browser integration: this Chrome build has no H.264 VideoEncoder.');
  } else {
    assert.ok(smoothRendererAvailable, '1080p smooth export must be selectable on supported Chrome platforms');
  }
  const AACsupported = await page.evaluate(async () => {
    const Audio = (globalThis as any).AudioEncoder;
    if (!Audio) return false;
    try {
      return (await Audio.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 256000 })).supported;
    } catch { return false; }
  });
  const opusSupported = await page.evaluate(async () => {
    const Audio = (globalThis as any).AudioEncoder;
    if (!Audio) return false;
    try {
      return (await Audio.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })).supported;
    } catch { return false; }
  });
  const modes = ['lyrics-video', 'music-video', 'lyrics-video-60fps', 'music-video-60fps',
    'lyrics-video-looped-background', 'music-video-custom-blob'];
  if (AACsupported || opusSupported) modes.push('music-video-with-audio', 'music-video-with-audio-long');
  for (const mode of (h264 ? modes : [])) {
    const fps = mode.endsWith('-60fps') ? 60 : 30;
    const duration = mode.endsWith('-long') ? 8 : mode === 'lyrics-video-looped-background' ? 6 : 2;
    const result = await page.evaluate(async ({ mode, fps, duration }) => {
      const modulePath = '/src/lib/renderers/OfflineWebCodecsRenderer.ts';
      const { OfflineWebCodecsRenderer } = await import(/* @vite-ignore */ modulePath);
      const renderer = new OfflineWebCodecsRenderer();
      // Object URLs are how user-imported files are supplied to MV Studio.
      // Test them directly rather than testing only server-side staged URLs.
      const customUrl = mode === 'music-video-custom-blob'
        ? URL.createObjectURL(await (await fetch('/staged/smoke-video.mp4')).blob()) : null;
      const project = {
        version: '1.0', projectName: 'offline-browser-smoke', exportMode: mode.startsWith('lyrics-video') ? 'lyrics-video' : 'music-video',
        width: 320, height: 180, fps, resolution: '360p', aspectRatio: '16:9',
        // Verify timeline export from a nonzero start and clips trimmed from
        // different source-file positions rather than just playing at t=0.
        exportRange: { start: 1, end: 1 + duration, duration },
        audio: { url: mode.startsWith('music-video-with-audio') ? '/staged/smoke-audio.wav' : null,
          albumArt: mode === 'music-video-custom-blob' ? '/staged/nonexistent-album-art.jpg' : null,
          title: 'Sample', artist: 'CI', duration: 1 },
        background: mode === 'lyrics-video-looped-background'
          ? { type: 'video', value: '/staged/smoke-video.mp4', videoUrl: '/staged/smoke-video.mp4', blurAlbumArt: false }
          : { type: 'color', value: '#111111', blurAlbumArt: false },
        lyrics: { lines: [{ id: '1', startTime: 1, endTime: 3, text: 'Test lyrics' }],
          fontFamily: 'Outfit', fontWeight: '700', fontSizeScale: 1,
          textColor: '#fff', activeWordColor: '#fde047', inactiveWordColor: '#aaa',
          glowColor: '#fde047', showContainerPill: true, pillBgColor: '#111',
          animationStyle: 'karaoke' },
        videoClips: !mode.startsWith('lyrics-video') ? [
          { id: 'v1', assetId: 'v1', url: customUrl || '/staged/smoke-video.mp4', type: 'video',
            startTime: 1, endTime: 2, duration: 1, trimStart: 0.25, trimEnd: 1.25, effect: 'none', transition: 'cut' },
          { id: 'v2', assetId: 'v2', url: '/staged/smoke-video.mp4', type: 'video',
            startTime: 2, endTime: 3, duration: 1, trimStart: 2, trimEnd: 3, effect: 'none', transition: 'cut' }
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
      if (customUrl) URL.revokeObjectURL(customUrl);
      return { bytes: Array.from(new Uint8Array(buffer)), format: result.format || 'mp4' };
    }, { mode, fps, duration });
    const path = join(tmpdir(), `joelizer-offline-${mode}.${result.format}`);
    writeFileSync(path, Buffer.from(result.bytes));
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames',
      '-show_entries', 'stream=codec_type,duration,nb_frames,nb_read_frames',
      '-show_entries', 'format=duration', '-of', 'json', path], { encoding: 'utf8' }));
    const video = probe.streams.find(s => s.codec_type === 'video');
    assert.ok(video, 'H264 stream missing');
    if (mode.startsWith('music-video-with-audio')) {
      assert.ok(probe.streams.some(s => s.codec_type === 'audio'), 'Audio track missing from offline export');
      assert.ok(['mp4', 'webm'].includes(result.format), 'Audio must be muxed into a playable container');
    }
    const decodedFrames = Number(video.nb_read_frames || video.nb_frames);
    const totalDuration = Number(video.duration || probe.format?.duration);
    assert.equal(decodedFrames, duration * fps, `Offline export must decode exactly ${duration * fps} frames`);
    assert.ok(totalDuration >= duration - 0.05 && totalDuration <= duration + 0.12,
      'Offline export must not be truncated');
    const md5 = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', 'fps=10,scale=80:45', '-f', 'framemd5', '-'],
      { encoding: 'utf8' }).split('\n').filter(line => line && !line.startsWith('#'));
    assert.ok(new Set(md5).size >= 5, 'Offline export must contain continuously changing video frames');
    if (mode === 'lyrics-video-looped-background') {
      // Background footage is 4 seconds long but the timeline lasts 6.
      // A stale frame or non-looped decode would leave this nearly static.
      assert.ok(new Set(md5).size >= 25,
        'Looping lyrics background must show changing frames, including after the loop boundary');
      console.log('Looping background rendered across its end:', new Set(md5).size, 'distinct frame hashes');
    }
    if (mode.startsWith('music-video') || mode === 'lyrics-video-looped-background') {
      assert.equal(usedSlowMp4Fallback, false,
        'MP4 source must use fast sequential WebCodecs decoding, not slow per-frame HTML seeks');
    }
    if (mode.startsWith('music-video-with-audio')) {
      // Verify decoded audio continuity, not merely presence of an audio
      // stream. The old 1024-sample Opus input created tiny timestamp gaps
      // every packet even though the output container looked valid.
      const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-map', '0:a:0',
        '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 20000000 });
      const samples = new Float32Array(
        pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
      assert.ok(samples.length >= 48000 * (duration - 0.05), 'Audio must cover entire exported time range');
      let silentRun = 0, longestSilentRun = 0;
      for (let i = 48000 / 5; i < Math.min(samples.length - 48000 / 5, 48000 * (duration - 0.2)); i++) {
        if (Math.abs(samples[i]) < 0.00015) {
          silentRun++;
          longestSilentRun = Math.max(longestSilentRun, silentRun);
        } else {
          silentRun = 0;
        }
      }
      assert.ok(longestSilentRun < 100,
        `Decoded sound contains an audible hole of ${longestSilentRun} samples`);
      console.log('Continuous soundtrack verified: longest near-silent gap', longestSilentRun, 'samples');
    }
    console.log(`Browser WebCodecs ${mode} ${result.format} export passed: ${decodedFrames} exact frames, ${totalDuration}s, ${new Set(md5).size} distinct samples`);
    unlinkSync(path);
  }
  if (h264) {
    // A corrupt or unsupported user clip must name the failure, rather than
    // reporting a generic "selected video or image source" with no guidance.
    const errorText = await page.evaluate(async () => {
      const modulePath = '/src/lib/renderers/OfflineFrameCompositor.ts';
      const { OfflineFrameCompositor } = await import(/* @vite-ignore */ modulePath);
      const project = {
        width: 320, height: 180, exportMode: 'music-video',
        exportRange: { start: 0, end: 1, duration: 1 },
        background: { type: 'color', value: '#000' },
        audio: { albumArt: null },
        videoClips: [{ id: 'broken-user-clip', type: 'video',
          url: '/staged/missing-user-file.mp4', startTime: 0, endTime: 1 }]
      };
      const renderer = new OfflineFrameCompositor(project as any);
      try {
        await renderer.prepare();
        return 'unexpected-success';
      } catch (error) {
        return String(error);
      } finally {
        renderer.dispose();
      }
    });
    assert.match(errorText, /broken-user-clip/,
      'A failed imported clip must be identified so users can replace it');
    assert.match(errorText, /H\.264 MP4/,
      'Error must give a supported codec conversion workaround');
    console.log('Invalid imported media receives actionable source-specific error');
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  server.stdout.destroy();
  server.stderr.destroy();
}
