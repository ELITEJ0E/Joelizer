import React, { useRef } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { Upload, Film, Image as ImageIcon, Sparkles, Check, Repeat } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function BackgroundCarousel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const selectedPresetId = useLyricsVideoStore(s => s.selectedBackgroundPresetId);
  const customBackground = useLyricsVideoStore(s => s.customBackground);
  const setSelectedBackgroundPresetId = useLyricsVideoStore(s => s.setSelectedBackgroundPresetId);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBackground({
        type: 'image',
        value: url
      });
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBackground({
        type: 'video',
        videoUrl: url,
        value: '#000000'
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#060608] text-slate-300 p-3 gap-3 overflow-y-auto">
      
      {/* Upload Custom Background Section */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Upload size={12} style={{ color: activeColor }} />
          Custom Media Background
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Custom Image Upload */}
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <ImageIcon size={14} className="text-sky-400" />
            <span>Upload Image</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Custom Video Upload */}
          <button
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <Film size={14} className="text-purple-400" />
            <span>Upload Video</span>
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />
        </div>

        {customBackground.type === 'video' && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 font-medium">
            <span className="flex items-center gap-1.5">
              <Repeat size={12} className="text-purple-400" />
              Looping Video Enabled
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Auto-Seamless</span>
          </div>
        )}
      </div>

      {/* Preset Backgrounds Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: activeColor }} />
          Preset Styles & Themes
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BACKGROUND_PRESETS.map(preset => {
            const isSelected = selectedPresetId === preset.id && customBackground.type === preset.type;

            return (
              <div
                key={preset.id}
                onClick={() => {
                  setSelectedBackgroundPresetId(preset.id);
                  if (preset.id === 'cover') {
                    setCustomBackground({ type: 'blurred-artwork', value: '' });
                  } else {
                    setCustomBackground({ type: preset.type as any, value: preset.value });
                  }
                }}
                className={`relative rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between h-20 overflow-hidden ${
                  isSelected
                    ? 'border-white shadow-xl ring-2 ring-white/30 scale-[1.02]'
                    : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                }`}
                style={{ background: preset.previewGradient }}
              >
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-extrabold text-white uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm shadow">
                    {preset.name}
                  </span>

                  {isSelected && (
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-black font-extrabold shadow-md"
                      style={{ backgroundColor: activeColor }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded w-fit backdrop-blur-sm z-10">
                  {preset.category}
                </span>

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-black/20 pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
