import React, { useRef, useEffect } from 'react';
import { Scissors, Copy, Trash2, Volume2, VolumeX, Move } from 'lucide-react';
import { DAWClip, DAWTrack } from '../../types/daw';
import { useDAWStore } from '../../store/useDAWStore';
import { snapDawTime, clampDawTrim } from '../../lib/dawGrid';

interface DAWClipItemProps {
  key?: React.Key;
  clip: DAWClip;
  track: DAWTrack;
  isSelected: boolean;
  zoom: number; // Pixels per second
  onSelect: (clipId: string) => void;
}

export function DAWClipItem({ clip, track, isSelected, zoom, onSelect }: DAWClipItemProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const updateClip = useDAWStore(s => s.updateClip);
  const removeClip = useDAWStore(s => s.removeClip);
  const splitClip = useDAWStore(s => s.splitClip);
  const duplicateClip = useDAWStore(s => s.duplicateClip);
  const trimClip = useDAWStore(s => s.trimClip);
  const moveClip = useDAWStore(s => s.moveClip);
  const currentTime = useDAWStore(s => s.currentTime);
  const activeTool = useDAWStore(s => s.activeTool);
  const snapToGrid = useDAWStore(s => s.snapToGrid);
  const gridDivision = useDAWStore(s => s.gridDivision);
  const bpm = useDAWStore(s => s.bpm);

  const clipLeft = clip.startTime * zoom;
  const clipWidth = Math.max(16, clip.duration * zoom);

  // Draw clip waveform onto mini canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const peaks = clip.peaks || [];
    if (peaks.length === 0) {
      // Draw subtle placeholder waveform line
      ctx.strokeStyle = `${track.color}80`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    const centerY = h / 2;
    const maxAmp = (h / 2) * 0.85;
    const totalPeaks = peaks.length;

    // Determine start and end peak slices according to source trim
    const sourceDuration = clip.sourceEnd - clip.sourceStart;
    const peakStep = w / (totalPeaks || 1);

    ctx.fillStyle = isSelected ? '#ffffff' : track.color;

    for (let i = 0; i < totalPeaks; i++) {
      const val = peaks[i] || 0;
      const barH = Math.max(2, val * maxAmp);
      const x = i * peakStep;
      ctx.fillRect(x, centerY - barH, Math.max(1, peakStep - 0.5), barH * 2);
    }
  }, [clip.peaks, clipWidth, track.color, isSelected]);

  // Drag feedback is drawn directly on the element and applied once at
  // pointer-up. Rewriting the full Zustand track tree at every mousemove
  // previously caused audio glitches and hundreds of undo snapshots.
  const handleMouseDownMove = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(clip.id);
    const element = e.currentTarget;
    if (activeTool === 'split') {
      const offset = Math.max(0, Math.min(clip.duration, (e.clientX - element.getBoundingClientRect().left) / zoom));
      splitClip(clip.id, snapDawTime(clip.startTime + offset, bpm, gridDivision, snapToGrid));
      return;
    }
    if (activeTool === 'erase') {
      removeClip(clip.id);
      return;
    }

    const startX = e.clientX;
    const initialStart = clip.startTime;
    let pending = initialStart;
    const onMouseMove = (event: MouseEvent) => {
      pending = snapDawTime(initialStart + (event.clientX - startX) / zoom,bpm,gridDivision,snapToGrid);
      element.style.transform = 'translate3d(' + ((pending - initialStart) * zoom) + 'px,0,0)';
    };
    const onMouseUp = () => {
      element.style.transform = '';
      window.removeEventListener('mousemove',onMouseMove);
      window.removeEventListener('mouseup',onMouseUp);
      if (Math.abs(pending-initialStart) > 0.00001)
        moveClip(clip.id,clip.trackId,pending);
    };
    window.addEventListener('mousemove',onMouseMove);
    window.addEventListener('mouseup',onMouseUp);
  };

  const handleMouseDownTrimLeft = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if(e.button!==0)return;
    const element = e.currentTarget.parentElement;
    if(!element)return;
    const startX=e.clientX;
    let next={start:clip.startTime,duration:clip.duration,offset:0};
    const onMove=(event:MouseEvent)=>{
      const intended=snapToGrid?
        snapDawTime(clip.startTime+(event.clientX-startX)/zoom,bpm,gridDivision,true)-clip.startTime
        :(event.clientX-startX)/zoom;
      const sourceLimit=Math.max(-clip.sourceStart,intended);
      next=clampDawTrim(clip.startTime,clip.duration,sourceLimit,true);
      element.style.left=(next.start*zoom)+'px';
      element.style.width=(next.duration*zoom)+'px';
    };
    const onUp=()=>{
      element.style.left='';element.style.width='';
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
      if(Math.abs(next.offset)>0.00001)
        trimClip(clip.id,next.start,next.duration,clip.sourceStart+next.offset,clip.sourceEnd);
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
  };

  const handleMouseDownTrimRight = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if(e.button!==0)return;
    const element=e.currentTarget.parentElement;
    if(!element)return;
    const startX=e.clientX;
    let duration=clip.duration;
    const onMove=(event:MouseEvent)=>{
      const desired=snapDawTime(clip.startTime+clip.duration+(event.clientX-startX)/zoom,bpm,gridDivision,snapToGrid);
      duration=Math.max(0.1,desired-clip.startTime);
      element.style.width=(duration*zoom)+'px';
    };
    const onUp=()=>{
      element.style.width='';
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
      if(Math.abs(duration-clip.duration)>0.00001)
        trimClip(clip.id,clip.startTime,duration,clip.sourceStart,clip.sourceStart+duration);
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDownMove}
      className={`absolute top-2 bottom-2 rounded-lg overflow-hidden select-none cursor-grab active:cursor-grabbing border group transition-shadow ${
        isSelected
          ? 'border-white ring-2 ring-white/50 shadow-xl z-20'
          : 'border-white/20 hover:border-white/40 z-10'
      }`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        backgroundColor: `${track.color}25`
      }}
    >
      {/* Top Header Bar */}
      <div 
        className="h-5 px-2 flex items-center justify-between text-[10px] font-bold text-white font-mono truncate"
        style={{ backgroundColor: `${track.color}cc` }}
      >
        <span className="truncate">{clip.name}</span>
        <span className="text-[9px] opacity-80 shrink-0 ml-1">
          {clip.duration.toFixed(1)}s
        </span>
      </div>

      {/* Waveform Canvas */}
      <div className="w-full h-full relative">
        <canvas ref={canvasRef} className="w-full h-[calc(100%-20px)] block" />
      </div>

      {/* Left Trim Handle */}
      <div
        onMouseDown={handleMouseDownTrimLeft}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity z-30"
        title="Drag to trim start"
      />

      {/* Right Trim Handle */}
      <div
        onMouseDown={handleMouseDownTrimRight}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity z-30"
        title="Drag to trim end"
      />

      {/* Clip Floating Action Tools (on Hover) */}
      <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30 bg-black/80 rounded p-0.5 border border-white/20">
        <button
          onClick={e => {
            e.stopPropagation();
            splitClip(clip.id, currentTime);
          }}
          className="p-1 hover:bg-white/20 rounded text-white"
          title="Split at Playhead"
        >
          <Scissors size={10} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            duplicateClip(clip.id);
          }}
          className="p-1 hover:bg-white/20 rounded text-white"
          title="Duplicate Clip"
        >
          <Copy size={10} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            removeClip(clip.id);
          }}
          className="p-1 hover:bg-rose-500/40 text-rose-300 rounded"
          title="Delete Clip"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
