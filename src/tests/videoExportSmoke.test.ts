import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { startExportJob, getExportJob } from '../../server/renderEngine';
import { defaultSampleProjectJson } from '../remotion/Root';
import type { CanonicalProjectJson } from '../types/projectJson';

async function renderAndValidate(mode: 'lyrics-video' | 'music-video') {
  const project: CanonicalProjectJson = {
    ...defaultSampleProjectJson,
    projectName: `Joelizer CI smoke ${mode}`,
    exportMode: mode,
    width: 640,
    height: 360,
    resolution: '360p',
    fps: 30,
    exportRange: { start: 1, end: 4, duration: 3 },
    background: { type: 'color', value: '#08080b', blurAlbumArt: false },
    audio: {
      ...defaultSampleProjectJson.audio,
      url: mode === 'music-video' ? '/staged/smoke-audio.wav' : null,
      albumArt: null
    },
    videoClips: mode === 'music-video' ? [
      {
        id: 'first', assetId: 'first', url: '/staged/smoke-video.mp4',
        type: 'video', startTime: 0, endTime: 2, duration: 2,
        trimStart: 0.25, trimEnd: 2.25, effect: 'none', transition: 'cut'
      },
      {
        id: 'second', assetId: 'second', url: '/staged/smoke-video.mp4',
        type: 'video', startTime: 2, endTime: 5, duration: 3,
        trimStart: 1.2, trimEnd: 4.2, effect: 'none', transition: 'cut'
      }
    ] : []
  };

  const jobId = await startExportJob(project);
  let job = getExportJob(jobId);
  for (let attempt = 0; attempt < 600 && job?.stage !== 'ready' && job?.stage !== 'error'; attempt++) {
    await delay(500);
    job = getExportJob(jobId);
  }
  assert.ok(job, 'render job must exist');
  assert.equal(job.stage, 'ready', `${mode} render failed: ${job.error || job.stageMessage}`);
  assert.ok(job.outputFile && fs.existsSync(job.outputFile), 'final video must exist');

  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,duration,nb_frames',
    '-show_entries', 'format=duration', '-of', 'json', job.outputFile
  ], { encoding: 'utf8' });
  const metadata = JSON.parse(raw);
  const video = metadata.streams?.find((s: any) => s.codec_type === 'video');
  assert.ok(video, 'MP4 must have a video stream');
  assert.ok(Number(video.duration) >= 2.8, 'MP4 must contain at least 2.8 seconds of video');
  assert.ok(Number(video.nb_frames) >= 85, 'MP4 must contain at least 85 frames');
  if (mode === 'music-video') {
    assert.ok(metadata.streams?.some((s: any) => s.codec_type === 'audio'), 'MV must include audio');
  }

  const frameHashes = execFileSync('ffmpeg', [
    '-v', 'error', '-i', job.outputFile, '-vf', 'fps=1,scale=80:45',
    '-f', 'framemd5', '-'
  ], { encoding: 'utf8' })
    .split('\n').filter(line => line && !line.startsWith('#'))
    .map(line => line.split(',').at(-1)?.trim());
  assert.ok(new Set(frameHashes).size >= 2, `${mode} must contain visibly changing frames (not a frozen frame)`);

  console.log(`${mode} smoke render passed: ${video.nb_frames} frames, ${video.duration}s, ${new Set(frameHashes).size} distinct sampled frames`);
}

await renderAndValidate('lyrics-video');
await renderAndValidate('music-video');
