import React from 'react';
import { useOverlayEffectsStore } from '../../store/useOverlayEffectsStore';
import { OVERLAY_PRESETS } from '../../lib/overlayEffects';

export function OverlayEffectsPanel({ mode }: { mode: 'lyrics-video' | 'music-video' }) {
  const settings = useOverlayEffectsStore(s => mode === 'music-video' ? s.mv : s.lyrics);
  const update = useOverlayEffectsStore(s => s.update);
  const reset = useOverlayEffectsStore(s => s.reset);
  return (
    <section className="space-y-3 rounded-lg border border-[#303846] bg-[#121923] p-3" aria-label="Overlay effects">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#edf2f7]">Overlay Effects</h3>
        <button type="button" onClick={() => reset(mode)}
          className="rounded border border-[#35465a] px-2 py-1 text-[10px] text-emerald-400 hover:bg-white/5">Reset</button>
      </div>
      <p className="text-[10px] text-[#98a7b9]">A visual-effects layer above the finished scene. Separate from the background and captions.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {OVERLAY_PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => update(mode, { effect: p.id })}
            aria-pressed={settings.effect === p.id} title={p.description}
            className={`min-h-10 rounded border p-2 text-left text-[11px] font-semibold transition-colors ${settings.effect === p.id
              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
              : 'border-[#344153] bg-[#0c1118] text-[#bbc6d4] hover:border-[#64748b]'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor={`overlay-intensity-${mode}`} className="flex justify-between text-[11px] text-[#cad3df]">
        <span>Intensity</span><span>{Math.round(settings.intensity * 100)}%</span>
      </label>
      <input id={`overlay-intensity-${mode}`} type="range" min="0" max="1" step="0.05" value={settings.intensity}
        disabled={settings.effect === 'none'} onChange={e => update(mode, { intensity: Number(e.target.value) })}
        className="w-full accent-emerald-400 disabled:opacity-40" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[#a2b0c0]">Start (seconds)
          <input type="number" min="0" step="0.1" value={settings.startTime}
            onChange={e => update(mode, { startTime: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-[#344153] bg-[#0b1117] px-2 py-1.5 text-xs text-white"/>
        </label>
        <label className="text-[10px] text-[#a2b0c0]">End (0 = entire video)
          <input type="number" min="0" step="0.1" value={settings.endTime}
            onChange={e => update(mode, { endTime: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-[#344153] bg-[#0b1117] px-2 py-1.5 text-xs text-white"/>
        </label>
      </div>
      <p className="text-[10px] text-[#8291a5]">Timed effects appear in playback and export. Effects use original algorithms, not CapCut assets.</p>
    </section>
  );
}
