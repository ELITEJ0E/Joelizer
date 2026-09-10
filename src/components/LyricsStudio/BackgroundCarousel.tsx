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
    <div className="flex flex-col h-full bg-[#0e1115] text-[#f0f3f6] p-3.5 gap-4 overflow-y-auto">
      
      {/* Upload Custom Background Section */}
      <div className="bg-[#12161c] border border-[#232933] rounded-xl p-3 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Upload size={12} className="text-accent" />
          Custom Media Background
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Custom Image Upload */}
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[#232933] bg-[#0a0c0f] hover:bg-[#161b22] hover:border-accent/40 text-xs font-mono text-[#f0f3f6] transition-all cursor-pointer"
          >
            <ImageIcon size={14} className="text-accent" />
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
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[#232933] bg-[#0a0c0f] hover:bg-[#161b22] hover:border-accent/40 text-xs font-mono text-[#f0f3f6] transition-all cursor-pointer"
          >
            <Film size={14} className="text-accent" />
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
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#161b22] border border-[#232933] text-[11px] text-accent font-mono">
            <span className="flex items-center gap-1.5">
              <Repeat size={12} />
              Looping Video Active
            </span>
            <span className="text-[9px] uppercase font-semibold text-[#7e8999]">Auto-Seamless</span>
          </div>
        )}
      </div>

      {/* Preset Backgrounds Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Sparkles size={12} className="text-accent" />
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
                    ? 'border-accent shadow-[0_0_12px_rgba(0,230,118,0.2)] ring-1 ring-accent'
                    : 'border-[#232933] hover:border-[#384252]'
                }`}
                style={{ background: preset.previewGradient }}
              >
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider bg-black/75 px-1.5 py-0.5 rounded border border-[#232933] shadow">
                    {preset.name}
                  </span>

                  {isSelected && (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-accent text-black font-extrabold shadow-md">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <span className="text-[9px] font-mono font-medium text-white/80 uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded border border-white/10 w-fit z-10">
                  {preset.category}
                </span>

                {/* Subtle dark vignette */}
                <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
