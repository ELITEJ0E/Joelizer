import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatTime } from '../../lib/utils';
import { RefreshCw, Play, Square, Scissors } from 'lucide-react';
import { WaveformTimeline } from './WaveformTimeline';

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
  const waveformPeaks = useStore((s) => s.waveformPeaks);

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
    
    // Determine closest handle or range interaction
    const distToStart = Math.abs(clickVal - start);
    const distToEnd = Math.abs(clickVal - end);
    const handleThreshold = duration * 0.04; // 4% tolerance threshold for handle selection

    if (distToStart < handleThreshold || distToStart <= distToEnd) {
      setActiveHandle('start');
      updateHandleValue('start', clickVal);
    } else if (distToEnd < handleThreshold) {
      setActiveHandle('end');
      updateHandleValue('end', clickVal);
    } else {
      // Seek playback if clicking inside active region
      if (clickVal >= start && clickVal <= end) {
        setCurrentTime(clickVal);
        const audioEl = document.querySelector('audio');
        if (audioEl) audioEl.currentTime = clickVal;
      }
    }
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

  // Global mouse/touch drag listeners with cursor locking
  useEffect(() => {
    if (!activeHandle) return;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const value = calculateValueFromCoords(e.clientX);
      updateHandleValue(activeHandle, value);
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [activeHandle, start, end, duration, onChange]);

  // Keyboard accessibility support
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
    <div className="w-full space-y-2.5 p-3.5 bg-white/[0.02] border border-white/10 rounded-xl select-none">
      {/* Top Header Label & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[1.5px] text-slate-300 font-black">
            <Scissors size={12} style={{ color: activeColor }} />
            <span>CapCut Timeline Trim</span>
          </div>

          <button
            type="button"
            onClick={toggleRangePreview}
            className="flex items-center gap-1 px-2 py-0.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-md text-[10px] font-mono transition-all cursor-pointer border border-white/15"
            title="Preview selected audio range"
          >
            {isPreviewPlaying ? (
              <>
                <Square size={10} className="fill-current text-amber-400" />
                <span className="text-amber-400 font-bold">Stop</span>
              </>
            ) : (
              <>
                <Play size={10} className="fill-current text-emerald-400" />
                <span className="font-bold">Play</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isPreviewPlaying) {
              setIsPreviewPlaying(false);
              setIsPlaying(false);
            }
            resetExportRange();
          }}
          disabled={isFullTrack}
          className="flex items-center gap-1 text-[9px] font-mono uppercase font-bold text-slate-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <RefreshCw size={10} />
          <span>Reset</span>
        </button>
      </div>

      {/* CapCut-Style Waveform Timeline Track Container */}
      <div 
        ref={containerRef}
        onMouseDown={(e) => {
          if (e.button === 0) handlePointerDown(e.clientX);
        }}
        onTouchStart={(e) => {
          if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX);
        }}
        className="relative h-16 sm:h-20 w-full bg-black/60 rounded-lg overflow-hidden border border-white/15 cursor-ew-resize select-none outline-none group"
      >
        {/* Peak Data Integration: Waveform Timeline Component rendered behind the slider */}
        <div className="absolute inset-0 z-0 opacity-90">
          <WaveformTimeline
            peaks={waveformPeaks}
            startPct={startPct}
            endPct={endPct}
            activeColor={activeColor}
          />
        </div>

        {/* Dimmed Excluded Region - Left Side (0 to startPct) */}
        <div 
          className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] z-10 pointer-events-none border-r border-white/10 bg-[linear-gradient(45deg,rgba(0,0,0,0.35)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.35)_50%,rgba(0,0,0,0.35)_75%,transparent_75%,transparent)] bg-[length:10px_10px]"
          style={{ width: `${startPct}%` }}
        />

        {/* Dimmed Excluded Region - Right Side (endPct to 100%) */}
        <div 
          className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px] z-10 pointer-events-none border-l border-white/10 bg-[linear-gradient(45deg,rgba(0,0,0,0.35)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.35)_50%,rgba(0,0,0,0.35)_75%,transparent_75%,transparent)] bg-[length:10px_10px]"
          style={{ width: `${100 - endPct}%` }}
        />

        {/* Trimmed Active Highlight Frame (startPct to endPct) */}
        <div 
          className="absolute top-0 bottom-0 z-15 pointer-events-none border-t-2 border-b-2 shadow-inner"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            borderColor: activeColor,
            backgroundColor: `${activeColor}12`,
            boxShadow: `inset 0 0 15px ${activeColor}20`
          }}
        />

        {/* Live Playhead Indicator Line */}
        {duration > 0 && currentTime >= start && currentTime <= end && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white z-25 pointer-events-none shadow-[0_0_8px_#ffffff] transition-all duration-75"
            style={{ left: `${currentPct}%` }}
          >
            {/* Top Playhead Cap */}
            <div 
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white shadow-md rounded-xs"
            />
          </div>
        )}

        {/* Professional NLE Full-Height Left Handle */}
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
          className="absolute top-0 bottom-0 w-3.5 -ml-3.5 z-30 bg-white border-y-2 border-l-2 rounded-l-md shadow-2xl flex flex-col items-center justify-center cursor-ew-resize outline-none focus:ring-2 focus:ring-white transition-transform hover:scale-x-110 active:scale-x-110"
          style={{ 
            left: `${startPct}%`,
            borderColor: activeColor,
            backgroundColor: activeColor,
            boxShadow: `0 0 12px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="Export Start handle"
          aria-valuemin={0}
          aria-valuemax={end - 0.5}
          aria-valuenow={start}
        >
          {/* NLE Vertical Grip Lines */}
          <div className="flex flex-col gap-1 items-center justify-center">
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
          </div>

          {/* Time Tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black/90 border border-white/20 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-40 shadow-xl font-bold tracking-wider">
            IN: {formatTime(start)}
          </div>
        </div>

        {/* Professional NLE Full-Height Right Handle */}
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
          className="absolute top-0 bottom-0 w-3.5 z-30 bg-white border-y-2 border-r-2 rounded-r-md shadow-2xl flex flex-col items-center justify-center cursor-ew-resize outline-none focus:ring-2 focus:ring-white transition-transform hover:scale-x-110 active:scale-x-110"
          style={{ 
            left: `${endPct}%`,
            borderColor: activeColor,
            backgroundColor: activeColor,
            boxShadow: `0 0 12px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="Export End handle"
          aria-valuemin={start + 0.5}
          aria-valuemax={duration}
          aria-valuenow={end}
        >
          {/* NLE Vertical Grip Lines */}
          <div className="flex flex-col gap-1 items-center justify-center">
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
          </div>

          {/* Time Tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black/90 border border-white/20 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-40 shadow-xl font-bold tracking-wider">
            OUT: {formatTime(end)}
          </div>
        </div>
      </div>

      {/* Readout persistent values */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Duration:</span>
          <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded text-[10px]" style={{ color: activeColor }}>
            {formatTime(end - start)}
          </span>
          <span className="text-slate-500 text-[9px]">
            ({formatTime(start)} → {formatTime(end)})
          </span>
        </div>
        <div className="text-slate-400 text-[9px]">
          Total: {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
