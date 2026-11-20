import React from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';

/** Shared typography control for Lyrics Video and MV Studio. */
export function LyricSizeControl() {
  const scale = useLyricsVideoStore(s => s.typographyOverride.fontSizeScale ?? 1);
  const updateTypography = useLyricsVideoStore(s => s.updateTypographyOverride);
  const position = useLyricsVideoStore(s => s.elementPositions.lyrics);
  const setPosition = useLyricsVideoStore(s => s.setElementPosition);
  const setScale = (value: number) => {
    if (!Number.isFinite(value)) return;
    updateTypography({ fontSizeScale: Math.round(Math.max(0.4, Math.min(3.5, value)) * 100) / 100 });
  };
  const move = (axis: 'x' | 'y', value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.round(Math.max(4, Math.min(96, value))) / 100;
    setPosition('lyrics', { ...position, [axis]: next });
    updateTypography({ position: undefined });
  };

  return (
    <div className="space-y-2 rounded border border-[#303846] bg-[#10151c] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="joelizer-lyric-size" className="text-[11px] font-bold text-[#c6d1df]">
          Lyrics Size
        </label>
        <div className="flex items-center gap-1">
          <input aria-label="Lyrics font size multiplier" type="number" min="0.4" max="3.5" step="0.1"
            value={scale} onChange={e => setScale(Number(e.target.value))}
            className="w-[62px] rounded border border-[#3d4858] bg-[#090c12] p-1 text-right font-mono text-xs text-accent" />
          <span className="text-[10px] text-[#8491a3]">×</span>
        </div>
      </div>
      <input id="joelizer-lyric-size" type="range" min="0.4" max="3.5" step="0.05"
        value={scale} onChange={e => setScale(Number(e.target.value))}
        className="w-full accent-[#00e676]" />
      <p className="text-[10px] text-[#8191a3]">Drag lyric corners on the canvas to resize, or set an exact multiplier here.</p>
      <div className="grid grid-cols-2 gap-2 border-t border-[#28313f] pt-2">
        {(['x', 'y'] as const).map(axis => (
          <div key={axis} className="space-y-1">
            <label className="flex justify-between text-[10px] font-mono text-[#aeb8c5]">
              {axis === 'x' ? 'Horizontal' : 'Vertical'} <span>{Math.round((position?.[axis] ?? 0.5) * 100)}%</span>
            </label>
            <input type="range" aria-label={`Lyric ${axis === 'x' ? 'horizontal' : 'vertical'} position`}
              min="4" max="96" step="1" value={Math.round((position?.[axis] ?? 0.5) * 100)}
              onChange={e => move(axis, Number(e.target.value))} className="w-full accent-[#00e676]" />
          </div>
        ))}
      </div>
    </div>
  );
}
