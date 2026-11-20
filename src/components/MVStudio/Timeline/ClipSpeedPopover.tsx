import React, { useEffect, useState } from 'react';
import { Gauge, RotateCcw, X } from 'lucide-react';
import { TimelineClip } from '../../../store/useMVStore';
import { getClipSpeed, MAX_CLIP_SPEED, MIN_CLIP_SPEED } from '../../../lib/clipSpeed';

interface Props {
  clip: TimelineClip;
  x: number;
  y: number;
  onChange: (speed: number) => string | undefined;
  onCommit: () => void;
  onClose: () => void;
  label?: string;
  hint?: string;
}

/** No extra inspector pane: the speed editor appears directly beside a clip. */
export function ClipSpeedPopover({ clip, x, y, onChange, onCommit, onClose, label = 'CLIP SPEED', hint = 'Slower clips make room automatically. Locked clips stay in place.' }: Props) {
  const speed = getClipSpeed(clip);
  const [draft, setDraft] = useState(String(speed));
  const [error, setError] = useState('');
  useEffect(() => setDraft(String(speed)), [speed, clip.id]);
  const apply = (value: number) => {
    const problem = onChange(value);
    setError(problem || '');
    if (!problem) setDraft(String(Math.round(value * 100) / 100));
  };
  const applyDraft = () => {
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value) || value < MIN_CLIP_SPEED || value > MAX_CLIP_SPEED) {
      setError(`Choose a speed between ${MIN_CLIP_SPEED}× and ${MAX_CLIP_SPEED}×.`);
      return;
    }
    apply(value);
    onCommit();
  };
  const sourceSeconds = Math.max(0, clip.trimEnd - clip.trimStart);
  const timelineSeconds = Math.max(0, clip.endTime - clip.startTime);

  return (
    <>
      <div className="fixed inset-0 z-[99]" onPointerDown={onClose} aria-hidden="true" />
      <section
        role="dialog" aria-label="Clip playback speed"
        className="fixed z-[100] w-[256px] rounded-xl border border-[#343e4d] bg-[#10151d] p-3.5 text-[#e5edf6] shadow-[0_18px_60px_rgba(0,0,0,0.8)] font-mono select-text"
        style={{ left: Math.max(8, Math.min(x, window.innerWidth - 264)), top: Math.max(8, Math.min(y, window.innerHeight - 292)) }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      >
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2 text-xs font-bold"><Gauge size={15} className="text-emerald-400" /> {label}</div>
          <button type="button" onClick={onClose} aria-label="Close speed control" className="text-slate-400 hover:text-white"><X size={15} /></button>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="range" aria-label="Playback speed slider"
            min={MIN_CLIP_SPEED} max={MAX_CLIP_SPEED} step={0.05} value={speed}
            disabled={clip.locked}
            onChange={e => apply(Number(e.target.value))}
            onPointerUp={onCommit} onKeyUp={onCommit}
            className="flex-1 min-w-0 accent-emerald-400 cursor-pointer"
          />
          <div className="flex items-center rounded-md border border-[#344252] bg-[#080d13] text-emerald-300">
            <input
              aria-label="Exact playback speed" type="number" inputMode="decimal" min={MIN_CLIP_SPEED} max={MAX_CLIP_SPEED} step="0.01"
              value={draft} disabled={clip.locked}
              onChange={e => { setDraft(e.target.value); setError(''); }}
              onBlur={applyDraft}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
              className="w-14 h-8 bg-transparent text-right text-xs font-bold outline-none"
            />
            <span className="px-1.5 text-xs">×</span>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[0.5, 1, 1.5, 2, 4].map(value => (
            <button key={value} type="button" disabled={clip.locked}
              onClick={() => { apply(value); onCommit(); }}
              aria-label={`Set clip speed to ${value} times`}
              className={`flex-1 py-1 rounded-md text-[10px] border transition-colors disabled:opacity-40 ${Math.abs(speed - value) < 0.01 ? 'text-emerald-300 border-emerald-600 bg-emerald-900/20' : 'text-slate-300 border-[#303948] hover:border-emerald-500'}`}>
              {value}×
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 border-t border-[#293240] pt-2 text-[10px] text-slate-400">
          <span>{sourceSeconds.toFixed(2)}s source → <span className="text-slate-200">{timelineSeconds.toFixed(2)}s</span> timeline</span>
          <button type="button" disabled={clip.locked} onClick={() => { apply(1); onCommit(); }}
            title="Reset to normal speed" className="flex gap-1 items-center hover:text-emerald-300 disabled:opacity-40"><RotateCcw size={12} /> Reset</button>
        </div>
        <p className="mt-2 text-[9px] leading-4 text-slate-500">{hint}</p>
        {error && <p role="alert" className="mt-2 text-[10px] text-rose-400">{error}</p>}
      </section>
    </>
  );
}
