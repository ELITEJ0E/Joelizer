import React, { useLayoutEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Trash2, Wand2, Volume2, Sparkles, Sliders, Film } from 'lucide-react';

interface TrackHeaderMenuProps {
  trackType: 'vis' | 'lyr' | 'aud';
  anchor: HTMLElement;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function TrackHeaderMenu({trackType,anchor,onClose,onAction}:TrackHeaderMenuProps) {
  const [panel,setPanel]=useState<HTMLDivElement|null>(null);
  useLayoutEffect(()=>{
    if(!panel)return;
    const position=()=>{
      const r=anchor.getBoundingClientRect(), v=window.visualViewport;
      const left=v?.offsetLeft??0, top=v?.offsetTop??0;
      const right=left+(v?.width??window.innerWidth), bottom=top+(v?.height??window.innerHeight);
      const margin=8,gap=6;
      const above=Math.max(0,r.top-top-margin-gap), below=Math.max(0,bottom-r.bottom-margin-gap);
      panel.style.maxWidth=Math.max(0,right-left-margin*2)+'px';
      const natural=panel.scrollHeight+2;
      // Prefer upward when the entire menu cannot fit below the trigger.
      const up=natural>below && (natural<=above || above>=below);
      panel.style.maxHeight=Math.max(0,up?above:below)+'px';
      const w=panel.offsetWidth,h=panel.offsetHeight;
      panel.style.left=Math.max(left+margin,Math.min(r.left,right-margin-w))+'px';
      panel.style.top=(up?r.top-gap-h:r.bottom+gap)+'px';
      panel.dataset.side=up?'top':'bottom';
      panel.style.visibility='visible';
    };
    position();
    const observer=new ResizeObserver(position);observer.observe(panel);observer.observe(anchor);
    window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    window.visualViewport?.addEventListener('resize',position);
    window.visualViewport?.addEventListener('scroll',position);
    return ()=>{observer.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};
  },[panel,anchor]);
  return <Dialog.Root open modal={false} onOpenChange={open=>{if(!open)onClose();}}>
    <Dialog.Portal container={document.fullscreenElement||document.body}>
      <Dialog.Content ref={setPanel} data-mv-track-popup aria-describedby={undefined}
        className="fixed z-[9000] w-[224px] overflow-y-auto overscroll-contain rounded-md border border-[#343e4d] bg-[#10151d] py-1 text-xs text-[#c9d1d9] shadow-lg outline-none font-mono"
        style={{visibility:'hidden'}}
        onCloseAutoFocus={e=>{e.preventDefault();}}
        onInteractOutside={e=>{const target=e.detail.originalEvent.target;if(target instanceof Node&&anchor.contains(target))e.preventDefault();}}
        onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
        <Dialog.Title className="sr-only">{trackType==='vis'?'Visual track options':trackType==='lyr'?'Lyrics track options':'Audio track options'}</Dialog.Title>
      {trackType === 'vis' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('add-visualizer'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sparkles size={12} className="text-accent" />
            <span>Add Visualizer Scene</span>
          </button>
          <button
            onClick={() => { onAction('add-vinyl'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Film size={12} className="text-[#a78bfa]" />
            <span>Add Vinyl Lyrics Scene</span>
          </button>
          <button
            onClick={() => { onAction('auto-fill'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Wand2 size={12} className="text-[#38bdf8]" />
            <span>Auto-Fill With Assets</span>
          </button>
          <button
            onClick={() => { onAction('clear-clips'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-950/40 flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={12} />
            <span>Clear Visual Track</span>
          </button>
        </div>
      )}

      {trackType === 'lyr' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('add-line'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Plus size={12} className="text-accent" />
            <span>Add Line at Playhead</span>
          </button>
          <button
            onClick={() => { onAction('generate-words'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Wand2 size={12} className="text-[#fbbf24]" />
            <span>Auto-Generate Words</span>
          </button>
          <button
            onClick={() => { onAction('align-beats'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sparkles size={12} className="text-[#2dd4bf]" />
            <span>Align Lines to Beats</span>
          </button>
          <button
            onClick={() => { onAction('clear-lyrics'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-950/40 flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={12} />
            <span>Clear All Lyrics</span>
          </button>
        </div>
      )}

      {trackType === 'aud' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('reset-volume'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Volume2 size={12} className="text-accent" />
            <span>Reset Volume (100%)</span>
          </button>
          <button
            onClick={() => { onAction('generate-peaks'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sliders size={12} className="text-accent" />
            <span>Re-analyze Audio Waveform</span>
          </button>
        </div>
      )}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
