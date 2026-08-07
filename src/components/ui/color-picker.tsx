import React, { useState, useEffect } from 'react';
import { 
  ColorArea, 
  ColorSlider, 
  ColorSwatch, 
  ColorThumb,
  Label, 
  parseColor,
  SliderTrack,
  SliderOutput
} from 'react-aria-components';
import { ColorPicker } from './heroui-color-picker';
import { cn } from '../../lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  boxShadow?: string;
}

export function AppColorPicker({
  value,
  onChange,
  className,
  boxShadow
}: ColorPickerProps) {
  const [colorVal, setColorVal] = useState(() => {
    try {
      return parseColor(value || '#00e676');
    } catch (e) {
      return parseColor('#00e676');
    }
  });

  useEffect(() => {
    try {
      if (value) {
        setColorVal(parseColor(value));
      }
    } catch (e) {
      // ignore
    }
  }, [value]);

  const handleLocalChange = (c: any) => {
    if (!c) return;
    setColorVal(c);
  };

  const handleCommitChange = (c: any) => {
    if (!c) return;
    try {
      const hex = typeof c.toString === 'function' ? c.toString('hex') : String(c);
      const formatted = hex.startsWith('#') ? hex : `#${hex}`;
      onChange(formatted);
    } catch (err) {
      // ignore
    }
  };

  return (
    <div className={cn("flex gap-2 items-center", className)}>
      <ColorPicker value={colorVal} onChange={handleLocalChange} onChangeEnd={handleCommitChange}>
        <ColorPicker.Trigger className="p-0 h-auto w-auto bg-transparent border-0 hover:bg-transparent focus:ring-0">
          <div 
            className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 flex items-center justify-center cursor-pointer shadow-md hover:border-white/40 transition-all hover:scale-105 group shrink-0"
            style={{ 
              backgroundColor: value || '#00e676', 
              boxShadow: boxShadow || `0 0 15px ${(value || '#00e676')}40` 
            }}
          >
            <ColorSwatch className="w-full h-full border-0 bg-transparent" />
          </div>
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="p-3 bg-[#0c0c0e]/95 border border-white/15 rounded-xl backdrop-blur-2xl shadow-2xl space-y-3 z-[200] text-white">
          <ColorArea
            aria-label="Color area"
            className="w-56 h-40 rounded-lg overflow-hidden border border-white/10 relative cursor-crosshair"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorThumb className="w-4 h-4 rounded-full border-2 border-white shadow-lg bg-transparent -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing" />
          </ColorArea>
          
          <ColorSlider channel="hue" className="flex flex-col gap-1 w-full" colorSpace="hsb">
            <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <Label>Hue</Label>
              <SliderOutput className="text-white font-bold" />
            </div>
            <SliderTrack className="h-3 rounded-full border border-white/10 relative w-full cursor-pointer">
              <ColorThumb className="w-4 h-4 rounded-full border-2 border-white shadow-lg bg-transparent -translate-x-1/2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing" />
            </SliderTrack>
          </ColorSlider>
        </ColorPicker.Popover>
      </ColorPicker>

      <input 
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val);
        }}
        className="flex-1 bg-white/[0.03] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-white/30 transition-all uppercase tracking-wider font-bold"
      />
    </div>
  );
}
