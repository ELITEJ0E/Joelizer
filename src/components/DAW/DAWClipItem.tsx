import React, { useRef, useEffect } from 'react';
import { Scissors, Copy, Trash2, Volume2, VolumeX, Move } from 'lucide-react';
import { DAWClip, DAWTrack } from '../../types/daw';
import { useDAWStore } from '../../store/useDAWStore';

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

  // Handle Dragging Clip to Reposition in Time
  const handleMouseDownMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(clip.id);

    if (activeTool === 'split') {
      splitClip(clip.id, currentTime);
      return;
    }
    if (activeTool === 'erase') {
      removeClip(clip.id);
      return;
    }

    const startX = e.clientX;
    const initialStartTime = clip.startTime;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / zoom;
      let newTime = Math.max(0, initialStartTime + deltaSec);

      if (snapToGrid) {
        const beatSec = 60 / bpm;
        newTime = Math.round(newTime / (beatSec / 4)) * (beatSec / 4);
      }

      moveClip(clip.id, clip.trackId, newTime);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Left Trim Handle
  const handleMouseDownTrimLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialStartTime = clip.startTime;
    const initialDuration = clip.duration;
    const initialSourceStart = clip.sourceStart;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / zoom;
      const newDuration = Math.max(0.2, initialDuration - deltaSec);
      const newStartTime = Math.max(0, initialStartTime + deltaSec);
      const newSourceStart = Math.max(0, initialSourceStart + deltaSec);

      trimClip(clip.id, newStartTime, newDuration, newSourceStart, clip.sourceEnd);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Right Trim Handle
  const handleMouseDownTrimRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialDuration = clip.duration;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / zoom;
      const newDuration = Math.max(0.2, initialDuration + deltaSec);

      trimClip(clip.id, clip.startTime, newDuration, clip.sourceStart, clip.sourceStart + newDuration);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
