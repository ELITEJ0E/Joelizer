import assert from 'node:assert/strict';
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
  assert.equal(await browserPane.getByRole('button', { name: 'Samples' }).count(), 1);
  assert.equal(await browserPane.getByRole('button', { name: 'Drums' }).count(), 1);
  assert.equal(await browserPane.getByRole('button', { name: 'Piano' }).count(), 1);

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

  await browserPane.getByRole('button', { name: 'Drums' }).click();
  await browserPane.getByLabel('Kick sample').selectOption({ label: 'synth-example.wav' });
  await browserPane.getByRole('button', { name: 'Render & insert beat' }).click();
  await browserPane.getByText(/Rendered a .* sample-based beat and inserted/i).waitFor({ timeout: 45000 });

  await browserPane.getByRole('button', { name: 'Piano' }).click();
  await browserPane.getByLabel('Piano roll instrument').selectOption({ label: 'synth-example.wav' });
  await browserPane.getByRole('button', { name: 'Piano C5 step 1', exact: true }).click();
  await browserPane.getByRole('button', { name: 'Render piano roll to DAW' }).click();
  await browserPane.getByText('Piano roll rendered and inserted into the multitrack arrangement.').waitFor({ timeout: 45000 });

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
  assert.deepEqual(errors, [], 'Music Studio must have no unhandled browser runtime errors');
  console.log('Music Studio standalone navigation, sample import, drum rack and piano roll verified.');
} finally {
  await browser?.close();
  server.kill();
}
