import { StyledSelect } from '../ui/StyledSelect';
import React, { useState } from 'react';
import { Copy, Scissors, Repeat, VolumeX, SlidersHorizontal, AudioLines, X } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { DAWClip } from '../../types/daw';
import { dawAudioEngine } from '../../lib/dawAudioEngine';

export function NumericField({ label, value, min = 0, max, step = .01, onCommit }: {
  label: string; value: number; min?: number; max?: number; step?: number; onCommit: (value: number) => void;
}) {
  return <label className="flex flex-col gap-1 text-[10px] text-slate-400 min-w-0">{label}
    <input key={value} aria-label={label} type="number" defaultValue={Number(value.toFixed(3))} min={min} max={max} step={step}
      className="studio-input w-full min-w-0 font-mono text-xs"
      onBlur={e => {
        const next = e.currentTarget.valueAsNumber;
        if (Number.isFinite(next) && next >= min && (max === undefined || next <= max)) { if (next !== value) onCommit(next); }
        else e.currentTarget.value = String(Number(value.toFixed(3)));
      }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
  </label>;
}

export function DAWInspector({ onClose }: { onClose?: () => void }) {
  const tracks = useDAWStore(s => s.tracks);
  const selectedId = useDAWStore(s => s.selectedClipId);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const track = tracks.find(t => t.clips.some(c => c.id === selectedId)) ?? tracks.find(t => t.id === selectedTrackId);
  const clip = track?.clips.find(c => c.id === selectedId);
  const sourceDuration = clip ? dawAudioEngine.getCachedBuffer(clip.audioUrl)?.duration ?? clip.sourceEnd : 0;
  const [repeatCount, setRepeatCount] = useState(3);
  const s = useDAWStore.getState;
  const edit = (updates: Partial<DAWClip>) => { if (clip) s().editClip(clip.id, updates); };
  const eq = track?.eq ?? { low: 0, mid: 0, high: 0, bypass: false };
  return <aside aria-label="Clip and track inspector" className="h-full overflow-y-auto bg-[#10141e] p-4 text-slate-200">
    <div className="flex gap-2 items-center text-[10px] uppercase tracking-[.18em] text-slate-400 mb-4">
      <SlidersHorizontal size={13}/><span className="flex-1">Inspector</span>
      {onClose && <button type="button" className="studio-icon" aria-label="Close inspector" title="Close inspector" onClick={onClose}><X size={15}/></button>}
    </div>
    {!clip ? <div className="py-6 text-center text-slate-400 text-xs leading-relaxed"><AudioLines className="mx-auto mb-3 text-slate-600" size={28}/>Select a clip to shape its timing, gain and fades.</div> : <section key={clip.id} aria-label="Clip properties" className="space-y-4">
      <div><div className="studio-label">Audio clip</div>
        <input aria-label="Clip name" defaultValue={clip.name} key={clip.name} maxLength={120} className="studio-input w-full mt-1 text-sm font-semibold"
          onBlur={e => { if (e.target.value !== clip.name) edit({ name: e.target.value.trim() || 'Audio clip' }); }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></div>
      <div className="grid grid-cols-2 gap-2">
        <NumericField label="Clip start (s)" value={clip.startTime} onCommit={startTime => edit({ startTime })}/>
        <NumericField label="Clip gain (%)" value={clip.volume * 100} max={150} step={1} onCommit={v => edit({ volume:v/100 })}/>
        <NumericField label="Source in (s)" value={clip.sourceStart} max={Math.max(0,sourceDuration - clip.duration)} onCommit={sourceStart => edit({ sourceStart })}/>
        <NumericField label="Duration (s)" value={clip.duration} min={.01} max={sourceDuration - clip.sourceStart} onCommit={duration => edit({ duration })}/>
        <NumericField label="Fade in (s)" value={clip.fadeIn} max={clip.duration} onCommit={fadeIn => edit({fadeIn})}/>
        <NumericField label="Fade out (s)" value={clip.fadeOut} max={clip.duration} onCommit={fadeOut => edit({fadeOut})}/>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-400 flex justify-between"><span>Duration</span><span className="font-mono text-slate-200">{clip.duration.toFixed(3)} s</span></div>
      <label className="studio-label block">Move to track
        <StyledSelect aria-label="Move clip to track" className="studio-input w-full mt-1 text-xs normal-case tracking-normal" value={track.id}
          onChange={e => s().moveClip(clip.id, e.target.value, clip.startTime)}>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </StyledSelect>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="studio-action" onClick={() => s().duplicateClip(clip.id)}><Copy size={12}/>Duplicate</button>
        <button className="studio-action" onClick={() => s().splitClip(clip.id, s().currentTime)}><Scissors size={12}/>Split here</button>
        <button className="studio-action" onClick={() => s().loopSelectedClip()}><Repeat size={12}/>Loop clip</button>
        <button className="studio-action" aria-pressed={!!clip.isMuted} onClick={() => edit({ isMuted: !clip.isMuted })}><VolumeX size={12}/>{clip.isMuted ? 'Unmute clip' : 'Mute clip'}</button>
      </div>
      <div className="flex gap-2 items-end">
        <label className="flex-1 text-[10px] text-slate-400">Additional copies
          <StyledSelect aria-label="Repeat copies" className="studio-input w-full mt-1" value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))}>
            {[1, 3, 7, 15, 31].map(n => <option key={n} value={n}>{n}</option>)}
          </StyledSelect></label>
        <button className="studio-action mb-0.5" onClick={() => s().repeatClip(clip.id, repeatCount)}>Repeat</button>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">Edits preserve the original audio. Repeat places copies end to end.</p>
    </section>}
    {track && <section aria-label="Track equalizer" className="mt-5 border-t border-white/10 pt-4 space-y-4">
      <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="studio-label">Track EQ</div><div className="text-xs truncate mt-1" style={{color:track.color}}>{track.name}</div></div>
        <button className="studio-action" aria-label="Bypass track EQ" aria-pressed={!!eq.bypass} onClick={() => { s().updateTrack(track.id, { eq:{...eq,bypass:!eq.bypass} }); s().commitHistory(); }}>{eq.bypass ? 'Bypassed' : 'Active'}</button></div>
      {(['low','mid','high'] as const).map((band, i) => <label key={band} className="block text-[11px] text-slate-400">
        <span className="flex justify-between mb-2"><span>{['Low · 120 Hz','Mid · 1 kHz','High · 6 kHz'][i]}</span><span className="font-mono text-slate-200">{eq[band] > 0 ? '+' : ''}{eq[band]} dB</span></span>
        <input aria-label={`${band} EQ (dB)`} type="range" min={-12} max={12} step={.5} value={eq[band]} disabled={eq.bypass}
          className="w-full accent-violet-400 disabled:opacity-40"
          onChange={e => s().updateTrack(track.id,{eq:{...eq,[band]:Number(e.target.value)}})}
          onPointerUp={() => s().commitHistory()} onKeyUp={e => { if (e.key.startsWith('Arrow') || ['Home','End','PageUp','PageDown'].includes(e.key)) s().commitHistory(); }} onBlur={() => s().commitHistory()}/>
      </label>)}
      <button className="studio-action w-full" onClick={() => { s().updateTrack(track.id,{eq:{low:0,mid:0,high:0,bypass:false}}); s().commitHistory(); }}>Reset EQ</button>
      <p className="text-[10px] text-slate-500 leading-relaxed">Three bands, ±12 dB. Applied to playback and WAV export.</p>
    </section>}
  </aside>;
}
