import React from 'react';
import type { MediaFrameSettings } from '../../lib/lyricsBackgrounds';

type FramingField = 'zoom' | 'heightScale' | 'offsetX' | 'offsetY';

interface VideoFramingControlsProps {
  value: MediaFrameSettings;
  onChange: (change: Partial<MediaFrameSettings>) => void;
  disabled?: boolean;
  label?: string;
}

const sliders: {
  key: FramingField;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  description: string;
}[] = [
  { key: 'offsetX', label: 'Horizontal position', min: -3, max: 3, step: 0.01, initial: 0, description: 'Move image or video left or right' },
  { key: 'offsetY', label: 'Vertical position', min: -3, max: 3, step: 0.01, initial: 0, description: 'Move image or video up or down' },
  { key: 'zoom', label: 'Zoom', min: 0.25, max: 4, step: 0.05, initial: 1, description: 'Enlarge or reduce background' },
  { key: 'heightScale', label: 'Video height', min: 0.25, max: 3, step: 0.05, initial: 1, description: 'Adjust image or video height independently of width' },
];

/**
 * Shared framing UI for Lyrics Video backgrounds and MV timeline clips.
 * Values are normalized and serialized identically by both export paths.
 */
export function VideoFramingControls({ value, onChange, disabled = false, label }: VideoFramingControlsProps) {
  return (
    <section aria-label="Background framing controls" className="space-y-3 rounded-lg border border-[#303846] bg-[#111820] p-3 text-[#e6e9ed]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold uppercase tracking-wider">Video framing</h3>
          {label && <p className="mt-0.5 truncate text-[10px] text-[#91a0b2]" title={label}>{label}</p>}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ fit: 'cover', offsetX: 0, offsetY: 0, zoom: 1, heightScale: 1 })}
          className="shrink-0 rounded border border-[#344557] px-2 py-1 text-[10px] font-semibold text-accent hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Framing mode">
        {(['cover', 'contain'] as const).map(fit => (
          <button
            type="button"
            key={fit}
            disabled={disabled}
            onClick={() => onChange({ fit })}
            aria-pressed={(value.fit ?? 'cover') === fit}
            className={`rounded border px-2 py-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${(value.fit ?? 'cover') === fit ? 'border-accent bg-[#1b2927] text-accent' : 'border-[#364150] text-[#a8b1c0] hover:border-[#66788b]'}`}
          >
            {fit === 'cover' ? 'Fill / Crop' : 'Fit entire image / video'}
          </button>
        ))}
      </div>
      {sliders.map(slider => {
        const amount = value[slider.key] ?? slider.initial;
        const display = slider.key === 'offsetX' || slider.key === 'offsetY'
          ? `${Math.round(amount * 50)}%`
          : `${Math.round(amount * 100)}%`;
        return (
          <label key={slider.key} className="block space-y-1.5">
            <span className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-[#c7d0dd]">{slider.label}</span>
              <span className="font-mono font-semibold tabular-nums text-accent">{display}</span>
            </span>
            <input
              aria-label={slider.label}
              title={slider.description}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={Math.max(slider.min, Math.min(slider.max, amount))}
              disabled={disabled}
              onChange={event => onChange({ [slider.key]: Number(event.target.value) })}
              className="block w-full cursor-pointer accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        );
      })}
      <p className="text-[10px] leading-relaxed text-[#91a0b2]">
        Position, crop and scale the background independently of the output aspect ratio. Changes appear in the preview and the export.
      </p>
    </section>
  );
}
