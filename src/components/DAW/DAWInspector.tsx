import React from 'react';
import { AudioLines, Copy, Scissors, SlidersHorizontal, Trash2, Volume2, X } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';

const panel = 'w-full rounded-md border border-white/10 bg-[#111a26] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/60';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40';
function formatDb(gain: number) {
  return gain <= 0.00001 ? '-∞' : (20 * Math.log10(gain)).toFixed(1);
}

const Field = ({label, value, onChange, min=0, max=99999, step=0.01}: {
  label:string; value:number; onChange:(n:number)=>void; min?:number; max?:number; step?:number
}) => <label className="space-y-1 text-[11px] text-slate-400">
  <span>{label}</span>
  <input aria-label={label} className={panel} type="number" min={min} max={max} step={step}
    value={Number(value.toFixed(3))}
    onChange={e => { const n=Number(e.target.value); if(Number.isFinite(n)) onChange(Math.max(min,Math.min(max,n))); }}
    onBlur={useDAWStore.getState().commitHistory}
    onKeyDown={e=>e.stopPropagation()}
  />
</label>;

export function DAWInspector({ onClose }: { onClose: () => void }) {
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const selectedClipId = useDAWStore(s => s.selectedClipId);
  const tracks = useDAWStore(s => s.tracks);
  const currentTime = useDAWStore(s => s.currentTime);
  const select = useDAWStore(s => s.setSelectedClipId);
  const updateClip = useDAWStore(s => s.updateClip);
  const updateTrack = useDAWStore(s => s.updateTrack);
  const setTrackVolume = useDAWStore(s => s.setTrackVolume);
  const setTrackPan = useDAWStore(s => s.setTrackPan);
  const splitClip = useDAWStore(s => s.splitClip);
  const duplicateClip = useDAWStore(s => s.duplicateClip);
  const removeClip = useDAWStore(s => s.removeClip);
  const commitHistory = useDAWStore(s => s.commitHistory);
  const track = tracks.find(t => t.id === selectedTrackId);
  const clipTrack = tracks.find(t => t.clips.some(c => c.id === selectedClipId));
  const clip = clipTrack?.clips.find(c => c.id === selectedClipId);
  return <aside aria-label="Music Studio inspector" className="flex h-full min-h-0 w-full flex-col border-l border-white/10 bg-[#0b111b] text-slate-200">
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-3">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><SlidersHorizontal size={15} className="text-cyan-300"/> Inspector</span>
      <button className={button} aria-label="Close inspector" onClick={onClose}><X size={13}/></button>
    </header>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
      {track ? <section className="space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected channel</h3>
        <div className="flex items-center gap-2">
          <span className="h-8 w-1.5 rounded" style={{backgroundColor:track.color}}/>
          <input aria-label="Track name" className={panel} value={track.name} onChange={e=>updateTrack(track.id,{name:e.target.value})}
            onBlur={commitHistory}/>
        </div>
        <div className="text-[11px] text-slate-500">{track.type} · {track.clips.length} clips</div>
        <label className="block space-y-1 text-[11px] text-slate-400">
          <span>Channel level · {formatDb(track.volume)} dB</span>
          <input type="range" aria-label="Channel level" min="0" max="1.5" step="0.01" value={track.volume}
            className="w-full accent-cyan-400" onChange={e=>setTrackVolume(track.id,Number(e.target.value))}/>
        </label>
        <label className="block space-y-1 text-[11px] text-slate-400">
          <span>Pan · {Math.round(track.pan * 100)} {track.pan < 0?'L':track.pan > 0?'R':''}</span>
          <input type="range" aria-label="Channel pan" min="-1" max="1" step=".01" value={track.pan}
            className="w-full accent-cyan-400" onChange={e=>setTrackPan(track.id,Number(e.target.value))}/>
        </label>
      </section> : <p className="text-xs text-slate-500">Select a channel to edit its level and pan.</p>}
      {clip ? <section className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><AudioLines size={13}/> Clip editor</h3>
          <button className={button} onClick={()=>select(null)} title="Deselect clip"><X size={12}/></button>
        </div>
        <input aria-label="Clip name" className={panel} value={clip.name}
          onChange={e=>updateClip(clip.id,{name:e.target.value})} onBlur={commitHistory}/>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start (s)" value={clip.startTime}
            onChange={n=>updateClip(clip.id,{startTime:n})}/>
          <Field label="Length (s)" value={clip.duration} min={0.05}
            onChange={n=>updateClip(clip.id,{duration:n,sourceEnd:clip.sourceStart+n})}/>
          <Field label="Fade in (s)" value={clip.fadeIn} max={clip.duration}
            onChange={n=>updateClip(clip.id,{fadeIn:n})}/>
          <Field label="Fade out (s)" value={clip.fadeOut} max={clip.duration}
            onChange={n=>updateClip(clip.id,{fadeOut:n})}/>
        </div>
        <label className="block space-y-1 text-[11px] text-slate-400">
          <span>Clip gain · {formatDb(clip.volume)} dB</span>
          <input type="range" aria-label="Clip gain" min="0" max="1.5" step=".01" value={clip.volume}
            className="w-full accent-cyan-400" onChange={e=>updateClip(clip.id,{volume:Number(e.target.value)})} onPointerUp={commitHistory}/>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className={button} disabled={currentTime <= clip.startTime || currentTime >= clip.startTime+clip.duration}
            onClick={()=>splitClip(clip.id,currentTime)}><Scissors size={13}/> Split at cursor</button>
          <button className={button} onClick={()=>duplicateClip(clip.id)}><Copy size={13}/> Duplicate</button>
          <button className={button+' col-span-2 text-rose-300'} onClick={()=>removeClip(clip.id)}>
            <Trash2 size={13}/> Delete clip
          </button>
        </div>
      </section> : <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">
        Select a clip in the arrangement to adjust its start, length, gain and fades.
      </div>}
    </div>
    <footer className="border-t border-white/10 p-3 text-[10px] leading-4 text-slate-500">
      <Volume2 size={12} className="mr-1 inline"/> Use Space to play, S to split, Delete to remove, Ctrl/Cmd+Z to undo.
    </footer>
  </aside>;
}
