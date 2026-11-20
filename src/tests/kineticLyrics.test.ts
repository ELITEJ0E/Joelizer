import assert from 'node:assert/strict';
import { renderLyricsOverlayFrame } from '../lib/lyricsEngine';
import { LYRIC_VIDEO_TEMPLATES } from '../lib/lyricsTemplates';
import { useLyricsVideoStore } from '../store/useLyricsVideoStore';
import { buildCanonicalProjectJson } from '../lib/projectJsonBuilder';

type Stroke = { text: string; color: string; x: number; y: number };

// Recording context verifies the actual shared canvas renderer without
// depending on an installed graphical browser or GPU in CI.
function recordingCanvas() {
  const strokes: Stroke[] = [];
  const state = { fillStyle: '#fff', shadowColor: '', shadowBlur: 0, globalAlpha: 1, font: '' };
  const stack: (typeof state)[] = [];
  const context = new Proxy(state as typeof state & Record<string, any>, {
    get(target, prop) {
      if (prop === 'save') return () => stack.push({ ...target });
      if (prop === 'restore') return () => Object.assign(target, stack.pop());
      if (prop === 'translate' || prop === 'scale') return () => {};
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 12 });
      if (prop === 'fillText') return (text: string, x: number, y: number) => {
        strokes.push({ text, color: target.fillStyle, x, y });
      };
      return Reflect.get(target, prop);
    }
  });
  return { strokes, context: context as unknown as CanvasRenderingContext2D };
}

useLyricsVideoStore.getState().setAnimationStyle('kinetic');
useLyricsVideoStore.getState().setKineticSettings({ kineticPalette: 'rainbow', kineticIntensity: 1.6 });
const project = await buildCanonicalProjectJson({ skipStaging: true, modeOverride: 'lyrics-video' });
assert.equal(project.lyrics.animationStyle, 'kinetic');
assert.equal(project.lyrics.kineticPalette, 'rainbow');
assert.equal(project.lyrics.kineticIntensity, 1.6);

const lyrics = [
  { id: 'lyric-1', startTime: 0, endTime: 2, text: 'NEON COLOR', words: [
    { word: 'NEON', startTime: 0, endTime: 1 },
    { word: 'COLOR', startTime: 1, endTime: 2 }
  ] },
  { id: 'lyric-2', startTime: 2, endTime: 4, text: 'BEAT POP', words: [
    { word: 'BEAT', startTime: 2, endTime: 3 },
    { word: 'POP', startTime: 3, endTime: 4 }
  ] }
];

function render(time: number, palette: 'rainbow' | 'neon') {
  const canvas = recordingCanvas();
  renderLyricsOverlayFrame(canvas.context, 640, 360, time, lyrics, {
    template: LYRIC_VIDEO_TEMPLATES.vinyl,
    aspectRatio: '16:9', animationStyle: project.lyrics.animationStyle,
    kineticPalette: palette, kineticIntensity: project.lyrics.kineticIntensity,
    visibleLineCount: 2, // Kinetic mode suppresses upcoming-line previews itself.
    elementPositions: { lyrics: { x: 0.5, y: 0.5 } } as any,
    preferElementPosition: true
  });
  return canvas.strokes;
}

assert.deepEqual(render(0.5, 'rainbow'), render(0.5, 'rainbow'), 'same timestamp must produce identical frames');
assert.deepEqual(render(0.5, 'rainbow').map(s => s.text), ['NEON'], 'future words must be absent, not dimmed');
assert.deepEqual(render(1.2, 'rainbow').map(s => s.text), ['NEON', 'COLOR'], 'newly timed word should appear');
assert.notDeepEqual(render(0.5, 'rainbow'), render(1.2, 'rainbow'), 'word activation should animate and recolor');
assert.notDeepEqual(render(0.5, 'rainbow'), render(2.5, 'rainbow'), 'next line should replace text and palette');
assert.notDeepEqual(render(1.2, 'rainbow'), render(1.2, 'neon'), 'palette selection should change rendered colors');
assert.ok(render(1.2, 'rainbow').some(s => s.color.startsWith('#')), 'active words should use palette colors');
useLyricsVideoStore.getState().updateTypographyOverride({ fontSizeScale: 2.2 });
useLyricsVideoStore.getState().setElementPosition('lyrics', { x: 0.35, y: 0.62 });
const resizedProject = await buildCanonicalProjectJson({ skipStaging: true, modeOverride: 'music-video' });
assert.equal(resizedProject.lyrics.fontSizeScale, 2.2, 'MV export should preserve the lyric font size');
assert.deepEqual(resizedProject.elementPositions.lyrics, { x: 0.35, y: 0.62 }, 'MV export should preserve lyric drag position');
console.log('PASS: Kinetic word reveal, deterministic colors, and shared MV/lyrics export sizing and positioning');
