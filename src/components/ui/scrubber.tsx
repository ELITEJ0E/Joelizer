import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

interface ScrubberProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  color?: string;
  className?: string;
  formatTooltip?: (val: number) => string;
}

export function Scrubber({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  color,
  className = '',
  formatTooltip
}: ScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  
  const activeThemeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const barColor = color || activeThemeColor;

  // Safe percentage calculation
  const range = max - min;
  const percentage = range > 0 ? ((value - min) / range) * 100 : 0;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  const calculateValueFromCoords = (clientX: number) => {
    if (!containerRef.current || range <= 0) return min;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const rawVal = min + pct * range;
    
    // Snapping to step
    const steppedVal = Math.round(rawVal / step) * step;
    return Math.max(min, Math.min(max, steppedVal));
  };

  // Handle Drag Start
  const handleStart = (clientX: number) => {
    if (disabled) return;
    setIsDragging(true);
    const newVal = calculateValueFromCoords(clientX);
    onChange(newVal);
  };

  // Mouse Move & Touch Move hooks
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newVal = calculateValueFromCoords(e.clientX);
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const newVal = calculateValueFromCoords(e.touches[0].clientX);
        onChange(newVal);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, min, max, step, onChange]);

  const handleMouseMoveOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || disabled) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverX(x);
    setHoverPercent(x / rect.width);
  };

  const handleMouseLeave = () => {
    setHoverPercent(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const keyStep = step * (e.shiftKey ? 10 : 1);
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, value + keyStep));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, value - keyStep));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={(e) => {
        if (e.button === 0) { // left click only
          handleStart(e.clientX);
        }
      }}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          handleStart(e.touches[0].clientX);
        }
      }}
      onMouseMove={handleMouseMoveOver}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      className={`group relative h-7 flex items-center cursor-pointer select-none outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${className}`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      role="slider"
    >
      {/* Background Track */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden transition-all duration-200 group-hover:h-2 relative">
        {/* Fill Track */}
        <div 
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-75"
          style={{ 
            width: `${clampedPercentage}%`,
            background: barColor,
            boxShadow: isDragging ? `0 0 12px ${barColor}` : `0 0 6px ${barColor}40`
          }}
        />
      </div>

      {/* Hover preview line */}
      {hoverPercent !== null && !isDragging && (
        <div 
          className="absolute h-1.5 bg-white/20 rounded-full pointer-events-none top-[11px] group-hover:top-[10px] group-hover:h-2"
          style={{ 
            left: 0, 
            width: `${hoverPercent * 100}%`,
            zIndex: 1
          }}
        />
      )}

      {/* Slider Knob */}
      <div 
        className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none -ml-1.75 transition-all duration-150 ${
          isDragging ? 'scale-125' : 'group-hover:scale-110'
        }`}
        style={{ 
          left: `${clampedPercentage}%`,
          boxShadow: `0 0 8px rgba(0,0,0,0.5), 0 0 4px ${barColor}`
        }}
      />

      {/* Tooltip on Hover / Drag */}
      {(hoverPercent !== null || isDragging) && (
        <div 
          className="absolute bottom-full mb-2 bg-neutral-950 border border-white/10 text-white text-[9px] font-mono font-bold uppercase tracking-wider py-1 px-2 rounded pointer-events-none transition-opacity duration-150 shadow-xl z-50 flex items-center justify-center whitespace-nowrap"
          style={{ 
            left: isDragging ? `${clampedPercentage}%` : `${(hoverPercent || 0) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {formatTooltip 
            ? formatTooltip(isDragging ? value : min + (hoverPercent || 0) * range) 
            : (isDragging ? value : min + (hoverPercent || 0) * range).toFixed(1)
          }
        </div>
      )}
    </div>
  );
}
