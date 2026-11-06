import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { exportMusicSession, importMusicSession } from '../lib/musicStudioArchive';
import type { DAWProject } from '../types/daw';

const bytes = new Uint8Array([82,73,70,70,1,2,3,4,87,65,86,69]);
const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
const project: DAWProject = {
  id: 'session-test', name: 'Portable DAW Test', bpm: 126,
  key: 'C Minor', timeSignature: '4/4', duration: 16,
  masterVolume: 0.85, loopStart: 0, loopEnd: 8, isLooping: false,
  createdAt: 1, updatedAt: 2,
  markers: [{ id:'intro', name:'Intro', time:0, color:'#a78bfa' }],
  tracks: [{
    id: 't1', name: 'Imported Sample', type: 'AUDIO', color: '#00aa77',
    volume: 0.7, pan: 0, muted: false, solo: false, armed: false,
    eq: { low:-3, mid:1, high:2, bypass:false },
    clips: [{
      id: 'c1', trackId: 't1', name: 'Example', audioUrl: url,
      startTime: 1, duration: 2, sourceStart: 0, sourceEnd: 2,
      volume: 1, fadeIn: 0, fadeOut: 0
    }, {
      id: 'c2', trackId: 't1', name: 'Example duplicate', audioUrl: url,
      startTime: 4, duration: 2, sourceStart: 0, sourceEnd: 2,
      volume: 1, fadeIn: 0, fadeOut: 0
    }]
  }]
};
const zipBlob = await exportMusicSession(project);
assert.ok(zipBlob.size > 10);
const unzipped = await JSZip.loadAsync(await zipBlob.arrayBuffer());
const manifest = JSON.parse(await unzipped.file('project.json')!.async('string'));
assert.equal(manifest.version, 1);
assert.equal(manifest.audioAssets, 1, 'Identical source clips should share the same ZIP asset');
assert.equal(manifest.project.tracks[0].clips[0].audioUrl,
  manifest.project.tracks[0].clips[1].audioUrl);
const { project: imported, fileCount } = await importMusicSession(zipBlob);
assert.equal(fileCount, 1);
assert.equal(imported.tracks[0].clips.length, 2);
assert.equal(imported.tracks[0].clips[0].audioUrl, imported.tracks[0].clips[1].audioUrl);
assert.equal(imported.bpm, 126);
assert.deepEqual(imported.markers, project.markers);
assert.deepEqual(imported.tracks[0].eq, project.tracks[0].eq);
const copiedBytes = new Uint8Array(await (await fetch(imported.tracks[0].clips[0].audioUrl)).arrayBuffer());
assert.deepEqual(copiedBytes, bytes);
const malformed = new JSZip();
malformed.file('project.json', JSON.stringify({
  format: 'joelizer-music-session', version: 1,
  project: { ...project, tracks: [
    {...project.tracks[0], clips: [
      {...project.tracks[0].clips[0], audioUrl: '../evil.wav'}
    ]}
  ]}
}));
await assert.rejects(async () => importMusicSession(await awaitZip(malformed)), /unsafe|unsupported/i);
async function awaitZip(archive: JSZip) {
  return archive.generateAsync({type:'blob'});
}
URL.revokeObjectURL(url);
URL.revokeObjectURL(imported.tracks[0].clips[0].audioUrl);
console.log('Portable Music Studio session: deduplication, audio bytes, timeline and path validation passed.');
