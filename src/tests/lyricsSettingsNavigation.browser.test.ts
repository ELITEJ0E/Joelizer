import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4199;
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { env: process.env, stdio: 'pipe' });
let output = '';
server.stdout.on('data', data => { output += String(data); });
server.stderr.on('data', data => { output += String(data); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

try {
  let ready = false;
  for (let n = 0; n < 70; n++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  assert.ok(ready, 'Vite server did not start: ' + output);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const modulePath = '/src/store/useStore.ts';
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    useStore.getState().setActiveTab('lyrics');
  });
  await page.getByRole('button', { name: 'Advanced Settings', exact: true }).click();

  const tabs = page.getByRole('tablist', { name: 'Advanced video controls' });
  await tabs.waitFor({ state: 'visible' });
  assert.equal(await tabs.getByRole('tab').count(), 5,
    'Visualizer, Vinyl/Lyrics, Background, Overlay FX and Watermark share one strip');
  assert.equal(await page.locator('text=Browse backdrops').count(), 0,
    'Remove the old separate backdrop browser bar');

  const barHeight = await tabs.evaluate(el => el.closest('nav')?.getBoundingClientRect().height ?? 0);
  assert.ok(barHeight <= 38, 'Advanced settings tabs must use a compact single-line bar');
  assert.equal(await page.getByRole('button', { name: 'Scroll settings tabs right' }).count(), 0,
    'Remove the tall scroll arrows');
  const initialX = await tabs.evaluate(el => el.scrollLeft);
  await tabs.hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(150);
  const afterWheelX = await tabs.evaluate(el => el.scrollLeft);
  assert.ok(afterWheelX > initialX, 'Mouse wheel must scroll the compact tabs without a trackpad');

  await tabs.getByRole('tab', { name: 'Overlay FX' }).click();
  const effects = page.getByRole('region', { name: 'Overlay effects' });
  await effects.waitFor({ state: 'visible' });
  assert.equal(await effects.getByRole('button', { name: 'Film Grain' }).count(), 1,
    'Overlay selection must show the choices directly, without a redundant expand step');
  await effects.getByRole('button', { name: 'Film Grain' }).click();
  const chosen = await page.evaluate(async () => {
    const modulePath = '/src/store/useOverlayEffectsStore.ts';
    const { useOverlayEffectsStore } = await import(/* @vite-ignore */ modulePath);
    return useOverlayEffectsStore.getState().lyrics.effect;
  });
  assert.equal(chosen, 'film-grain', 'Overlay selection must update the existing store');
  assert.equal(await page.getByRole('tab', { name: 'Overlay FX' }).getAttribute('aria-selected'), 'true');

  await page.getByRole('button', { name: 'Quick Design', exact: true }).click();
  const backgrounds = page.locator('[aria-label="Background presets, scroll horizontally"]:visible');
  const bounds = await backgrounds.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollbarWidth: getComputedStyle(el).scrollbarWidth
  }));
  assert.ok(bounds.scrollWidth > bounds.clientWidth, 'Backdrop carousel must remain horizontally browsable');
  assert.equal(bounds.scrollbarWidth, 'thin', 'Backdrop carousel should have a subtle scrollbar');
  assert.equal(await page.getByRole('button', { name: 'Scroll backgrounds right' }).count(), 0,
    'Background gallery must not add another button toolbar');
  console.log('Compact Lyrics Studio tabs, mouse-wheel navigation, overlay controls, and subtle background scrolling passed');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
