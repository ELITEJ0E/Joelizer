import React from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { KINETIC_MOTION_STYLES, normalizeKineticMotion } from '../../lib/lyricsMotion';
export function KineticMotionSelect() {
  const motion = useLyricsVideoStore(s => s.kineticMotion);
  const update = useLyricsVideoStore(s => s.setKineticSettings);
  return (
    <label className="block space-y-1 text-[10px] text-[#aeb8c5]">
      <span>Word animation</span>
      <select aria-label="Kinetic word animation" value={normalizeKineticMotion(motion)}
        onChange={e => update({ kineticMotion: normalizeKineticMotion(e.target.value) })}
        className="w-full rounded border border-[#303947] bg-[#0e1115] px-2 py-1.5 text-xs text-[#d7dce5]">
        {KINETIC_MOTION_STYLES.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
      </select>
    </label>
  );
}
