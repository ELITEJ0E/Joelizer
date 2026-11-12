import assert from 'node:assert/strict';
import { parseLRCContent } from '../lib/transcriptionProvider';
import { generateLRC, generateEnhancedLRC, generateSRT, generateASS, generateTXT } from '../lib/lyricExporters';

const original = [
  { id: 'one', text: 'I will always stay', secondaryText: '我会一直陪着你',
    startTime: 12.5, endTime: 16.2 },
  { id: 'two', text: 'Underneath the stars', secondaryText: '在星空下',
    startTime: 16.2, endTime: 20.1 }
];
const lrc = generateLRC(original);
assert.match(lrc, /\[00:12\.50\]I will always stay/);
assert.match(lrc, /\[00:12\.50\]我会一直陪着你/);
const parsed = parseLRCContent(lrc);
assert.equal(parsed.length, 2, 'Same timestamp languages are one synced line');
assert.equal(parsed[0].text, original[0].text);
assert.equal(parsed[0].secondaryText, original[0].secondaryText);
assert.match(generateEnhancedLRC(original), /我会一直陪着你/);
assert.match(generateSRT(original), /I will always stay\n我会一直陪着你/);
assert.match(generateASS(original), /I will always stay\\N我会一直陪着你/);
assert.match(generateTXT(original), /Underneath the stars\n在星空下/);
assert.ok(!generateLRC([{ id: 'solo', text: 'Solo lyric', startTime: 0, endTime: 2 }])
  .includes('undefined'), 'Original-language-only export remains supported');
console.log('Bilingual lyric import and export regression tests passed');
