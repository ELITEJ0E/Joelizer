import assert from 'node:assert/strict';
import { useMVStore, isAutoManagedClip, TimelineClip } from '../store/useMVStore';
import { generateAutoEdit } from '../lib/mvAutoEdit';

const sample = (id: string, startTime: number, endTime: number): TimelineClip => ({
  id, assetId: 'still', type: 'image', startTime, endTime,
  trimStart: 0, trimEnd: endTime - startTime, transition: 'crossfade'
});

const store = useMVStore.getState();
assert.equal(isAutoManagedClip(sample('clip-gen-legacy', 0, 2)), false,
  'Older clips must be protected because their editing history is unknown');
useMVStore.setState({
  timelineClips: [
    { ...sample('clip-gen-old-1', 0, 3), editOrigin: 'auto' },
    { ...sample('clip-gen-old-2', 3, 6), editOrigin: 'auto' },
    { ...sample('hand-placed', 6, 8), editOrigin: 'manual', zoom: 1.7 }
  ]
});
store.updateTimelineClip('clip-gen-old-1', { offsetX: 0.7, zoom: 1.25 });
const edited = useMVStore.getState().timelineClips.find(c => c.id === 'clip-gen-old-1')!;
assert.equal(edited.manuallyEdited, true, 'Moving a generated clip should automatically protect it');
assert.equal(isAutoManagedClip(edited), false);
assert.equal(isAutoManagedClip(useMVStore.getState().timelineClips.find(c => c.id === 'clip-gen-old-2')!), true);

const manualBefore = JSON.stringify(useMVStore.getState().timelineClips.filter(c => !isAutoManagedClip(c)));
const anchors = useMVStore.getState().timelineClips.filter(c => !isAutoManagedClip(c)).map(c => ({ ...c, locked: true }));
const output = generateAutoEdit({
  songDuration: 12, lyricsLines: [], mediaAssets: [
    { id: 'still', name: 'Still', type: 'image', url: '/still.jpg', duration: 20, thumbnail: '', status: 'ready' }
  ],
  style: 'Cinematic', pacing: 'Balanced', beatSync: 'Strong',
  seed: 43, existingClips: anchors
});
store.applyAutoEditClips(output.timelineClips.filter(c => !anchors.some(a => a.id === c.id)));
const after = useMVStore.getState().timelineClips;
assert.equal(JSON.stringify(after.filter(c => !isAutoManagedClip(c))), manualBefore,
  'Re-run must leave protected clips byte-for-byte unchanged');
assert.ok(after.some(c => isAutoManagedClip(c)), 'Auto-generated clips should remain editable by future auto runs');
const ordered = [...after].sort((a, b) => a.startTime - b.startTime);
for (let i = 1; i < ordered.length; i++)
  assert.ok(ordered[i].startTime >= ordered[i - 1].endTime - 0.0001, 'No overlaps');

const newAuto = after.find(c => isAutoManagedClip(c))!;
store.setClipAutoManaged(newAuto.id, false);
assert.equal(isAutoManagedClip(useMVStore.getState().timelineClips.find(c => c.id === newAuto.id)!), false,
  'Protect button must remove a clip from future Auto Edit regeneration');
store.setClipAutoManaged(newAuto.id, true);
assert.equal(isAutoManagedClip(useMVStore.getState().timelineClips.find(c => c.id === newAuto.id)!), true,
  'Users can explicitly give an unedited clip back to Auto Edit');
store.toggleLockClip(newAuto.id);
assert.equal(isAutoManagedClip(useMVStore.getState().timelineClips.find(c => c.id === newAuto.id)!), false,
  'Manually locked clips must remain protected even if later unlocked');
store.toggleLockClip(newAuto.id);
assert.equal(isAutoManagedClip(useMVStore.getState().timelineClips.find(c => c.id === newAuto.id)!), false);
console.log('MV protected auto edit regression tests passed');
