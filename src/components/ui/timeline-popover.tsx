import React, { useLayoutEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
export interface TimelinePopupAnchor { x:number; y:number; element?:HTMLElement }
export function timelinePopupAnchor(element:HTMLElement):TimelinePopupAnchor {
  const r=element.getBoundingClientRect(); return {x:r.left,y:r.top,element};
}
/** Non-modal shadcn-style Radix surface. No scroll lock or timeline clipping. */
export function TimelinePopover({anchor,title,onClose,children,width=248}:{
  anchor:TimelinePopupAnchor;title:string;onClose:()=>void;children:React.ReactNode;width?:number
}) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    const place=()=>{
      const v=window.visualViewport, left=v?.offsetLeft??0,top=v?.offsetTop??0;
      const right=left+(v?.width??window.innerWidth),bottom=top+(v?.height??window.innerHeight);
      const r=anchor.element?.isConnected?anchor.element.getBoundingClientRect():null;
      const x=r?.left??anchor.x,y=r?.top??anchor.y,after=r?.bottom??anchor.y;
      el.style.maxWidth=Math.max(0,right-left-16)+'px';
      el.style.maxHeight=Math.max(0,bottom-top-16)+'px';
      const w=el.offsetWidth,h=el.offsetHeight;
      el.style.left=Math.max(left+8,Math.min(x,right-w-8))+'px';
      el.style.top=Math.max(top+8,Math.min(y-h-6>=top+8?y-h-6:after+6,bottom-h-8))+'px';
      el.style.visibility='visible';
    };
    place();const observer=new ResizeObserver(place);observer.observe(el);
    if(anchor.element?.isConnected)observer.observe(anchor.element);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    window.visualViewport?.addEventListener('resize',place);
    return ()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);};
  },[anchor.x,anchor.y,anchor.element,width]);
  return <Dialog.Root open modal={false} onOpenChange={open=>{if(!open)onClose();}}>
    <Dialog.Portal container={typeof document!=='undefined'?document.fullscreenElement||document.body:undefined}>
      <Dialog.Content ref={ref} aria-describedby={undefined} data-mv-timeline-popup
        className="fixed z-[9000] overflow-auto overscroll-contain rounded-lg border border-[#343e4d] bg-[#10151d] text-[#e5edf6] shadow-lg outline-none font-mono"
        style={{width,visibility:'hidden'}} onCloseAutoFocus={e=>e.preventDefault()}
        onPointerDownOutside={e=>{const target=e.detail.originalEvent.target;if(target instanceof Node&&anchor.element?.contains(target))e.preventDefault();}}
        onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
        onClick={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>{children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
