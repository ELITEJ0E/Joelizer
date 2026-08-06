import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatTime } from '../../lib/utils';
import { RefreshCw } from 'lucide-react';

interface ExportRangeSliderProps {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  activeColor: string;
}

export function ExportRangeSlider({
  duration,
  start,
  end,
  onChange,
  activeColor,
}: ExportRangeSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);

  const resetExportRange = useStore((s) => s.resetExportRange);

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;

  const calculateValueFromCoords = (clientX: number) => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  };

  const handlePointerDown = (clientX: number) => {
    if (duration <= 0) return;
    const clickVal = calculateValueFromCoords(clientX);
    
    // Determine closest handle
    const distToStart = Math.abs(clickVal - start);
    const distToEnd = Math.abs(clickVal - end);
    const handle = distToStart < distToEnd ? 'start' : 'end';
    
    setActiveHandle(handle);
    updateHandleValue(handle, clickVal);
  };

  const updateHandleValue = (handle: 'start' | 'end', value: number) => {
    if (handle === 'start') {
      const newStart = Math.max(0, Math.min(value, end - 0.5));
      onChange(newStart, end);
    } else {
      const newEnd = Math.max(start + 0.5, Math.min(value, duration));
      onChange(start, newEnd);
    }
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const value = calculateValueFromCoords(e.clientX);
      updateHandleValue(activeHandle, value);
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const value = calculateValueFromCoords(e.touches[0].clientX);
        updateHandleValue(activeHandle, value);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [activeHandle, start, end, duration, onChange]);

  // Keyboard support for active handle
  const handleKeyDown = (handle: 'start' | 'end', e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 1.0 : 0.1;
    e.stopPropagation();

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(Math.min(start + step, end - 0.5), end);
      } else {
        onChange(start, Math.min(end + step, duration));
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(Math.max(0, start - step), end);
      } else {
        onChange(start, Math.max(start + 0.5, end - step));
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(0, end);
      } else {
        onChange(start, start + 0.5);
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(end - 0.5, end);
      } else {
        onChange(start, duration);
      }
    }
  };

  const isFullTrack = start === 0 && (end === duration || end === null);

  return (
    <div className="w-full space-y-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl">
      {/* Top Header Label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[2px] text-slate-400 font-bold">
          Export Trim Range
        </span>
        <button
          onClick={() => resetExportRange()}
          disabled={isFullTrack}
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold text-slate-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <RefreshCw size={10} />
          <span>Reset to full track</span>
        </button>
      </div>

      {/* Range Slider Track */}
      <div 
        ref={containerRef}
        onMouseDown={(e) => {
          if (e.button === 0) {
            handlePointerDown(e.clientX);
          }
        }}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handlePointerDown(e.touches[0].clientX);
          }
        }}
        className="relative h-6 flex items-center cursor-pointer select-none outline-none mt-2"
      >
        {/* Full grey bar */}
        <div className="absolute left-0 right-0 h-1.5 bg-white/5 rounded-full" />

        {/* Selected Highlight bar */}
        <div 
          className="absolute h-1.5 rounded-full transition-all duration-75"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            backgroundColor: activeColor,
            opacity: 0.35,
            boxShadow: `0 0 10px ${activeColor}30`
          }}
        />

        {/* Start Handle */}
        <div
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown('start', e)}
          className="absolute w-4 h-4 -ml-2 rounded-full bg-white shadow-lg flex items-center justify-center outline-none focus:ring-2 focus:ring-white/50 transition-all duration-75 hover:scale-110 active:scale-125 z-20 cursor-grab active:cursor-grabbing"
          style={{ 
            left: `${startPct}%`,
            border: `2px solid ${activeColor}`,
            boxShadow: `0 0 8px rgba(0,0,0,0.5)`
          }}
          role="slider"
          aria-label="Start point"
          aria-valuemin={0}
          aria-valuemax={end - 0.5}
          aria-valuenow={start}
        >
          <div className="w-1 h-2 bg-slate-400 rounded-full" />
          {/* Handle tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black border border-white/10 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-30 shadow-lg">
            {formatTime(start)}
          </div>
        </div>

        {/* End Handle */}
        <div
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown('end', e)}
          className="absolute w-4 h-4 -ml-2 rounded-full bg-white shadow-lg flex items-center justify-center outline-none focus:ring-2 focus:ring-white/50 transition-all duration-75 hover:scale-110 active:scale-125 z-20 cursor-grab active:cursor-grabbing"
          style={{ 
            left: `${endPct}%`,
            border: `2px solid ${activeColor}`,
            boxShadow: `0 0 8px rgba(0,0,0,0.5)`
          }}
          role="slider"
          aria-label="End point"
          aria-valuemin={start + 0.5}
          aria-valuemax={duration}
          aria-valuenow={end}
        >
          <div className="w-1 h-2 bg-slate-400 rounded-full" />
          {/* Handle tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black border border-white/10 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-30 shadow-lg">
            {formatTime(end)}
          </div>
        </div>
      </div>

      {/* Readout persistent values */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          Selected Range: <span className="text-white font-bold">{formatTime(end - start)}</span>
        </div>
        <div className="text-slate-500 text-[9px]">
          Total Song: {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
