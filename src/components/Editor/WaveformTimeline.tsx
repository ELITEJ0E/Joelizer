import React, { useRef, useEffect } from 'react';

interface WaveformTimelineProps {
  peaks: number[];
  startPct: number; // 0 to 100
  endPct: number; // 0 to 100
  activeColor: string;
  className?: string;
}

export function WaveformTimeline({
  peaks,
  startPct,
  endPct,
  activeColor,
  className = '',
}: WaveformTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Prepare peak dataset
    let dataToDraw = peaks;
    if (!dataToDraw || dataToDraw.length === 0) {
      // Fallback elegant peaks if buffer is still processing or unavailable
      const fallbackCount = Math.max(80, Math.floor(width / 3.5));
      dataToDraw = Array.from({ length: fallbackCount }, (_, i) => {
        const t = i / fallbackCount;
        const wave1 = Math.sin(t * Math.PI * 5) * 0.3;
        const wave2 = Math.cos(t * Math.PI * 11) * 0.2;
        const noise = Math.sin(i * 0.4) * 0.15;
        return Math.max(0.1, Math.min(1, 0.25 + wave1 + wave2 + noise));
      });
    }

    const numBars = dataToDraw.length;
    const barSpacing = width / numBars;
    const barWidth = Math.max(1.5, Math.min(4, barSpacing * 0.7));
    const centerY = height / 2;
    const maxBarHeight = height * 0.82;

    for (let i = 0; i < numBars; i++) {
      const x = i * barSpacing + barSpacing / 2;
      const pct = (i / numBars) * 100;
      const peak = dataToDraw[i];
      const barH = Math.max(3, peak * maxBarHeight);

      const isSelected = pct >= startPct && pct <= endPct;

      if (isSelected) {
        ctx.fillStyle = activeColor;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      }

      const topY = centerY - barH / 2;
      const radius = Math.min(barWidth / 2, 2);

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x - barWidth / 2, topY, barWidth, barH, radius);
      } else {
        ctx.rect(x - barWidth / 2, topY, barWidth, barH);
      }
      ctx.fill();
    }
  }, [peaks, startPct, endPct, activeColor]);

  // Handle window / panel resizing smoothly
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block pointer-events-none ${className}`}
    />
  );
}
