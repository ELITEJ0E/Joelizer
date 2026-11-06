import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const port = 4197;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env: process.env, stdio: 'pipe' });
let output = '';
server.stdout.on('data', value => { output += value; });
server.stderr.on('data', value => { output += value; });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
const outputDirectory = resolve(process.cwd(), '..', 'outputs');
const wav = Buffer.alloc(44 + 16000 * 8 * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < 16000 * 8; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 440 / 16000) * 12000 * (.15 + .85 * Math.exp(-(i % 8000) / 1600))), 44 + i * 2);
const state = () => page!.evaluate(() => {
  const s = (window as any).__daw.getState();
  return { markers: s.markers, time: s.currentTime, tracks: s.tracks, historyIndex: s.historyIndex, historyLength: s.history.length,
    loopStart: s.loopStart, loopEnd: s.loopEnd, isLooping: s.isLooping, selected: s.selectedClipId };
});
const closePanels = async () => {
  const library = page!.getByRole('button', { name: 'Collapse instrument browser', exact: true });
  if (await library.count()) await library.click();
  const inspector = page!.getByRole('button', { name: 'Inspector', exact: true });
  if (await inspector.getAttribute('aria-expanded') === 'true') await inspector.click();
};
const commitField = async (label: string, value: string) => {
  const field = page!.getByLabel(label, { exact: true }); await field.fill(value); await field.press('Enter');
};
async function dragClip(delta: number) {
  const clip = page!.getByTestId('daw-clip').first();
  await clip.scrollIntoViewIfNeeded();
  const box = await clip.boundingBox(); assert.ok(box);
  await page!.mouse.move(box.x + 35, box.y + 45); await page!.mouse.down();
  await page!.mouse.move(box.x + 35 + delta, box.y + 45, { steps: 7 }); await page!.mouse.up();
}
async function verifySplitFadeOverlay() {
  const saved = await page!.evaluate(() => (window as any).__daw.getState().getCanonicalProjectJson());
  try {
    await page!.evaluate(() => {
      const s = (window as any).__daw.getState(); const clip = s.tracks[0].clips[0];
      s.editClip(clip.id, { fadeIn: 2, fadeOut: 1, volume: .65 }); s.splitClip(clip.id, clip.startTime + .5);
    });
    const left = page!.getByTestId('daw-clip').first().getByTestId('clip-fade-envelope');
    await left.waitFor();
    const attackPath = await left.getAttribute('d');
    assert.equal(attackPath, 'M0 0 L0 100 L100 75 L100 0 Z', 'An attack split must end at 25% of the original fade rather than ramping to full gain');
    await page!.evaluate(() => { const s = (window as any).__daw.getState(); s.editClip(s.tracks[0].clips[0].id, { volume: .1 }); });
    assert.equal(await left.getAttribute('d'), attackPath, 'The fade overlay must be independent of clip gain');
    await page!.evaluate(() => {
      const s = (window as any).__daw.getState(); const right = s.tracks[0].clips.at(-1);
      s.splitClip(right.id, s.tracks[0].clips[0].startTime + 3.5);
    });
    const release = page!.getByTestId('daw-clip').last().getByTestId('clip-fade-envelope');
    await release.waitFor();
    assert.equal(await release.getAttribute('d'), 'M0 0 L0 50 L100 100 L100 0 Z', 'A release split must start halfway through the retained fade');
  } finally {
    await page!.evaluate(project => { const s = (window as any).__daw.getState(); s.loadCanonicalProjectJson(project); s.setSelectedClipId(project.tracks[0].clips[0].id); }, saved);
  }
}
async function verifyTransportBoundaries() {
  const saved = await page!.evaluate(() => (window as any).__daw.getState().getCanonicalProjectJson());
  const focusBody = () => page!.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  const transport = () => page!.evaluate(() => {
    const primary = (window as any).__primary.getState(); const daw = (window as any).__daw.getState();
    const audio = [...document.querySelectorAll('audio')].find(element => element.src === primary.audioUrl);
    return { dawPlaying: daw.isPlaying, enginePlaying: (window as any).__dawEngine.isPlaying, globalPlaying: primary.isPlaying,
      dawTime: daw.currentTime, primaryTime: primary.currentTime, primaryIndex: primary.currentTrackIndex, activeTab: primary.activeTab,
      audioPaused: audio?.paused, audioUrl: primary.audioUrl };
  });
  try {
    await page!.evaluate(async () => {
      const storePath = '/src/store/useStore.ts'; const { useStore } = await import(/* @vite-ignore */ storePath);
      const enginePath = '/src/lib/dawAudioEngine.ts'; const { dawAudioEngine } = await import(/* @vite-ignore */ enginePath);
      (window as any).__primary = useStore; (window as any).__dawEngine = dawAudioEngine;
      const s = (window as any).__daw.getState(); s.pause(); if (s.isLooping) s.toggleLoop();
      const url = s.tracks[0].clips[0].audioUrl; const blob = await (await fetch(url)).blob();
      useStore.getState().setAudio(blob, url, 8, null, { name: 'Primary one' });
      const secondUrl = URL.createObjectURL(blob);
      useStore.getState().setAudio(blob, secondUrl, 8, null, { name: 'Primary two' });
      s.seek(0);
    });
    await page!.waitForFunction(() => {
      const primary = (window as any).__primary.getState();
      const audio = [...document.querySelectorAll('audio')].find(element => element.src === primary.audioUrl);
      return audio && audio.readyState >= 2 && audio.paused;
    });
    await focusBody(); await page!.keyboard.press('Space');
    await page!.waitForFunction(() => {
      const primary = (window as any).__primary.getState(); const daw = (window as any).__daw.getState();
      return daw.isPlaying && (window as any).__dawEngine.isPlaying && daw.currentTime > .1 && Math.abs(primary.currentTime - daw.currentTime) < .1;
    });
    let playing = await transport();
    assert.equal(playing.dawPlaying, true); assert.equal(playing.enginePlaying, true); assert.equal(playing.audioPaused, true, 'Primary audio must stay paused while the DAW owns playback');
    assert.ok(Math.abs(playing.primaryTime - playing.dawTime) < .1, 'The primary player must not overwrite the DAW clock');
    await focusBody(); await page!.keyboard.press('Space');
    assert.deepEqual([(await transport()).dawPlaying, (await transport()).enginePlaying, (await transport()).globalPlaying], [false, false, false]);

    await page!.getByRole('button', { name: 'Play playback', exact: true }).click();
    assert.equal((await transport()).enginePlaying, true);
    await page!.getByRole('button', { name: 'Pause playback', exact: true }).press('Space');
    assert.equal((await transport()).enginePlaying, false, 'Space on a focused pause button must activate that button once');
    await page!.getByRole('button', { name: 'Play playback', exact: true }).press('Space');
    assert.equal((await transport()).enginePlaying, true, 'Space must retain native play-button activation');
    await page!.getByRole('button', { name: 'Stop playback', exact: true }).press('Space');
    assert.deepEqual([(await transport()).enginePlaying, (await transport()).dawTime], [false, 0]);

    await page!.evaluate(() => {
      const s = (window as any).__daw.getState(); s.seek(2); s.addMarker('Transport verse'); s.seek(4); s.addMarker('Transport chorus'); s.seek(2);
    });
    const primaryBefore = await transport();
    await focusBody(); await page!.keyboard.press('Shift+ArrowRight');
    assert.equal((await transport()).dawTime, 4); assert.equal((await transport()).primaryIndex, primaryBefore.primaryIndex); assert.equal((await transport()).audioUrl, primaryBefore.audioUrl);
    await page!.keyboard.press('Shift+ArrowLeft'); assert.equal((await transport()).dawTime, 2); assert.equal((await transport()).primaryIndex, primaryBefore.primaryIndex);
    await page!.getByLabel('Time signature', { exact: true }).focus(); await page!.keyboard.press('3');
    assert.equal((await transport()).activeTab, 'daw', 'Typing a time signature must not trigger numeric workspace navigation');
    await page!.evaluate(() => { const s = (window as any).__daw.getState(); s.setLoopRegion(1, 1.125); });
    assert.deepEqual([(await state()).loopStart, (await state()).loopEnd], [1, 1.125], 'Short loop sections must preserve their chosen endpoint');

    for (const tab of ['mv-studio', 'lrc']) {
      await page!.getByLabel('Time signature', { exact: true }).selectOption('4/4');
      await page!.getByRole('button', { name: 'Play playback', exact: true }).click();
      assert.equal((await transport()).enginePlaying, true);
      await page!.locator(`#topbar-tab-${tab}`).click();
      await page!.waitForFunction(expected => {
        const p = (window as any).__primary.getState(); return p.activeTab === expected && !p.isPlaying && !(window as any).__dawEngine.isPlaying;
      }, tab);
      const stopped = await transport(); assert.equal(stopped.dawPlaying, false); assert.equal(stopped.audioPaused, true, 'Leaving the DAW must not start the primary audio player');
      await page!.locator('#topbar-tab-daw').click();
    }
  } finally {
    await page!.evaluate(project => {
      const s = (window as any).__daw.getState(); s.pause(); s.loadCanonicalProjectJson(project);
      (window as any).__primary.getState().setActiveTab('daw');
    }, saved);
  }
}
try {
  await mkdir(outputDirectory, { recursive: true });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Startup */ }
    await sleep(300);
  }
  assert.ok(ready, 'Vite did not start: ' + output);
  console.log('Local preview ready.');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('#topbar-tab-daw').click();
  console.log('Opened Music Studio.');
  const library = page.getByRole('complementary', { name: 'Music Studio sample and instrument browser' });
  await library.waitFor({ state: 'visible' });
  await library.locator('input[type=file]').setInputFiles({ name: 'Arrangement tone.wav', mimeType: 'audio/wav', buffer: wav });
  await library.getByRole('button', { name: 'Insert Arrangement tone.wav', exact: true }).click();
  await page.waitForFunction(async () => {
    const path = '/src/store/useDAWStore.ts'; const { useDAWStore } = await import(/* @vite-ignore */ path);
    (window as any).__daw = useDAWStore;
    return useDAWStore.getState().tracks.some((track: any) => track.clips.some((clip: any) => clip.peaks?.length > 0));
  });
  const initialHistory = await page.evaluate(async () => {
    const path = '/src/store/useDAWStore.ts';
    const { useDAWStore } = await import(/* @vite-ignore */ path); (window as any).__daw = useDAWStore;
    const s = useDAWStore.getState(); const original = s.tracks.flatMap((t: any) => t.clips)[0];
    const enginePath = '/src/lib/dawAudioEngine.ts'; const { dawAudioEngine } = await import(/* @vite-ignore */ enginePath);
    const buffer = await dawAudioEngine.loadAudioBuffer(original.audioUrl);
    const track = { id: 'arrange-track', name: 'Lead sampler', type: 'AUDIO', color: '#14b8a6', volume: .8, pan: 0, muted: false, solo: false, armed: false,
      clips: [{ ...original, peaks: dawAudioEngine.computePeaks(buffer), id: 'arrange-clip', trackId: 'arrange-track', name: 'Lead phrase', startTime: 1, duration: 4, sourceStart: 1, sourceEnd: 5 }] };
    s.newProject(); useDAWStore.getState().commitHistory();
    const afterNew = { index: useDAWStore.getState().historyIndex, length: useDAWStore.getState().history.length };
    s.loadCanonicalProjectJson({ ...s.getCanonicalProjectJson(), name: 'Night drive · arrangement study', duration: 40, bpm: 120, timeSignature: '4/4', markers: [], tracks: [track] });
    useDAWStore.getState().commitHistory();
    useDAWStore.getState().setSelectedClipId('arrange-clip');
    return { afterNew, afterLoad: { index: useDAWStore.getState().historyIndex, length: useDAWStore.getState().history.length } };
  });
  assert.deepEqual(initialHistory, { afterNew: { index: 0, length: 1 }, afterLoad: { index: 0, length: 1 } }, 'A new or loaded project must not gain an empty undo step');
  await page.waitForFunction(() => {
    const s = (window as any).__daw.getState(); return s.history[0].tracks === s.tracks && s.history[0].markers === s.markers;
  });
  await page.evaluate(() => (window as any).__daw.getState().commitHistory());
  assert.deepEqual([(await state()).historyIndex, (await state()).historyLength], [0, 1]);

  if (process.argv.includes('--fade-overlay-only')) {
    await verifySplitFadeOverlay();
    console.log('Split fade overlays verified in the rendered UI: partial attack, partial release and gain independence.');
  } else if (process.argv.includes('--transport-only')) {
    await verifyTransportBoundaries();
    console.log('Transport integration verified: DAW ownership, shared clock, paused primary audio, native button keys, marker navigation, select input, short loops and tab-exit pause.');
  } else {
  // Explicit track selection must replace the old clip's inspector context.
  const otherTrackId = await page.evaluate(() => (window as any).__daw.getState().addTrack('AUDIO', 'Harmony bus'));
  const otherHeader = page.getByTestId('daw-track-header').filter({ hasText: 'Harmony bus' });
  await otherHeader.click({ position: { x: 4, y: 93 } });
  assert.equal((await state()).selected, null, 'Selecting another track must clear the previous clip selection');
  assert.equal(await page.getByRole('region', { name: 'Track equalizer', exact: true }).getByText('Harmony bus', { exact: true }).isVisible(), true);
  await page.evaluate(id => { const s = (window as any).__daw.getState(); s.removeTrack(id); s.setSelectedClipId('arrange-clip'); }, otherTrackId);
  console.log('Imported audio and prepared arrangement.');

  // Public marker controls and keyboard history must affect the same project model.
  await page.evaluate(() => (window as any).__daw.getState().seek(2));
  await page.getByRole('button', { name: 'Add marker at playhead' }).click();
  let before = await state(); assert.equal(before.markers.length, 1); assert.equal(before.markers[0].time, 2);
  await page.getByRole('button', { name: /Go to marker/ }).first().click();
  await commitField('Marker name', 'Intro');
  assert.equal((await state()).markers[0].name, 'Intro');
  await page.getByRole('button', { name: 'Close marker details' }).click();
  await page.evaluate(() => (window as any).__daw.getState().seek(8));
  await page.locator('.music-workstation').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('m');
  assert.equal((await state()).markers.length, 2);
  await page.keyboard.press('Control+z'); assert.equal((await state()).markers.length, 1);
  await page.keyboard.press('Control+Shift+z'); assert.equal((await state()).markers.length, 2);
  await page.getByRole('button', { name: 'Previous marker', exact: true }).click(); assert.equal((await state()).time, 2);
  await page.getByRole('button', { name: 'Next marker', exact: true }).click(); assert.equal((await state()).time, 8);
  await page.getByRole('button', { name: 'Go to marker Intro', exact: true }).click();
  await page.getByRole('button', { name: 'Loop section', exact: true }).click();
  assert.deepEqual([(await state()).loopStart, (await state()).loopEnd], [2, 8]);
  await page.getByRole('button', { name: 'Close marker details' }).click();

  // Inspector commits, repetition and EQ must be reversible and survive portable sessions.
  console.log('Verified marker navigation and history.');
  const inspectorButton = page.getByRole('button', { name: 'Inspector', exact: true });
  if (await inspectorButton.getAttribute('aria-expanded') !== 'true') await inspectorButton.click();
  await commitField('Clip name', 'Neon lead');
  await commitField('Clip gain (%)', '65'); await commitField('Fade in (s)', '.3'); await commitField('Fade out (s)', '.7');
  await page.getByRole('button', { name: 'Mute clip', exact: true }).click();
  let edited = (await state()).tracks[0].clips[0];
  assert.equal(edited.name, 'Neon lead'); assert.equal(edited.volume, .65); assert.equal(edited.fadeIn, .3); assert.equal(edited.fadeOut, .7); assert.equal(edited.isMuted, true);
  await page.getByRole('button', { name: 'Unmute clip', exact: true }).click();
  await page.getByRole('button', { name: 'Loop clip', exact: true }).click();
  assert.deepEqual([(await state()).loopStart, (await state()).loopEnd], [1, 5]);
  await page.getByLabel('Repeat copies').selectOption('3');
  before = await state(); await page.getByRole('button', { name: 'Repeat', exact: true }).click();
  let repeated = await state(); assert.equal(repeated.tracks[0].clips.length, 4); assert.equal(repeated.historyIndex, before.historyIndex + 1);
  assert.deepEqual(repeated.tracks[0].clips.map((c: any) => c.startTime), [1, 5, 9, 13]);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); assert.equal((await state()).tracks[0].clips.length, 1);
  await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click(); assert.equal((await state()).tracks[0].clips.length, 4);
  const low = page.getByLabel('low EQ (dB)', { exact: true }); await low.focus(); await low.press('ArrowRight');
  assert.equal((await state()).tracks[0].eq.low, .5);
  await page.getByRole('button', { name: 'Bypass track EQ', exact: true }).click(); assert.equal((await state()).tracks[0].eq.bypass, true); assert.equal(await low.isDisabled(), true);
  await page.getByRole('button', { name: 'Bypass track EQ', exact: true }).click();
  const archive = await page.evaluate(async () => {
    const path = '/src/lib/musicStudioArchive.ts'; const { exportMusicSession, importMusicSession } = await import(/* @vite-ignore */ path);
    const s = (window as any).__daw.getState(); const blob = await exportMusicSession(s.getCanonicalProjectJson());
    const result = await importMusicSession(blob);
    const data = { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), project: result.project, fileCount: result.fileCount };
    for (const track of result.project.tracks) for (const clip of track.clips) URL.revokeObjectURL(clip.audioUrl);
    return data;
  });
  assert.equal(archive.fileCount, 1); assert.equal(archive.project.markers.length, 2); assert.equal(archive.project.tracks[0].eq.low, .5);
  assert.equal(archive.project.tracks[0].clips[0].fadeOut, .7);
  await page.evaluate(() => (window as any).__daw.getState().newProject());
  await page.evaluate(() => (window as any).__daw.getState().commitHistory());
  assert.deepEqual([(await state()).historyIndex, (await state()).historyLength], [0, 1], 'New-project history stays empty before reopening an archive');
  await page.getByLabel('Open Music Studio session ZIP', { exact: true }).setInputFiles({ name: 'arrangement.zip', mimeType: 'application/zip', buffer: Buffer.from(archive.bytes) });
  await page.getByRole('button', { name: 'Go to marker Intro', exact: true }).waitFor();
  assert.equal((await state()).tracks[0].clips.length, 4); assert.equal((await state()).tracks[0].eq.low, .5);
  await page.waitForFunction(async () => {
    const path = '/src/lib/dawAudioEngine.ts'; const { dawAudioEngine } = await import(/* @vite-ignore */ path);
    const s = (window as any).__daw.getState();
    return s.tracks[0]?.clips.every((clip: any) => dawAudioEngine.getCachedBuffer(clip.audioUrl)?.duration === 8) && s.history[0].tracks === s.tracks && s.history[0].markers === s.markers;
  });
  await page.evaluate(() => { const s = (window as any).__daw.getState(); s.commitHistory(); s.setSelectedClipId('arrange-clip'); });
  assert.deepEqual([(await state()).historyIndex, (await state()).historyLength], [0, 1], 'Automatic audio preload must update the history baseline without an undo step');
  await page.waitForFunction(() => document.querySelector('input[aria-label="Duration (s)"]')?.getAttribute('max') === '7');
  assert.equal(Number(await page.getByLabel('Duration (s)', { exact: true }).getAttribute('max')), 8 - (await state()).tracks[0].clips[0].sourceStart);
  console.log('Verified inspector, EQ and portable session reopen.');

  // Multiple pointer moves are one undoable gesture. Grid values are musical fractions.
  await closePanels();
  await page.evaluate(() => { const s = (window as any).__daw.getState(); s.setSelectedClipId('arrange-clip'); s.setTimelineZoom(70); s.setGridDivision('1/4'); s.setSnapToGrid(true); });
  before = await state(); await dragClip(46);
  let moved = await state(); assert.equal(moved.tracks[0].clips[0].startTime, 1.5); assert.equal(moved.historyIndex, before.historyIndex + 1);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click(); assert.equal((await state()).tracks[0].clips[0].startTime, 1);
  await page.getByLabel('Snap grid division').selectOption('1/8'); await dragClip(46); assert.equal((await state()).tracks[0].clips[0].startTime, 1.75);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await page.getByLabel('Snap grid division').selectOption('off'); await dragClip(46); assert.ok(Math.abs((await state()).tracks[0].clips[0].startTime - (1 + 46 / 70)) < .001);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();

  // Trimming cannot expose negative source time or extend beyond decoded audio.
  const mainClip = page.getByTestId('daw-clip').first();
  const trimEnd = mainClip.getByRole('button', { name: 'Trim end of Neon lead', exact: true });
  const endBox = await trimEnd.boundingBox(); assert.ok(endBox);
  before = await state();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + 40); await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2 + 280, endBox.y + 40, { steps: 8 }); await page.mouse.up();
  let trimmed = (await state()).tracks[0].clips[0];
  assert.equal(trimmed.sourceEnd, 8); assert.equal(trimmed.duration, 7); assert.equal((await state()).historyIndex, before.historyIndex + 1);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  const trimStart = mainClip.getByRole('button', { name: 'Trim start of Neon lead', exact: true });
  const startBox = await trimStart.boundingBox(); assert.ok(startBox);
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 40); await page.mouse.down();
  await page.mouse.move(startBox.x + startBox.width / 2 - 180, startBox.y + 40, { steps: 6 }); await page.mouse.up();
  trimmed = (await state()).tracks[0].clips[0]; assert.equal(trimmed.sourceStart, 0); assert.equal(trimmed.startTime, 0); assert.equal(trimmed.duration, 5);
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();

  // Seeking uses viewport coordinates plus exactly one scroll offset.
  console.log('Verified pointer gestures and snap grids.');
  const scroll = page.getByTestId('daw-timeline-scroll');
  await scroll.evaluate((element: HTMLElement) => { element.scrollLeft = 700; });
  const bounds = await scroll.boundingBox(); assert.ok(bounds);
  await page.mouse.click(bounds.x + 100, bounds.y + 15);
  assert.ok(Math.abs((await state()).time - 800 / 70) < .04, 'Scrolled ruler seek double-counted its scroll position');
  const ruler = page.getByRole('slider', { name: 'Timeline playhead', exact: true });
  await ruler.focus(); await ruler.press('Home'); assert.equal((await state()).time, 0);
  await ruler.press('ArrowRight'); assert.equal((await state()).time, 1);
  await scroll.evaluate((element: HTMLElement) => { element.scrollLeft = 0; });
  const clip = page.getByTestId('daw-clip').first(); await clip.focus(); await clip.press('ArrowRight');
  assert.ok(Math.abs((await state()).tracks[0].clips[0].startTime - 1.1) < .001);

  // Store splits must retain a continuous envelope through attack and release.
  const splitResults = await page.evaluate(async () => {
    const path = '/src/lib/dawAudioProcessing.ts'; const { getClipEnvelope } = await import(/* @vite-ignore */ path);
    const store = (window as any).__daw; const s = store.getState(); const saved = s.getCanonicalProjectJson();
    const source = { ...s.tracks[0].clips[0], fadeIn: 2, fadeOut: 1, fadeEnvelope: undefined };
    try {
      s.editClip(source.id, { fadeIn: 2, fadeOut: 1 });
      s.splitClip(source.id, source.startTime + .5);
      const rightId = store.getState().selectedClipId;
      store.getState().splitClip(rightId, source.startTime + 3.5);
      const pieces = store.getState().tracks[0].clips.filter((clip: any) => clip.id === source.id || clip.id === rightId || clip.id === store.getState().selectedClipId).sort((a: any, b: any) => a.startTime - b.startTime);
      let maxError = 0;
      for (const piece of pieces) for (let i = 0; i <= 30; i++) {
        const local = piece.duration * i / 30;
        maxError = Math.max(maxError, Math.abs(getClipEnvelope(piece, local) - getClipEnvelope(source, piece.startTime - source.startTime + local)));
      }
      const envelopes = pieces.map((clip: any) => clip.fadeEnvelope);
      const finalId = pieces.at(-1).id;
      store.getState().editClip(finalId, { fadeOut: .1 });
      return { pieces: pieces.length, envelopes, maxError, fadeEditCleared: !store.getState().tracks[0].clips.find((clip: any) => clip.id === finalId).fadeEnvelope };
    } finally {
      store.getState().loadCanonicalProjectJson(saved); store.getState().setSelectedClipId(source.id);
    }
  });
  assert.equal(splitResults.pieces, 3); assert.ok(splitResults.envelopes.every(envelope => envelope?.duration === 4));
  assert.deepEqual(splitResults.envelopes.map(envelope => Number(envelope.offset.toFixed(6))), [0, .5, 3.5]);
  assert.ok(splitResults.maxError < 1e-9, `Repeated store splits changed the fade envelope by ${splitResults.maxError}`);
  assert.equal(splitResults.fadeEditCleared, true, 'An explicit fade edit must replace the retained split envelope');
  await verifySplitFadeOverlay();
  console.log('Verified load/preload history, track inspector selection and repeated split envelope metadata.');

  // Final screens and responsive controls stay inside each viewport.
  for (const { width, height } of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height }); await closePanels();
    assert.equal(await page.getByLabel('Tempo (BPM)', { exact: true }).isVisible(), true, `Tempo inaccessible at ${width}`);
    assert.equal(await page.getByLabel('Time signature', { exact: true }).isVisible(), true, `Time signature inaccessible at ${width}`);
    assert.equal(await page.getByLabel('Project key', { exact: true }).isVisible(), true, `Project key inaccessible at ${width}`);
    const metrics = await page.evaluate(() => {
      const toolbar = document.querySelector('.music-workstation .studio-topbar')!;
      const rect = toolbar.getBoundingClientRect();
      return { bodyWidth: document.body.scrollWidth, viewport: innerWidth, toolbar: { x: rect.x, right: rect.right, bottom: rect.bottom },
        controls: [...toolbar.querySelectorAll('button,input,select')].filter((el: HTMLElement) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => { const r = el.getBoundingClientRect(); return { label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent, x: r.x, right: r.right, bottom: r.bottom }; }) };
    });
    assert.ok(metrics.bodyWidth <= metrics.viewport + 1, `Body overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.toolbar.x >= -1 && metrics.toolbar.right <= width + 1);
    assert.ok(metrics.controls.every(c => c.x >= -1 && c.right <= width + 1 && c.bottom < height - 50), `Toolbar control clipped at ${width}: ${JSON.stringify(metrics.controls)}`);
    const timelineBox = await scroll.boundingBox(); assert.ok(timelineBox && timelineBox.height > 120, `Timeline collapsed at ${width}`);
    if (width === 1440) {
      await page.getByRole('button', { name: 'Expand instrument browser' }).click(); await inspectorButton.click();
      await page.getByText(/^Restored /).waitFor({ state: 'hidden', timeout: 15000 });
      await page.screenshot({ path: resolve(outputDirectory, 'studio-desktop.png') }); await closePanels();
    }
    if (width === 390) {
      await page.getByRole('button', { name: 'Expand instrument browser' }).click(); assert.equal(await library.isVisible(), true);
      await inspectorButton.click(); assert.equal(await library.isVisible(), false); assert.equal(await page.getByRole('complementary', { name: 'Clip and track inspector' }).isVisible(), true);
      await inspectorButton.click(); await page.screenshot({ path: resolve(outputDirectory, 'studio-mobile.png') });
    }
  }
  await verifyTransportBoundaries();
  console.log('Arrangement UI verified: markers/history, clip inspector/repeat, EQ, session ZIP round trip, pointer grid/history, scrolled seek, keyboard editing and 390/768/1440 responsive layout.');
  }
  assert.deepEqual(errors, [], 'Studio emitted unhandled browser errors');
} catch (error) {
  await page?.screenshot({ path: resolve(outputDirectory, 'studio-test-failure.png') }).catch(() => {});
  throw error;
} finally { await browser?.close(); server.kill(); }
