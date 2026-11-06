import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4184;
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { env: process.env, stdio: 'pipe' });
let output = '';
server.stdout.on('data', value => { output += String(value); });
server.stderr.on('data', value => { output += String(value); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

const sampleRate = 22050;
const count = sampleRate;
const wav = Buffer.alloc(44 + count * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(count * 4, 40);
for (let i = 0; i < count; i++) {
  const s = Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 32767 * 0.45);
  wav.writeInt16LE(s, 44 + i * 4);
  wav.writeInt16LE(s, 44 + i * 4 + 2);
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:' + port + '/')).ok) { ready = true; break; }
    } catch { /* server warmup */ }
    await sleep(300);
  }
  assert.ok(ready, 'Vite did not start: ' + output);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(30000);
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded' });
  // Music Studio now sits between MV Studio and the separate mastering Audio Lab.
  const correctlyOrdered = await page.locator('#topbar-tab-mv-studio').evaluate((mv) =>
    mv.nextElementSibling?.id === 'topbar-tab-daw' &&
    mv.nextElementSibling?.nextElementSibling?.id === 'topbar-tab-audio-lab'
  );
  assert.ok(correctlyOrdered, 'Music Studio must have its own tab before the separate Audio Lab');
  await page.locator('#topbar-tab-audio-lab').click();

  const dialog = page.getByRole('region', { name: 'Joelizer Audio Mastering and Provenance Lab' });
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.getByText('This tool cannot authenticate human authorship', { exact: false }).count(), 1);
  const sourceInput = dialog.locator('input[type="file"]').first();
  await sourceInput.setInputFiles({ name: 'example.wav', mimeType: 'audio/wav', buffer: wav });
  await dialog.getByText('Original', { exact: true }).waitFor();
  await dialog.getByText('22050', { exact: false }).count();
  const blend = dialog.getByRole('slider', { name: /Original \/ processed blend/i });
  await blend.waitFor();
  await blend.fill('65');
  assert.equal(await blend.inputValue(), '65', 'Parallel processing blend control must be adjustable');
  await dialog.getByRole('button', { name: 'Render local master' }).click();
  await dialog.getByRole('button', { name: 'Download WAV' }).waitFor({ timeout: 30000 });
  await dialog.getByText('Joelizer-rendered master', { exact: true }).waitFor();

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download WAV' }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('-joelizer-master.wav'));

  await dialog.getByRole('button', { name: 'Compute file SHA-256' }).click();
  await dialog.getByText('SHA-256:', { exact: false }).waitFor();
  assert.equal(runtimeErrors.length, 0, 'Audio Lab must not throw browser runtime errors: ' + runtimeErrors.join('; '));
  await dialog.getByRole('button', { name: 'Back to MV Studio' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.locator('#topbar-tab-mv-studio').waitFor({ state: 'visible' });
  console.log('Audio Lab mastering, WAV export and provenance verification remain independent from Music Studio.');
} finally {
  await browser?.close();
  server.kill();
}
