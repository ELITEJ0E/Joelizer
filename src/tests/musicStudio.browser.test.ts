import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4187;
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { env: process.env, stdio: 'pipe' });
let output = '';
server.stdout.on('data', value => { output += String(value); });
server.stderr.on('data', value => { output += String(value); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

const sampleRate = 16000;
const count = 8000;
const wav = Buffer.alloc(44 + count * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(count * 4, 40);
for (let i = 0; i < count; i++) {
  const signal = Math.sin(Math.PI * 2 * 220 * i / sampleRate) * 12000;
  wav.writeInt16LE(Math.round(signal), 44 + i * 4);
  wav.writeInt16LE(Math.round(signal), 44 + i * 4 + 2);
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:' + port + '/')).ok) { ready = true; break; } }
    catch { /* Vite startup */ }
    await sleep(300);
  }
  assert.ok(ready, 'Vite server failed to start: ' + output);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(35000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded' });

  await page.locator('#topbar-tab-daw').click();
  const browserPane = page.getByRole('complementary', { name: 'Music Studio sample and instrument browser' });
  await browserPane.waitFor({ state: 'visible' });
  assert.equal(await browserPane.getByRole('button', { name: 'Samples', exact: true }).count(), 1);
  assert.equal(await browserPane.getByRole('button', { name: 'Drums', exact: true }).count(), 1);
  assert.equal(await browserPane.getByRole('button', { name: 'Piano', exact: true }).count(), 1);

  await browserPane.locator('input[type=file]').setInputFiles({
    name: 'synth-example.wav', mimeType: 'audio/wav', buffer: wav
  });
  await browserPane.getByText('synth-example.wav').waitFor();
  await browserPane.getByRole('button', { name: 'Insert synth-example.wav' }).click();

  const state = await page.evaluate(async () => {
    const path = '/src/store/useDAWStore.ts';
    const { useDAWStore } = await import(/* @vite-ignore */ path);
    return useDAWStore.getState().tracks.map((track: { name: string; clips: { name: string }[] }) => ({
      name: track.name, clips: track.clips.length
    }));
  });
  assert.ok(state.some(track => track.name.includes('synth-example') && track.clips > 0),
    'Imported audio must create an editable DAW timeline clip');

  // Verify workstation ergonomics: browser remains mounted when collapsed,
  // inspector writes actual channel DSP settings and mixer can be expanded.
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Music Studio inspector' });
  await inspector.waitFor({ state: 'visible' });
  await inspector.getByRole('slider', { name: 'Low EQ (dB)' }).fill('3');
  await inspector.getByRole('checkbox', { name: 'Channel compressor' }).check();
  await inspector.getByRole('slider', { name: 'Threshold (dB)' }).fill('-24');
  const fxState = await page.evaluate(async () => {
    const path='/src/store/useDAWStore.ts';
    const { useDAWStore } = await import(/* @vite-ignore */ path);
    const state=useDAWStore.getState();
    return state.tracks.find((track:{id:string})=>track.id===state.selectedTrackId)?.fx;
  });
  assert.equal(fxState?.lowShelfDb,3,'EQ slider must change the selected track audio effect');
  assert.equal(fxState?.compressorEnabled,true,'Compressor toggle must change channel processing');
  assert.equal(fxState?.compressorThresholdDb,-24);
  await page.getByRole('button', { name: 'Mixer', exact: true }).click();
  await page.getByText(/Console Mixer \(/).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Mixer', exact: true }).click();
  await page.getByRole('button', { name: 'Browser', exact: true }).click();
  await browserPane.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Browser', exact: true }).click();
  await browserPane.waitFor({ state: 'visible' });
  await browserPane.getByText('synth-example.wav').waitFor();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();

  await browserPane.getByRole('button', { name: 'Drums', exact: true }).click();
  await browserPane.getByLabel('Kick sample').selectOption({ label: 'synth-example.wav' });
  await browserPane.getByRole('button', { name: 'Render & insert beat' }).click();
  await browserPane.getByText(/Rendered a .* sample-based beat and inserted/i).waitFor({ timeout: 45000 });

  await browserPane.getByRole('button', { name: 'Piano', exact: true }).click();
  await browserPane.getByLabel('Piano roll instrument').selectOption({ label: 'synth-example.wav' });
  await browserPane.getByRole('button', { name: 'Piano C4 step 1', exact: true }).click();
  await browserPane.getByRole('button', { name: 'Render piano roll to DAW' }).click();
  await browserPane.getByText('Piano roll rendered and inserted into the multitrack arrangement.').waitFor({ timeout: 45000 });

  await browserPane.getByRole('button', { name: 'Synth', exact: true }).click();
  await browserPane.getByRole('button', { name: /808 Cowbell/ }).waitFor();
  await browserPane.getByRole('button', { name: 'Generate sound', exact: true }).click();
  await browserPane.getByRole('button', { name: 'Insert on DAW timeline' }).waitFor({ timeout: 35000 });
  await browserPane.getByRole('button', { name: 'Insert on DAW timeline' }).click();

  const final = await page.evaluate(async () => {
    const path = '/src/store/useDAWStore.ts';
    const { useDAWStore } = await import(/* @vite-ignore */ path);
    return useDAWStore.getState().tracks.filter((track: {clips: unknown[]}) => track.clips.length > 0).map(
      (track: { name: string; type: string }) => ({ name: track.name, type: track.type })
    );
  });
  assert.ok(final.some(track => track.type === 'DRUMS'));
  assert.ok(final.some(track => track.type === 'SYNTH'));
  assert.ok(final.some(track => track.type === 'AUDIO'));
  // Export a real session to disk. The new bounce must be a 24-bit WAV and
  // must not include the default 3 minutes of empty DAW canvas.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const masterDownload = page.waitForEvent('download', { timeout: 45000 });
  await page.getByRole('button', { name: 'Export 24-bit WAV' }).click();
  const wavDownload = await masterDownload;
  assert.ok(wavDownload.suggestedFilename().endsWith('_Master.wav'));
  const renderBytes = await readFile(await wavDownload.path());
  assert.equal(renderBytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(renderBytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(renderBytes.readUInt16LE(34), 24, 'Master WAV must export 24-bit PCM');
  assert.ok(renderBytes.length < 10_000_000, 'Short DAW session must not export minutes of silence');
  assert.deepEqual(errors, [], 'Music Studio must have no unhandled browser runtime errors');
  console.log('Music Studio standalone navigation, sample import, drum rack and piano roll verified.');
} finally {
  await browser?.close();
  server.kill();
}
