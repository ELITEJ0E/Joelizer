import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4176;
const server = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { env: process.env, stdio: 'pipe' });
let logs = '';
server.stdout.on('data', data => { logs += String(data); });
server.stderr.on('data', data => { logs += String(data); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; }
    } catch { /* Server is starting. */ }
    await sleep(300);
  }
  assert.ok(ready, 'Vite server did not start: ' + logs);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', err => { console.error('Browser page error:', err.message); });
  page.on('console', message => {
    if (message.type() === 'error') console.error('Browser console error:', message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const modulePath = '/src/store/useStore.ts';
    const { useStore } = await import(/* @vite-ignore */ modulePath);
    useStore.getState().setActiveTab('mv-studio');
  });
  const canvas = page.locator('canvas#visualizer-canvas');
  await canvas.waitFor({ state: 'visible' });

  // All workspaces share the same top-level Export action. MV Studio must
  // not introduce another Export button beneath the navbar.
  const topExport = page.locator('#topbar-export-btn');
  assert.equal(await topExport.count(), 1, 'Global navbar must contain one Export action');
  assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).count(), 1,
    'MV Studio must not duplicate the topbar Export action');
  const topControls = await page.evaluate(() => {
    const controls = ['topbar-export-btn', 'topbar-audio-btn', 'topbar-shortcuts-btn'];
    return controls.map(id => {
      const el = document.getElementById(id)!;
      const style = getComputedStyle(el);
      return { id, height: el.getBoundingClientRect().height, radius: style.borderRadius };
    });
  });
  assert.ok(topControls.every(c => c.height === 32), 'Global toolbar actions must use universal 32px height');
  assert.equal(new Set(topControls.map(c => c.radius)).size, 1,
    'Global toolbar actions must use one shared border radius');
  await topExport.click();
  console.log('Export click diagnostic:', await page.evaluate(() => ({
    button: document.getElementById('topbar-export-btn')?.outerHTML,
    modalCount: document.querySelectorAll('.export-modal-card').length,
    allDialogText: Array.from(document.querySelectorAll('[role="dialog"], .fixed'))
      .map(el => el.textContent?.trim().slice(0, 80)).slice(0, 10)
  })));
  const exportDialog = page.locator('.export-modal-card');
  await exportDialog.waitFor({ state: 'visible' });
  assert.equal(await exportDialog.locator('h2', { hasText: 'Export' }).count(), 1,
    'Global Export control must open the compact export dialog');
  assert.equal(await exportDialog.getByText('Render Engine').count(), 0,
    'Engine diagnostics must not clutter the default dialog');
  assert.equal(await exportDialog.getByText('10s Engine Health Test').count(), 0,
    'Hidden technical tests must not appear in the export flow');
  assert.equal(await exportDialog.getByText('Trim video').count(), 1);
  assert.equal(await exportDialog.getByText('Video type').count(), 1);
  assert.equal(await exportDialog.getByText('Frame rate').count(), 1);
  assert.equal(await exportDialog.getByRole('button', { name: 'Export video' }).count(), 1);
  await exportDialog.getByRole('button', { name: 'Lyrics', exact: true }).click();
  assert.equal(await exportDialog.getByRole('button', { name: 'Download lyrics' }).count(), 1);
  await exportDialog.getByRole('button', { name: 'Audio', exact: true }).click();
  assert.equal(await exportDialog.getByRole('button', { name: 'Download WAV' }).count(), 1);
  await exportDialog.locator('button').first().click();
  await exportDialog.waitFor({ state: 'detached' });


  for (const [name, ratio] of [
    ['16:9', 16/9], ['9:16', 9/16], ['1:1', 1], ['4:5', 4/5], ['3:4', 3/4], ['4:3', 4/3]
  ] as const) {
    await page.evaluate(async aspect => {
      const path = '/src/store/useStore.ts';
      const { useStore } = await import(/* @vite-ignore */ path);
      useStore.getState().setAspectRatio(aspect);
    }, name);
    await page.waitForTimeout(140);
    const bounds = await canvas.boundingBox();
    assert.ok(bounds && bounds.width > 30 && bounds.height > 30,
      `${name}: canvas must be visible and occupy a real video surface`);
    assert.ok(Math.abs(bounds.width / bounds.height - ratio) < 0.035,
      `${name}: preview must not be stretched (actual ratio ${bounds.width / bounds.height})`);
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 1440 &&
      bounds.y + bounds.height <= 900, `${name}: preview must fit inside desktop viewport`);
    console.log(`Desktop ${name} preview contained: ${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
  }

  // Move near the canvas edge rather than its center, where the intentionally
  // interactive playback overlay receives pointer events.
  const hoverBounds = await canvas.boundingBox();
  assert.ok(hoverBounds);
  await page.mouse.move(hoverBounds.x + 12, hoverBounds.y + 12);
  await page.waitForTimeout(200);
  const play = page.locator('button[aria-label="Play video"], button[aria-label="Pause video"]');
  assert.equal(await play.count(), 1);
  assert.equal(await play.evaluate(el => getComputedStyle(el).pointerEvents), 'auto',
    'Transport should be operable while hovering the actual video');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
  assert.equal(await play.evaluate(el => getComputedStyle(el).pointerEvents), 'none',
    'Transport should not be active when pointer leaves video surface');

  const importButton = page.getByRole('button', { name: 'Import Media', exact: true }).first();
  await importButton.click();
  const dialog = page.getByRole('dialog', { name: 'Import local media' });
  await dialog.waitFor();
  const modalState = await dialog.evaluate(el => ({
    portaled: el.parentElement?.parentElement === document.body,
    z: Number(getComputedStyle(el.parentElement!).zIndex),
    rect: el.getBoundingClientRect().toJSON(),
    overlayIntersectsTimeline: !!document.elementFromPoint(window.innerWidth - 15, window.innerHeight - 70)?.closest('[data-mv-dialog]')
  }));
  assert.ok(modalState.portaled, 'Import dialog must be portaled outside sidebar stacking context');
  assert.ok(modalState.z >= 1000, 'Import dialog must appear above timeline and preview');
  assert.ok(modalState.overlayIntersectsTimeline, 'Backdrop must block click-through to timeline');
  assert.ok(modalState.rect.left >= 0 && modalState.rect.right <= 1440,
    'Import dialog must fit desktop width');
  assert.equal(await play.evaluate(el => getComputedStyle(el).pointerEvents), 'none',
    'Transport must never become active behind an import dialog');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 375, height: 740 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('navigation', { name: 'Music video tools' }).getByRole('button', { name: 'Media', exact: true }).click();
  await page.getByRole('button', { name: 'Import Media', exact: true }).first().click();
  const mobileDialog = page.getByRole('dialog', { name: 'Import local media' });
  await mobileDialog.waitFor();
  const mobileRect = await mobileDialog.boundingBox();
  assert.ok(mobileRect && mobileRect.x >= 0 && mobileRect.x + mobileRect.width <= 375,
    'Import modal must remain within 375px mobile viewport');
  assert.ok(mobileRect.y >= 0 && mobileRect.y + mobileRect.height <= 740,
    'Import modal must remain vertically scrollable within mobile viewport');
  const buttons = await mobileDialog.getByRole('button', { name: /Choose Files|Choose Folder/ }).count();
  assert.equal(buttons, 2, 'Mobile media import must offer both file and folder choices');
  await page.keyboard.press('Escape');
  await mobileDialog.waitFor({ state: 'detached' });
  console.log('MV Studio desktop/mobile preview, hover controls, stacking and import dialog tests passed');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  server.stdout.destroy();
  server.stderr.destroy();
}
