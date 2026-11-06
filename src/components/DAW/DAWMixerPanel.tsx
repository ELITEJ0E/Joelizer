import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Sliders, Radio, Activity, Disc, Zap, Mic, ChevronUp, ChevronDown } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';

export function DAWMixerPanel({ expanded, onExpandedChange }: { expanded?: boolean; onExpandedChange?: (open: boolean) => void } = {}) {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const tracks = useDAWStore(s => s.tracks);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const setSelectedTrackId = useDAWStore(s => s.setSelectedTrackId);
  const setTrackVolume = useDAWStore(s => s.setTrackVolume);
  const setTrackPan = useDAWStore(s => s.setTrackPan);
  const toggleTrackMute = useDAWStore(s => s.toggleTrackMute);
  const toggleTrackSolo = useDAWStore(s => s.toggleTrackSolo);
  const toggleTrackArmed = useDAWStore(s => s.toggleTrackArmed);

  const masterVolume = useDAWStore(s => s.masterVolume);
  const setMasterVolume = useDAWStore(s => s.setMasterVolume);
  const isPlaying = useDAWStore(s => s.isPlaying);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = expanded ?? internalExpanded;
  const setIsExpanded = onExpandedChange ?? setInternalExpanded;
  const [masterLevel, setMasterLevel] = useState(0);

  // Poll master audio level when playing
  useEffect(() => {
    if (!isPlaying) {
      setMasterLevel(0);
      return;
    }

    const interval = setInterval(() => {
      setMasterLevel(dawAudioEngine.getMasterLevel());
    }, 60);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <section aria-label="Music Studio mixer console"
      className="shrink-0 border-t border-white/10 bg-[#0a111b] text-slate-200">
      <button type="button" aria-expanded={isExpanded} onClick={()=>setIsExpanded(!isExpanded)}
        className="flex h-8 w-full items-center justify-between border-b border-white/[0.06] px-4 text-[11px] font-semibold hover:bg-white/5">
        <span className="flex items-center gap-2"><Sliders size={14} className="text-cyan-300"/> MIXER CONSOLE
          <span className="font-mono font-normal text-slate-500">{tracks.length} channels · Stereo output</span></span>
        {isExpanded?<ChevronDown size={15}/>:<ChevronUp size={15}/>}
      </button>
      {isExpanded && <div className="flex h-[194px] items-stretch gap-2 overflow-x-auto px-3 py-3">
        {tracks.map(track=>{
          const selected=selectedTrackId===track.id;
          const db=track.volume<=0.0001?'-∞':(20*Math.log10(track.volume)).toFixed(1);
          return <div key={track.id} onClick={()=>setSelectedTrackId(track.id)}
            className={selected
              ? 'flex w-[165px] shrink-0 flex-col gap-2 rounded-xl border border-cyan-300/40 bg-[#172233] p-2.5 shadow-lg'
              : 'flex w-[165px] shrink-0 flex-col gap-2 rounded-xl border border-white/10 bg-[#101926] p-2.5 hover:border-white/25'}
            style={{borderTop:'3px solid '+track.color}}>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white" title={track.name}>{track.name}</div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{track.type}</span>
                <span>{track.fx?.compressorEnabled?'COMP ':''}{(track.fx?.lowShelfDb||track.fx?.midDb||track.fx?.highShelfDb)?'EQ':''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={'Mute '+track.name} aria-pressed={track.muted}
                onClick={e=>{e.stopPropagation();toggleTrackMute(track.id);}}
                className={track.muted?'rounded bg-amber-400/20 px-2 py-1 text-[10px] font-bold text-amber-200':'rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-400'}>M</button>
              <button type="button" aria-label={'Solo '+track.name} aria-pressed={track.solo}
                onClick={e=>{e.stopPropagation();toggleTrackSolo(track.id);}}
                className={track.solo?'rounded bg-cyan-400/20 px-2 py-1 text-[10px] font-bold text-cyan-200':'rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-400'}>S</button>
              <button type="button" aria-label={'Arm '+track.name} aria-pressed={track.armed}
                onClick={e=>{e.stopPropagation();toggleTrackArmed(track.id);}}
                className={track.armed?'rounded bg-rose-400/20 px-2 py-1 text-[10px] font-bold text-rose-200':'rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-400'}>REC</button>
            </div>
            <label className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Level</span><span className="font-mono text-cyan-200">{db} dB</span>
              </div>
              <input type="range" aria-label={'Volume '+track.name} min="0" max="1.5" step=".01"
                value={track.volume} onChange={e=>setTrackVolume(track.id,Number(e.target.value))}
                onClick={e=>e.stopPropagation()} className="w-full accent-cyan-400"/>
            </label>
            <label className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Pan</span><span className="font-mono">{Math.round(track.pan*100)}</span>
              </div>
              <input type="range" aria-label={'Pan '+track.name} min="-1" max="1" step=".01"
                value={track.pan} onChange={e=>setTrackPan(track.id,Number(e.target.value))}
                onClick={e=>e.stopPropagation()} className="w-full accent-sky-400"/>
            </label>
          </div>;
        })}
        <div className="ml-auto flex w-[190px] shrink-0 flex-col gap-2 rounded-xl border border-cyan-400/30 bg-[#102129] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">Master</span>
            <span className="text-[10px] text-slate-400">STEREO OUT</span>
          </div>
          <div className="flex h-8 items-end gap-1 rounded-md border border-white/10 bg-black/40 p-1">
            <div className="h-full w-full overflow-hidden rounded bg-white/5">
              <div className="h-full origin-left rounded bg-gradient-to-r from-cyan-500 to-emerald-400 transition-transform duration-75"
                style={{transform:'scaleX('+Math.max(0,Math.min(1,masterLevel*1.5))+')'}}/>
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-cyan-200">
              {masterLevel>0?(20*Math.log10(masterLevel)).toFixed(0)+'dB':'-∞'}
            </span>
          </div>
          <label className="mt-auto space-y-1 text-[10px] text-slate-400">
            <span className="flex justify-between"><span>Output level</span><span className="font-mono text-cyan-200">{Math.round(masterVolume*100)}%</span></span>
            <input type="range" aria-label="Mixer master volume" min="0" max="1.5" step=".01" value={masterVolume}
              onChange={e=>setMasterVolume(Number(e.target.value))}
              className="w-full accent-cyan-400"/>
          </label>
          <div className="text-[10px] leading-4 text-slate-500">24-bit WAV export · -1 dBFS sample-peak ceiling</div>
        </div>
      </div>}
    </section>
  );
}
