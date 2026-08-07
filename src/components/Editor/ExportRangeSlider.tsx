import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatTime } from '../../lib/utils';
import { RefreshCw, Play, Square, Volume2 } from 'lucide-react';

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
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const resetExportRange = useStore((s) => s.resetExportRange);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const currentTime = useStore((s) => s.currentTime);
  const setCurrentTime = useStore((s) => s.setCurrentTime);

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const currentPct = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;

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

  // Toggle range preview audio playback
  const toggleRangePreview = () => {
    const audioEl = document.querySelector('audio');
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setIsPlaying(false);
      if (audioEl) audioEl.pause();
    } else {
      setIsPreviewPlaying(true);
      if (audioEl) {
        audioEl.currentTime = start;
        audioEl.play().catch(() => {});
      }
      setCurrentTime(start);
      setIsPlaying(true);
    }
  };

  // Monitor range preview playback and loop back to start when reaching end
  useEffect(() => {
    if (!isPreviewPlaying) return;

    const checkInterval = setInterval(() => {
      const audioEl = document.querySelector('audio');
      if (audioEl) {
        const curr = audioEl.currentTime;
        if (curr >= end || curr < start - 0.5) {
          audioEl.currentTime = start;
          setCurrentTime(start);
        } else {
          setCurrentTime(curr);
        }
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [isPreviewPlaying, start, end, setCurrentTime]);

  // Turn off preview state if playback is stopped elsewhere
  useEffect(() => {
    if (!isPlaying && isPreviewPlaying) {
      setIsPreviewPlaying(false);
    }
  }, [isPlaying, isPreviewPlaying]);

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
      {/* Top Header Label & Preview Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[2px] text-slate-400 font-bold">
            Export Trim Range
          </span>
          <button
            type="button"
            onClick={toggleRangePreview}
            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-md text-[10px] font-mono transition-all cursor-pointer border border-white/15"
            title="Preview selected audio range before exporting"
          >
            {isPreviewPlaying ? (
              <>
                <Square size={10} className="fill-current text-amber-400" />
                <span className="text-amber-400 font-bold">Stop Preview</span>
              </>
            ) : (
              <>
                <Play size={10} className="fill-current text-emerald-400" />
                <span className="font-bold">Play Range</span>
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => {
            if (isPreviewPlaying) {
              setIsPreviewPlaying(false);
              setIsPlaying(false);
            }
            resetExportRange();
          }}
          disabled={isFullTrack}
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold text-slate-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <RefreshCw size={10} />
          <span>Reset to full</span>
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
        className="relative h-7 flex items-center cursor-pointer select-none outline-none mt-2"
      >
        {/* Full grey bar */}
        <div className="absolute left-0 right-0 h-2 bg-white/10 rounded-full" />

        {/* Selected Highlight bar */}
        <div 
          className="absolute h-2 rounded-full transition-all duration-75"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            backgroundColor: activeColor,
            opacity: 0.45,
            boxShadow: `0 0 12px ${activeColor}40`
          }}
        />

        {/* Live playback cursor line */}
        {duration > 0 && currentTime >= start && currentTime <= end && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none transition-all duration-75 shadow-[0_0_8px_#ffffff]"
            style={{ left: `${currentPct}%` }}
          />
        )}

        {/* Start Handle */}
        <div
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            setActiveHandle('start');
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setActiveHandle('start');
          }}
          onKeyDown={(e) => handleKeyDown('start', e)}
          className="absolute w-5 h-5 -ml-2.5 rounded-full bg-white shadow-xl flex items-center justify-center outline-none focus:ring-2 focus:ring-white/80 transition-transform duration-75 hover:scale-125 active:scale-125 z-20 cursor-grab active:cursor-grabbing"
          style={{ 
            left: `${startPct}%`,
            border: `2px solid ${activeColor}`,
            boxShadow: `0 0 10px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="Start point"
          aria-valuemin={0}
          aria-valuemax={end - 0.5}
          aria-valuenow={start}
        >
          <div className="w-1 h-2 bg-slate-600 rounded-full" />
          {/* Handle tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black border border-white/20 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-30 shadow-lg font-bold">
            {formatTime(start)}
          </div>
        </div>

        {/* End Handle */}
        <div
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            setActiveHandle('end');
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setActiveHandle('end');
          }}
          onKeyDown={(e) => handleKeyDown('end', e)}
          className="absolute w-5 h-5 -ml-2.5 rounded-full bg-white shadow-xl flex items-center justify-center outline-none focus:ring-2 focus:ring-white/80 transition-transform duration-75 hover:scale-125 active:scale-125 z-20 cursor-grab active:cursor-grabbing"
          style={{ 
            left: `${endPct}%`,
            border: `2px solid ${activeColor}`,
            boxShadow: `0 0 10px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="End point"
          aria-valuemin={start + 0.5}
          aria-valuemax={duration}
          aria-valuenow={end}
        >
          <div className="w-1 h-2 bg-slate-600 rounded-full" />
          {/* Handle tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black border border-white/20 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-30 shadow-lg font-bold">
            {formatTime(end)}
          </div>
        </div>
      </div>

      {/* Readout persistent values */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          <span>Range:</span>
          <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
            {formatTime(start)} — {formatTime(end)} ({formatTime(end - start)})
          </span>
        </div>
        <div className="text-slate-500 text-[9px]">
          Total: {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
