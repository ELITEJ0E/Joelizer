import React from 'react';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { makeMVElement, type MVElementKind } from '../../lib/mvCanvasElements';
import { OVERLAY_PRESETS } from '../../lib/overlayEffects';
import { AppColorPicker } from '../ui/color-picker';
import { Plus, Trash2 } from 'lucide-react';
const inputClass='w-full rounded border border-[#303846] bg-[#0a0c0f] px-2 py-1 text-xs text-white';
const btn='rounded border border-[#303846] bg-[#111820] px-2 py-1.5 text-[11px] hover:border-accent cursor-pointer';
const kinds: { kind: MVElementKind; label: string }[] = [{kind:'text',label:'Text'},{kind:'watermark',label:'Watermark'},{kind:'star',label:'Star'},{kind:'heart',label:'Heart'},{kind:'rectangle',label:'Square'},{kind:'circle',label:'Circle'}];
export function MVElementsPanel() {
  const elements=useMVStore(s=>s.canvasElements);
  const selectedId=useMVStore(s=>s.selectedCanvasElementId);
  const select=useMVStore(s=>s.setSelectedCanvasElement);
  const add=useMVStore(s=>s.addCanvasElement);
  const update=useMVStore(s=>s.updateCanvasElement);
  const remove=useMVStore(s=>s.removeCanvasElement);
  const effects=useMVStore(s=>s.extraOverlayEffects);
  const addEffect=useMVStore(s=>s.addExtraOverlayEffect);
  const updateEffect=useMVStore(s=>s.updateExtraOverlayEffect);
  const removeEffect=useMVStore(s=>s.removeExtraOverlayEffect);
  const e=elements.find(item=>item.id===selectedId);
  return <div className="space-y-3 text-[#cbd5e1]">
    <details open className="rounded border border-[#303846] p-2">
      <summary className="cursor-pointer text-xs font-semibold">Elements & watermark</summary>
      <p className="my-2 text-[10px] text-slate-400">Add a layer, then drag it on the preview. Layers stay visible for the whole video unless timed.</p>
      <div className="grid grid-cols-3 gap-1">{kinds.map(k=><button key={k.kind} type="button" className={btn} onClick={()=>add(makeMVElement(k.kind,crypto.randomUUID()))}>{k.label}</button>)}</div>
      <div className="mt-2 space-y-1">{elements.map(item=><div key={item.id} className="flex gap-1">
        <button type="button" className={`${btn} flex-1 truncate text-left ${selectedId===item.id?'border-accent text-accent':''}`} onClick={()=>select(item.id)}>{item.kind==='text'||item.kind==='watermark'?item.text||item.kind:item.kind}</button>
        <button type="button" title="Remove element" aria-label="Remove element" className={btn} onClick={()=>remove(item.id)}><Trash2 size={12}/></button>
      </div>)}</div>
      {e&&<div className="mt-3 space-y-2 border-t border-[#303846] pt-2">
        {(e.kind==='text'||e.kind==='watermark')&&<input aria-label="Element text" maxLength={120} className={inputClass} value={e.text} onChange={ev=>update(e.id,{text:ev.target.value})}/>}
        <AppColorPicker label="Element color" value={e.color} onChange={color=>update(e.id,{color})}/>
        <label className="block text-[11px]">Size · {Math.round(e.size*100)}%<input className="w-full accent-accent" type="range" min=".01" max=".8" step=".005" value={e.size} onChange={ev=>update(e.id,{size:Number(ev.target.value)})}/></label>
        <label className="block text-[11px]">Opacity · {Math.round(e.opacity*100)}%<input className="w-full accent-accent" type="range" min="0" max="1" step=".05" value={e.opacity} onChange={ev=>update(e.id,{opacity:Number(ev.target.value)})}/></label>
        <div className="grid grid-cols-2 gap-1">{(['startTime','endTime'] as const).map(key=><label key={key} className="text-[10px]">{key==='startTime'?'Start (s)':'End (0 = full)'}<input type="number" min="0" step=".1" className={inputClass} value={e[key]} onChange={ev=>update(e.id,{[key]:Number(ev.target.value)})}/></label>)}</div>
        <div className="flex gap-1"><button type="button" className={btn} onClick={()=>update(e.id,{x:.5,y:.5})}>Center</button><button type="button" className={btn} onClick={()=>update(e.id,{startTime:useStore.getState().currentTime})}>Start at playhead</button></div>
      </div>}
    </details>
    <details className="rounded border border-[#303846] p-2">
      <summary className="cursor-pointer text-xs font-semibold">Additional effect layers ({effects.length})</summary>
      <p className="my-2 text-[10px] text-slate-400">Stack multiple timed effects on top of the existing finishing effect.</p>
      <button type="button" className={`${btn} flex gap-1 items-center`} onClick={()=>addEffect({id:crypto.randomUUID(),effect:'light-leak',intensity:.45,startTime:0,endTime:0})}><Plus size={12}/> Add effect</button>
      {effects.map(f=><div key={f.id} className="mt-2 space-y-1 rounded border border-[#303846] p-2">
        <div className="flex gap-1"><select aria-label="Effect type" className={inputClass} value={f.effect} onChange={ev=>updateEffect(f.id,{effect:ev.target.value as typeof f.effect})}>{OVERLAY_PRESETS.filter(p=>p.id!=='none').map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select><button type="button" className={btn} title="Remove effect" onClick={()=>removeEffect(f.id)}><Trash2 size={12}/></button></div>
        <label className="block text-[10px]">Intensity · {Math.round(f.intensity*100)}%<input type="range" min="0" max="1" step=".05" className="w-full accent-accent" value={f.intensity} onChange={ev=>updateEffect(f.id,{intensity:Number(ev.target.value)})}/></label>
        <div className="grid grid-cols-2 gap-1">{(['startTime','endTime'] as const).map(k=><label key={k} className="text-[10px]">{k==='startTime'?'Start (s)':'End (0 = full)'}<input type="number" min="0" step=".1" className={inputClass} value={f[k]} onChange={ev=>updateEffect(f.id,{[k]:Number(ev.target.value)})}/></label>)}</div>
      </div>)}
    </details>
  </div>;
}
