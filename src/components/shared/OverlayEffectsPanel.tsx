import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useOverlayEffectsStore } from '../../store/useOverlayEffectsStore';
import { OVERLAY_PRESETS } from '../../lib/overlayEffects';

/** Compact by default in both studios. All existing effects remain available. */
export function OverlayEffectsPanel({ mode }: { mode: 'lyrics-video' | 'music-video' }) {
  const settings = useOverlayEffectsStore(s => mode === 'music-video' ? s.mv : s.lyrics);
  const update = useOverlayEffectsStore(s => s.update);
  const reset = useOverlayEffectsStore(s => s.reset);
  const [expanded, setExpanded] = useState(false);
  const selected = OVERLAY_PRESETS.find(p => p.id === settings.effect);
  return (
    <section className="rounded-lg border border-[#303846] bg-[#121923] overflow-hidden" aria-label="Overlay effects">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" aria-expanded={expanded} aria-controls={`overlay-controls-${mode}`}
          onClick={() => setExpanded(v => !v)}
          className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer">
          <SlidersHorizontal size={14} className="shrink-0 text-emerald-400" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#edf2f7]">Overlay effects</span>
            <span className="block truncate text-[10px] text-[#98a7b9]">
              {selected?.label ?? 'None'} {settings.effect !== 'none' ? `· ${Math.round(settings.intensity * 100)}% intensity` : '· Off'}
            </span>
          </span>
          <ChevronDown size={14} className={`shrink-0 text-[#98a7b9] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {settings.effect !== 'none' && (
          <button type="button" onClick={() => reset(mode)} aria-label={`Reset ${mode} overlay effect`}
            className="rounded border border-[#35465a] px-2 py-1 text-[10px] text-emerald-400 hover:bg-white/5">Reset</button>
        )}
      </div>
      {expanded && (
        <div id={`overlay-controls-${mode}`} className="space-y-3 border-t border-[#303846] p-3">
          <p className="text-[10px] text-[#98a7b9]">A visual layer over the finished scene, separate from captions and backgrounds.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {OVERLAY_PRESETS.map(p => (
              <button key={p.id} type="button" onClick={() => update(mode, { effect: p.id })}
                aria-pressed={settings.effect === p.id} title={p.description}
                className={`min-h-9 rounded border px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${settings.effect === p.id
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
          <details className="rounded border border-[#303846] bg-[#0c1118]">
            <summary className="cursor-pointer px-2 py-2 text-[10px] font-semibold text-[#b6c2cf]">
              Timing (optional) · 0 = entire video
            </summary>
            <div className="grid grid-cols-2 gap-2 px-2 pb-3">
              <label className="text-[10px] text-[#a2b0c0]">Start (seconds)
                <input type="number" min="0" step="0.1" value={settings.startTime}
                  onChange={e => update(mode, { startTime: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-[#344153] bg-[#0b1117] px-2 py-1.5 text-xs text-white"/>
              </label>
              <label className="text-[10px] text-[#a2b0c0]">End (seconds)
                <input type="number" min="0" step="0.1" value={settings.endTime}
                  onChange={e => update(mode, { endTime: Number(e.target.value) })}
                  className="mt-1 w-full rounded border border-[#344153] bg-[#0b1117] px-2 py-1.5 text-xs text-white"/>
              </label>
            </div>
          </details>
          <p className="text-[10px] text-[#8291a5]">Changes are applied to playback and exported video.</p>
        </div>
      )}
    </section>
  );
}
