import React, { useState } from 'react';
import { Flag, Plus, ChevronLeft, ChevronRight, X, Repeat } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { NumericField } from './DAWInspector';

export function ArrangementMarkers() {
  const markers = useDAWStore(s => s.markers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = markers.find(m => m.id === activeId);
  const s = useDAWStore.getState;
  const loopSection = () => {
    if (!active) return;
    const next = markers.find(m => m.time > active.time);
    const end = next?.time ?? Math.max(active.time + .5, ...s().tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)));
    s().setLoopRegion(active.time, end);
    if (!s().isLooping) s().toggleLoop();
    s().seek(active.time);
  };
  return <section aria-label="Arrangement markers" className="studio-markers border-b border-white/10 bg-[#10141e] text-xs shrink-0">
    <div className="flex items-center gap-1 px-3 py-2">
      <Flag size={13} className="text-violet-300 shrink-0" />
      <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-slate-400 mr-2">Arrangement</span>
      <button title="Previous marker (Shift+Left)" aria-label="Previous marker" onClick={() => s().navigateMarker(-1)} disabled={!markers.length} className="studio-icon"><ChevronLeft size={14}/></button>
      <button title="Next marker (Shift+Right)" aria-label="Next marker" onClick={() => s().navigateMarker(1)} disabled={!markers.length} className="studio-icon"><ChevronRight size={14}/></button>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto">
        {!markers.length && <span className="text-slate-500 text-[11px] truncate">Mark an intro, verse or drop at the playhead.</span>}
        {markers.map((marker, i) => <button key={marker.id} aria-label={`Go to marker ${marker.name}`} aria-pressed={activeId === marker.id}
          onClick={() => { setActiveId(marker.id); s().seek(marker.time); }}
          className={`shrink-0 max-w-44 truncate rounded-md px-2.5 py-1 border ${activeId === marker.id ? 'border-violet-400/50 bg-violet-400/15 text-white' : 'border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/10'}`}>
          <span style={{ color: marker.color }} className="mr-1.5 font-mono">{String(i + 1).padStart(2, '0')}</span>{marker.name}
        </button>)}
      </div>
      <button aria-label="Add marker at playhead" title="Add marker (M)" onClick={() => { s().addMarker(); }} className="studio-action shrink-0"><Plus size={13}/><span className="hidden sm:inline">Marker</span></button>
    </div>
    {active && <div className="flex flex-wrap items-center gap-2 px-3 pb-2" key={active.id}>
      <input aria-label="Marker name" defaultValue={active.name} key={`${active.id}-${active.name}`} maxLength={80} className="studio-input w-32"
        onBlur={e => { if (e.target.value !== active.name) s().updateMarker(active.id, { name: e.target.value }); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <NumericField label="Marker time (s)" value={active.time} min={0} onCommit={time => s().updateMarker(active.id, { time })}/>
      <input type="color" aria-label="Marker color" value={active.color} onChange={e => s().updateMarker(active.id, {color:e.target.value})} className="h-7 w-8 bg-transparent"/>
      <button onClick={loopSection} className="studio-action"><Repeat size={12}/>Loop section</button>
      <button onClick={() => s().removeMarker(active.id)} className="studio-action text-rose-300">Delete marker</button>
      <button aria-label="Close marker details" className="studio-icon ml-auto" onClick={() => setActiveId(null)}><X size={13}/></button>
    </div>}
  </section>;
}
