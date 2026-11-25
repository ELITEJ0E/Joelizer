import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { formatTime } from '../../lib/utils';
import { parseExportTimeInput } from '../../lib/exportTimeInput';
import { RefreshCw, Play, Square, Scissors } from 'lucide-react';
import { WaveformTimeline } from './WaveformTimeline';

const MIN_RANGE = 0.01;

function preciseTime(seconds: number): string {
  const centiseconds = Math.round(Math.max(0, seconds) * 100);
  const minutes = Math.floor(centiseconds / 6000);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

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
  const dragging = useRef<'start' | 'end' | null>(null);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const [startInput, setStartInput] = useState(() => preciseTime(start));
  const [endInput, setEndInput] = useState(() => preciseTime(end));
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const currentTime = useStore((s) => s.currentTime);
  const setCurrentTime = useStore((s) => s.setCurrentTime);
  const waveformPeaks = useStore((s) => s.waveformPeaks);

  useEffect(() => { if (editing !== 'start') setStartInput(preciseTime(start)); }, [start, editing]);
  useEffect(() => { if (editing !== 'end') setEndInput(preciseTime(end)); }, [end, editing]);

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const currentPct = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;

  const calculateValueFromCoords = (clientX: number) => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  };

  const handlePointerDown = (clientX: number, forcedHandle?: 'start' | 'end') => {
    if (duration <= 0) return;
    const clickVal = calculateValueFromCoords(clientX);
    const threshold = Math.max(0.07, duration * 0.018);
    const distanceStart = Math.abs(clickVal - start);
    const distanceEnd = Math.abs(clickVal - end);
    const handle = forcedHandle || (Math.min(distanceStart, distanceEnd) <= threshold
      ? distanceStart <= distanceEnd ? 'start' : 'end' : null);
    if (handle) {
      dragging.current = handle;
      setActiveHandle(handle);
      updateHandleValue(handle, clickVal);
    } else if (clickVal >= start && clickVal <= end) {
      setCurrentTime(clickVal);
      const audioEl = document.querySelector('audio');
      if (audioEl) audioEl.currentTime = clickVal;
    } else {
      const nearest = distanceStart < distanceEnd ? 'start' : 'end';
      dragging.current = nearest;
      setActiveHandle(nearest);
      updateHandleValue(nearest, clickVal);
    }
  };

  const updateHandleValue = (handle: 'start' | 'end', value: number) => {
    if (handle === 'start') {
      const newStart = Math.max(0, Math.min(value, end - MIN_RANGE));
      onChange(newStart, end);
    } else {
      const newEnd = Math.max(start + MIN_RANGE, Math.min(value, duration));
      onChange(start, newEnd);
    }
  };

  const commitInput = (handle: 'start' | 'end') => {
    const parsed = parseExportTimeInput(handle === 'start' ? startInput : endInput);
    if (parsed !== null) updateHandleValue(handle, parsed);
    setEditing(null);
    setStartInput(preciseTime(handle === 'start' && parsed !== null ? Math.max(0, Math.min(parsed, end - MIN_RANGE)) : start));
    setEndInput(preciseTime(handle === 'end' && parsed !== null ? Math.max(start + MIN_RANGE, Math.min(parsed, duration)) : end));
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

  // Keyboard accessibility support
  const handleKeyDown = (handle: 'start' | 'end', e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.altKey ? 0.01 : e.shiftKey ? 1.0 : 0.1;
    e.stopPropagation();

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(Math.min(start + step, end - MIN_RANGE), end);
      } else {
        onChange(start, Math.min(end + step, duration));
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(Math.max(0, start - step), end);
      } else {
        onChange(start, Math.max(start + MIN_RANGE, end - step));
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(0, end);
      } else {
        onChange(start, start + MIN_RANGE);
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      if (handle === 'start') {
        onChange(end - MIN_RANGE, end);
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
            <span>Joelizer Precision Trim</span>
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
            onChange(0, duration);
          }}
          disabled={isFullTrack}
          className="flex items-center gap-1 text-[9px] font-mono uppercase font-bold text-slate-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <RefreshCw size={10} />
          <span>Reset</span>
        </button>
      </div>

      {/* High precision waveform range editor */}
      <div 
        ref={containerRef}
        onPointerDown={e => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          const node = (e.target as HTMLElement).closest('[data-trim-handle]');
          const forced = node?.getAttribute('data-trim-handle') as 'start' | 'end' | null;
          handlePointerDown(e.clientX, forced || undefined);
          if (dragging.current) e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (dragging.current) updateHandleValue(dragging.current, calculateValueFromCoords(e.clientX));
        }}
        onPointerUp={e => {
          dragging.current = null;
          setActiveHandle(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { dragging.current = null; setActiveHandle(null); }}
        className="relative h-16 sm:h-20 w-full bg-black/60 rounded-lg overflow-hidden border border-white/15 cursor-ew-resize select-none touch-none outline-none group"
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
          data-trim-handle="start"
          onKeyDown={(e) => handleKeyDown('start', e)}
          className={`absolute top-0 bottom-0 w-3.5 -ml-3.5 z-30 bg-white border-y-2 border-l-2 rounded-l-md shadow-2xl flex flex-col items-center justify-center cursor-ew-resize outline-none focus:ring-2 focus:ring-white ${activeHandle === 'start' ? 'brightness-125' : ''}`}
          style={{ 
            left: `${startPct}%`,
            borderColor: activeColor,
            backgroundColor: activeColor,
            boxShadow: `0 0 12px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="Export Start handle"
          aria-valuemin={0}
          aria-valuemax={end - MIN_RANGE}
          aria-valuenow={start}
        >
          {/* NLE Vertical Grip Lines */}
          <div className="flex flex-col gap-1 items-center justify-center">
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
            <div className="w-0.5 h-3.5 bg-black/70 rounded-full" />
          </div>

          {/* Time Tooltip */}
          <div className="absolute bottom-full mb-1.5 px-1.5 py-0.5 bg-black/90 border border-white/20 text-white text-[9px] font-mono rounded pointer-events-none whitespace-nowrap z-40 shadow-xl font-bold tracking-wider">
            IN: {preciseTime(start)}
          </div>
        </div>

        {/* Professional NLE Full-Height Right Handle */}
        <div
          tabIndex={0}
          data-trim-handle="end"
          onKeyDown={(e) => handleKeyDown('end', e)}
          className={`absolute top-0 bottom-0 w-3.5 z-30 bg-white border-y-2 border-r-2 rounded-r-md shadow-2xl flex flex-col items-center justify-center cursor-ew-resize outline-none focus:ring-2 focus:ring-white ${activeHandle === 'end' ? 'brightness-125' : ''}`}
          style={{ 
            left: `${endPct}%`,
            borderColor: activeColor,
            backgroundColor: activeColor,
            boxShadow: `0 0 12px rgba(0,0,0,0.8)`
          }}
          role="slider"
          aria-label="Export End handle"
          aria-valuemin={start + MIN_RANGE}
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
            OUT: {preciseTime(end)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        {(['start', 'end'] as const).map(handle => (
          <label key={handle} className="min-w-0 space-y-1">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
              {handle === 'start' ? 'Start / In' : 'End / Out'}
            </span>
            <input type="text" inputMode="decimal" spellCheck={false}
              aria-label={handle === 'start' ? 'Trim start time' : 'Trim end time'}
              value={handle === 'start' ? startInput : endInput}
              onFocus={() => setEditing(handle)}
              onChange={e => handle === 'start' ? setStartInput(e.target.value) : setEndInput(e.target.value)}
              onBlur={() => commitInput(handle)}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  handle === 'start' ? setStartInput(preciseTime(start)) : setEndInput(preciseTime(end));
                  e.currentTarget.blur();
                }
              }}
              placeholder="00:00.00"
              className="h-9 w-full rounded-md border border-white/15 bg-black/40 px-2.5 font-mono text-sm text-white outline-none focus:border-emerald-400" />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Type 040185 for 04:01.85, 0123 for 01:23, or enter 01:23.25 normally. Drag handles to trim; arrows adjust by 0.1s, Alt by 0.01s, Shift by 1s.
      </p>

      {/* Readout persistent values */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Duration:</span>
          <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded text-[10px]" style={{ color: activeColor }}>
            {preciseTime(end - start)}
          </span>
          <span className="text-slate-500 text-[9px]">
            ({preciseTime(start)} → {preciseTime(end)})
          </span>
        </div>
        <div className="text-slate-400 text-[9px]">
          Total: {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
