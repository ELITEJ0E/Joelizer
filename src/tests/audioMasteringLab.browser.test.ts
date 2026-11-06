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
  // Audio Lab is a workspace tab immediately beside MV Studio.
  const adjacent = await page.locator('#topbar-tab-mv-studio').evaluate((mv) =>
    mv.nextElementSibling?.id === 'topbar-tab-audio-lab'
  );
  assert.ok(adjacent, 'Audio Lab should be beside MV Studio in the main navigation');
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
  // Phonk sound engine: generate a cowbell, inspect its WAV download, and
  // verify an edited 16-step loop can be rendered without network services.
  await dialog.getByRole('button', { name: 'Phonk Synth & FX Designer' }).click();
  await dialog.getByRole('button', { name: /808 Cowbell/ }).waitFor();
  await dialog.getByRole('button', { name: 'Generate sound' }).click();
  await dialog.getByRole('button', { name: 'Download 24-bit WAV' }).waitFor({ timeout: 30000 });
  const soundDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download 24-bit WAV' }).click();
  assert.equal((await soundDownload).suggestedFilename(), 'joelizer-drift-phonk-cowbell.wav');
  await dialog.getByRole('button', { name: /16-step beat maker/ }).click();
  await dialog.getByRole('button', { name: 'kick step 1' }).click();
  await dialog.getByLabel('Loop bars').selectOption('1');
  await dialog.getByRole('button', { name: 'Generate beat loop' }).click();
  await dialog.getByText(/joelizer-drift-phonk-beat.wav/).waitFor({ timeout: 30000 });
  const beatDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download 24-bit WAV' }).click();
  assert.equal((await beatDownload).suggestedFilename(), 'joelizer-drift-phonk-beat.wav');
  const packDownload = page.waitForEvent('download', { timeout: 45000 });
  await dialog.getByRole('button', { name: 'Export all 9 FX (ZIP)' }).click();
  assert.equal((await packDownload).suggestedFilename(), 'joelizer-drift-phonk-fx-pack.zip');
  await dialog.getByRole('button', { name: 'Mastering & Comparison' }).click();
  await dialog.getByText('Joelizer-rendered master', { exact: true }).waitFor();
  assert.equal(runtimeErrors.length, 0, 'Audio Lab must not throw browser runtime errors: ' + runtimeErrors.join('; '));
  await dialog.getByRole('button', { name: 'Back to MV Studio' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.locator('#topbar-tab-mv-studio').waitFor({ state: 'visible' });
  console.log('Audio Lab mastering, original phonk one-shots and 16-step beat WAV export verified.');
} finally {
  await browser?.close();
  server.kill();
}
