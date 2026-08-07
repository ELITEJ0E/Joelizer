import React, { useState, useRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn, formatTime } from '../../lib/utils';
import { useStore } from '../../store/useStore';

interface VideoSliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  buffered?: number;
  formatTooltip?: (value: number) => string;
  className?: string;
  disabled?: boolean;
}

export function VideoSlider({
  value,
  min = 0,
  max,
  step = 0.01,
  onChange,
  buffered = 0,
  formatTooltip = formatTime,
  className,
  disabled = false
}: VideoSliderProps) {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; time: number; pct: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || max <= min) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const hoverTime = min + pct * (max - min);
    setHoverPosition({ x, time: hoverTime, pct: pct * 100 });
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
    setIsHovered(false);
  };

  const safeValue = Math.max(min, Math.min(max, value || 0));

  return (
    <div 
      className={cn("relative w-full flex items-center group select-none py-1.5", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <SliderPrimitive.Root
        ref={trackRef as any}
        value={[safeValue]}
        min={min}
        max={max || 100}
        step={step}
        disabled={disabled}
        onValueChange={(vals) => {
          setIsDragging(true);
          if (vals.length > 0) onChange(vals[0]);
        }}
        onValueCommit={() => setIsDragging(false)}
        className="relative flex items-center w-full h-6 cursor-pointer touch-none"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10 transition-all duration-200 group-hover:h-2.5">
          {/* Buffered Progress */}
          {buffered > 0 && (
            <div 
              className="absolute h-full bg-white/20 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, buffered))}%` }}
            />
          )}

          {/* Hover preview fill */}
          {hoverPosition && !isDragging && (
            <div 
              className="absolute h-full bg-white/15 rounded-full pointer-events-none"
              style={{ width: `${hoverPosition.pct}%` }}
            />
          )}

          {/* Active Range Fill */}
          <SliderPrimitive.Range 
            className="absolute h-full rounded-full transition-all"
            style={{ 
              backgroundColor: activeColor,
              boxShadow: isDragging 
                ? `0 0 16px ${activeColor}` 
                : `0 0 8px ${activeColor}80` 
            }}
          />
        </SliderPrimitive.Track>

        {/* Slider Thumb Handle */}
        <SliderPrimitive.Thumb 
          className={cn(
            "block h-3.5 w-3.5 rounded-full bg-white shadow-xl transition-transform duration-100 focus:outline-none focus-visible:ring-2 disabled:pointer-events-none cursor-grab active:cursor-grabbing",
            (isHovered || isDragging) ? "scale-125" : "scale-95 opacity-90 group-hover:opacity-100"
          )}
          style={{
            boxShadow: `0 0 10px rgba(0,0,0,0.8), 0 0 6px ${activeColor}`
          }}
        />
      </SliderPrimitive.Root>

      {/* Time Hover Preview Tooltip */}
      {(hoverPosition || isDragging) && (
        <div 
          className="absolute bottom-full mb-2 bg-black/95 border border-white/15 text-white text-[9px] font-mono font-bold tracking-wider py-1 px-2 rounded-md pointer-events-none transition-all duration-75 shadow-2xl z-50 whitespace-nowrap flex flex-col items-center"
          style={{ 
            left: isDragging 
              ? `${max > min ? ((safeValue - min) / (max - min)) * 100 : 0}%` 
              : `${hoverPosition?.pct || 0}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <span style={{ color: activeColor }}>
            {formatTooltip(isDragging ? safeValue : (hoverPosition?.time || 0))}
          </span>
          <div className="w-1.5 h-1.5 bg-black/95 border-r border-b border-white/15 rotate-45 -mb-1 mt-0.5" />
        </div>
      )}
    </div>
  );
}
