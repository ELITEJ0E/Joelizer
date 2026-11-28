import React, {useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

/** A contextual surface in the preview's coordinate space, never a timeline row.
 * The outer wrapper doesn't intercept pointer events in the rest of the preview. */
export function FloatingContextBar({children,hidden,onClose}:{
  children:React.ReactNode;hidden:boolean;onClose:()=>void;
}) {
  const [host,setHost]=useState<HTMLElement|null>(null);
  useLayoutEffect(()=>{
    setHost(document.querySelector<HTMLElement>('[data-mv-preview-area]'));
  },[]);
  if(!host||hidden)return null;
  return createPortal(
    <div data-mv-context-float className="pointer-events-none absolute inset-x-2 bottom-2 z-40 flex justify-center">
      <section aria-label="Selected timeline item actions" data-mv-context-dock
        className="pointer-events-auto relative flex min-w-0 max-w-full max-h-[min(100px,calc(100%-8px))] items-start gap-1 rounded-lg border border-[#303946] bg-[#10151d]/95 p-1 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150"
        onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
        onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
        onContextMenu={e=>e.stopPropagation()}>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        <button type="button" title="Deselect timeline item" aria-label="Deselect timeline item"
          onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent">
          <X size={13}/>
        </button>
      </section>
    </div>,host);
}
