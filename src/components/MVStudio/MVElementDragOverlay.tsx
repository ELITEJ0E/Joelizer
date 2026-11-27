import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import React, { useRef } from 'react';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { elementActive, elementMetrics } from '../../lib/mvCanvasElements';
export function MVElementDragOverlay({width,height}:{width:number;height:number}) {
  const elements=useMVStore(s=>s.canvasElements);
  const selected=useMVStore(s=>s.selectedCanvasElementId);
  const select=useMVStore(s=>s.setSelectedCanvasElement);
  const update=useMVStore(s=>s.updateCanvasElement);
  const time=useStore(s=>s.currentTime);
  const drag=useRef<{id:string;px:number;py:number;x:number;y:number;w:number;h:number;size:number;resize:boolean}|null>(null);
  const container=useRef<HTMLDivElement>(null);
  return <div ref={container} className="absolute inset-0 z-[35] pointer-events-none">
    {elements.filter(e=>elementActive(e,time)).map(e=>{
      const m=elementMetrics(e,width,height);
      return <div key={e.id} data-mv-selection-target role="button" tabIndex={0} aria-label={`Drag ${e.kind} element`}
        className={`absolute pointer-events-auto touch-none cursor-move rounded border ${selected===e.id?'border-accent':'border-transparent hover:border-accent/50'}`}
        style={{left:e.x*100+'%',top:e.y*100+'%',width:Math.max(28,m.width+8),height:Math.max(22,m.height+8),transform:'translate(-50%,-50%)'}}
        onPointerDown={ev=>{ev.stopPropagation();ev.preventDefault();const r=container.current?.getBoundingClientRect();if(!r)return;
          useLyricsVideoStore.getState().setSelectedElement(null);select(e.id);drag.current={id:e.id,px:ev.clientX,py:ev.clientY,x:e.x,y:e.y,w:r.width,h:r.height,size:e.size,resize:(ev.target as HTMLElement).dataset.resize==='true'};ev.currentTarget.setPointerCapture(ev.pointerId);}}
        onPointerMove={ev=>{const d=drag.current;if(!d||d.id!==e.id)return;const snap=(n:number)=>Math.abs(n-.5)<.015?.5:n;
          if(d.resize){update(e.id,{size:d.size+2*(ev.clientY-d.py)/Math.max(1,Math.min(d.w,d.h))});return;}
          update(e.id,{x:snap(d.x+(ev.clientX-d.px)/Math.max(1,d.w)),y:snap(d.y+(ev.clientY-d.py)/Math.max(1,d.h))});}}
        onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
        onKeyDown={ev=>{const delta=ev.shiftKey ? .025 : .005;const offsets:Record<string,[number,number]>={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
          if(offsets[ev.key]){ev.preventDefault();ev.stopPropagation();useLyricsVideoStore.getState().setSelectedElement(null);select(e.id);update(e.id,{x:e.x+offsets[ev.key][0],y:e.y+offsets[ev.key][1]});}}}>
        {selected===e.id&&<span data-resize="true" title="Drag to resize" className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-accent bg-white cursor-nwse-resize"/>}
      </div>
    })}
  </div>;
}
