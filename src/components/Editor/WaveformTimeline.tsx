import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

interface WaveformTimelineProps {
  duration: number;
  start: number;
  end: number;
  activeColor: string;
}

export function WaveformTimeline({ duration, start, end, activeColor }: WaveformTimelineProps) {
  const peaks = useStore(s => s.waveformPeaks);

  const normalizedPeaks = useMemo(() => {
    if (!peaks || peaks.length === 0) return [];
    
    // Smooth the peaks a bit for visual timeline rendering
    const smoothed = [];
    const windowSize = 2; // Average over 5 bins
    
    for (let i = 0; i < peaks.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(peaks.length - 1, i + windowSize); j++) {
        sum += peaks[j];
        count++;
      }
      smoothed.push(sum / count);
    }
    
    const max = Math.max(...smoothed, 0.01);
    return smoothed.map(p => p / max);
  }, [peaks]);

  if (!normalizedPeaks.length || duration <= 0) {
    return <div className="absolute inset-0 z-0 bg-white/5 rounded pointer-events-none" />;
  }

  const startPct = (start / duration) * 100;
  const endPct = (end / duration) * 100;

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-between gap-[1px] px-[2px] pointer-events-none">
      {normalizedPeaks.map((peak, i) => {
        const xPct = (i / (normalizedPeaks.length - 1)) * 100;
        const inRange = xPct >= startPct && xPct <= endPct;
        const heightPct = Math.max(10, peak * 100);
        
        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-300 pointer-events-none"
            style={{
              height: `${heightPct}%`,
              backgroundColor: inRange ? activeColor : 'rgba(255, 255, 255, 0.15)',
              opacity: inRange ? 0.8 : 0.4
            }}
          />
        );
      })}
    </div>
  );
}
