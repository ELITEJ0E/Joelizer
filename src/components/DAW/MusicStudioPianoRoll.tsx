import React, { useState } from 'react';
import { Grid3X3, Piano, Play, Plus } from 'lucide-react';

export interface PianoRollSample {
  id: string;
  name: string;
  buffer: AudioBuffer;
}
const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const noteName = (midi: number) => noteNames[(midi+120)%12] + (Math.floor(midi/12)-1);
const button = 'rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40';

export async function renderSamplePianoRoll(
  source: AudioBuffer,
  steps: number[][],
  bpm: number,
  bars: number,
  rootNote: number,
  baseNote: number
): Promise<Blob> {
  const { encodeLabWav } = await import('../../lib/audioLabEngine');
  const sampleRate = 44100;
  const secondsPerStep = 60 / Math.max(60, Math.min(220,bpm)) / 4;
  const seconds = secondsPerStep * 16 * bars;
  const context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const bus = context.createDynamicsCompressor();
  bus.threshold.value = -8;
  bus.ratio.value = 2.5;
  bus.attack.value = 0.01;
  bus.release.value = 0.15;
  bus.connect(context.destination);
  let count = 0;
  for (let bar = 0; bar < bars; bar++) {
    for (let index = 0; index < 16; index++) {
      for (let pitch = 0; pitch < 12; pitch++) {
        if (!steps[pitch]?.[index]) continue;
        const when = (bar * 16 + index) * secondsPerStep;
        const playbackRate = Math.pow(2, (baseNote + 11 - pitch - rootNote) / 12);
        const maxDuration = Math.min(secondsPerStep * 0.92, source.duration / playbackRate, seconds - when);
        if (maxDuration < 0.001) continue;
        const oscillator = context.createBufferSource();
        oscillator.buffer = source;
        oscillator.playbackRate.value = playbackRate;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.linearRampToValueAtTime(0.55, when + Math.min(0.01, maxDuration * 0.2));
        gain.gain.setValueAtTime(0.55, when + Math.max(0.01, maxDuration * 0.7));
        gain.gain.linearRampToValueAtTime(0.0001, when + maxDuration);
        oscillator.connect(gain);
        gain.connect(bus);
        oscillator.start(when, 0, maxDuration);
        count++;
      }
    }
  }
  if (!count) throw new Error('Draw a note first by clicking a cell in the piano roll.');
  const rendered = await context.startRendering();
  let peak = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i=0;i<data.length;i++) peak=Math.max(peak,Math.abs(data[i]));
  }
  const ceiling = Math.pow(10,-1/20);
  const gain = peak > ceiling ? ceiling/peak : 1;
  if (gain < 1) for (let ch=0;ch<2;ch++) {
    const data=rendered.getChannelData(ch);
    for(let i=0;i<data.length;i++) data[i]*=gain;
  }
  return encodeLabWav(rendered,24);
}

export function MusicStudioPianoRoll({
  samples, bpm, onInsert
}: {
  samples: PianoRollSample[];
  bpm: number;
  onInsert: (blob: Blob, name: string, duration: number) => void;
}) {
  const [sampleId,setSampleId]=useState('');
  const [octave,setOctave]=useState(4);
  const [root,setRoot]=useState(60);
  const [bars,setBars]=useState(4);
  const [notes,setNotes]=useState<number[][]>(()=>Array.from({length:12},()=>Array(16).fill(0)));
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('Click cells to draw notes, then render them with your selected instrument sample.');
  const sample=samples.find(s=>s.id===sampleId);
  const baseNote=12*(octave+1);
  const render = async () => {
    if(!sample||busy)return;
    setBusy(true);setNotice('Rendering pitched sample notes...');
    try{
      const blob=await renderSamplePianoRoll(sample.buffer,notes,bpm,bars,root,baseNote);
      const duration=bars*4*60/bpm;
      onInsert(blob,'Piano Roll - '+sample.name,duration);
      setNotice('Piano roll rendered and inserted into the multitrack arrangement.');
    }catch(e){setNotice(e instanceof Error?e.message:'Piano roll render failed.');}
    finally{setBusy(false);}
  };
  return <div className="space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-white"><Piano size={15} className="text-cyan-300"/> Sampler piano roll</div>
    <p className="text-[11px] text-slate-400">Pitch a sample chromatically over a 16-step grid. This sampler is offline-rendered; it does not depend on external plugins.</p>
    <label className="block text-[11px] text-slate-300">Instrument sample
      <select aria-label="Piano roll instrument" className="mt-1 w-full rounded border border-white/15 bg-[#17202b] p-2 text-xs"
        value={sampleId} onChange={e=>setSampleId(e.target.value)}>
        <option value="">Choose imported sample...</option>
        {samples.map(sample=><option key={sample.id} value={sample.id}>{sample.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-3 gap-2 text-[10px]">
      <label>Octave
        <select aria-label="Piano roll octave" className="mt-1 w-full rounded border border-white/15 bg-[#17202b] p-1" value={octave}
          onChange={e=>setOctave(Number(e.target.value))}>
          {[2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>Source root
        <select aria-label="Piano roll source root" className="mt-1 w-full rounded border border-white/15 bg-[#17202b] p-1" value={root}
          onChange={e=>setRoot(Number(e.target.value))}>
          {Array.from({length:36},(_,i)=>i+48).map(n=><option key={n} value={n}>{noteName(n)}</option>)}
        </select>
      </label>
      <label>Bars
        <select aria-label="Piano roll bars" className="mt-1 w-full rounded border border-white/15 bg-[#17202b] p-1" value={bars}
          onChange={e=>setBars(Number(e.target.value))}>
          {[1,2,4,8].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
    <div className="overflow-x-auto">
      <div className="min-w-[300px] space-y-[2px]">
        {notes.map((row,pitch)=><div key={pitch} className="flex items-center gap-0.5">
          <span className="w-8 shrink-0 text-right pr-1 text-[10px] font-mono text-slate-400">{noteName(baseNote+11-pitch)}</span>
          {row.map((active,step)=><button type="button" key={step}
            aria-label={'Piano '+noteName(baseNote+11-pitch)+' step '+(step+1)}
            aria-pressed={!!active}
            onClick={()=>setNotes(old=>old.map((r,i)=>i===pitch?r.map((v,j)=>j===step?(v?0:1):v):r))}
            className={'h-5 min-w-0 flex-1 rounded-sm border '+(active
              ? 'border-cyan-200/70 bg-cyan-400/85'
              : (step%4===0?'border-white/20 bg-white/10':'border-white/5 bg-white/[0.025]'))}/>
          )}
        </div>)}
      </div>
    </div>
    <div className="flex gap-2">
      <button className={button} onClick={()=>setNotes(Array.from({length:12},()=>Array(16).fill(0)))}>Clear</button>
      <button className={button} onClick={()=>setNotes(old=>old.map((row,p)=>row.map((v,i)=>p===11 && i%4===0?1:v)))}>
        <Plus size={12} className="mr-1 inline"/> Add C notes
      </button>
    </div>
    <button className="w-full rounded border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40"
      disabled={!sample||busy} onClick={()=>void render()}>
      <Play size={13} className="mr-1 inline"/> Render piano roll to DAW
    </button>
    <p role="status" className="text-[10px] text-slate-400">{notice}</p>
  </div>;
}
