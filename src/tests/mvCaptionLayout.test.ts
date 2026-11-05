import assert from 'node:assert/strict';
import { layoutMVCaption, MVCaptionLine, computeFadeOpacity } from '../lib/mvCaptionLayout';

// Approximate visual glyph metrics without a DOM/canvas. These invariants
// must hold across all MV aspect ratios regardless of the browser font.
const measure = (text: string, size: number) =>
  Array.from(text).reduce((sum, char) =>
    sum + (/[\u3400-\u9fff\u3040-\u30ff]/u.test(char) ? 1 : char === ' ' ? 0.28 : 0.6) * size, 0);

const sample: MVCaptionLine = {
  text: 'Golden hours turning into days, we keep finding our way through the stars tonight',
  words: 'Golden hours turning into days we keep finding our way through the stars tonight'
    .split(' ').map((word, i) => ({ word, start: i * 0.2, end: i * 0.2 + 0.19 }))
};

const ratios: Array<[string, number, number]> = [
  ['16:9', 1920, 1080],
  ['9:16', 608, 1080],
  ['1:1', 1080, 1080],
  ['4:5', 864, 1080],
  ['3:4', 810, 1080],
  ['4:3', 1440, 1080]
];
for (const [name, width, height] of ratios) {
  const layout = layoutMVCaption(sample, width, height, measure);
  assert.ok(layout.rows.length > 0, `${name} should render subtitles`);
  assert.ok(layout.boxX >= 0 && layout.boxX + layout.boxWidth <= width,
    `${name} subtitle pill must fit inside video width`);
  assert.ok(layout.boxY >= 0 && layout.boxY + layout.boxHeight <= height,
    `${name} subtitle pill must fit inside video height`);
  for (const row of layout.rows) {
    assert.ok(row.width <= layout.safeWidth + 0.01,
      `${name} wrapped line must not overflow safe content width`);
  }
  assert.equal(layout.rows.flatMap(row => row.fragments).filter(item => item.start !== undefined).length,
    sample.words?.length, `${name} karaoke word timings must survive line wraps`);
  console.log(`${name} responsive captions passed: ${layout.rows.length} lines at ${layout.fontSize}px`);
}

const longUnbroken: MVCaptionLine = { text: 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS12345678901234567890' };
const portrait = layoutMVCaption(longUnbroken, 608, 1080, measure);
assert.ok(portrait.rows.length > 1, 'Long unbroken words must wrap even without spaces');
assert.ok(portrait.rows.every(row => row.width <= portrait.safeWidth + 0.01));
const cjk = layoutMVCaption({ text: '我們一起走過每一個春夏秋冬留下最美好的回憶和心動' }, 608, 1080, measure);
assert.ok(cjk.rows.length > 1, 'Continuous Mandarin lyrics must wrap in portrait videos');
assert.ok(cjk.rows.every(row => row.width <= cjk.safeWidth + 0.01));
console.log('MV responsive caption layout tests passed');


// Boundary regression: a fading lyric must not reappear immediately after
// its end timestamp. The old "post-end trail" restarted opacity at 35%.
for (const easing of ['linear', 'smooth', 'ease'] as const) {
  const justBefore = computeFadeOpacity(1.96, 1, 2, 0.4, 0.4, easing);
  const atEnd = computeFadeOpacity(2, 1, 2, 0.4, 0.4, easing);
  const justAfter = computeFadeOpacity(2.005, 1, 2, 0.4, 0.4, easing);
  assert.ok(justBefore > atEnd, `${easing}: opacity must fade toward zero before end`);
  assert.equal(atEnd, 0, `${easing}: lyric must be invisible at the timestamp end`);
  assert.equal(justAfter, 0, `${easing}: lyric must remain invisible instead of flashing again`);
}
console.log('Lyric fade boundaries remain smooth and non-repeating');
