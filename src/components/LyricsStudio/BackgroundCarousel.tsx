import React, { useRef } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { Upload, Film, Image as ImageIcon, Sparkles, Check, Repeat } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function BackgroundCarousel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex]);
  const globalAlbumArt = useStore(s => s.albumArt);
  const albumArtUrl = currentTrack?.albumArt || globalAlbumArt;
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
    <div className="flex flex-col h-full bg-[#0e1115] text-[#f0f3f6] p-3.5 gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[#4a5568] scrollbar-track-transparent">
      
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

                {/* Actual background visual elements matching the canvas */}
                {/* 1. Blurred Album Art for 'cover' & 'glass' */}
                {(preset.id === 'cover' || preset.id === 'glass') && albumArtUrl && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <img
                      src={albumArtUrl}
                      alt=""
                      className="w-full h-full object-cover scale-150 filter blur-[8px] brightness-75 opacity-80"
                    />
                    {preset.id === 'glass' && (
                      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]">
                        <div className="w-full h-full opacity-20 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.4)_50%)] bg-[length:100%_4px]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                )}

                {/* 2. Frosted Glass without album art fallback */}
                {preset.id === 'glass' && !albumArtUrl && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-white/15 backdrop-blur-[1px]">
                      <div className="w-full h-full opacity-25 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.4)_50%)] bg-[length:100%_4px]" />
                    </div>
                  </div>
                )}

                {/* 3. Waveform preview for 'waveform' and 'cyberpunk' */}
                {(preset.id === 'waveform' || preset.id === 'cyberpunk') && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
                    <svg viewBox="0 0 120 40" className="w-full h-10 px-1">
                      <path
                        d="M 0 20 Q 15 8 30 20 T 60 20 T 90 20 T 120 20"
                        fill="none"
                        stroke={preset.id === 'cyberpunk' ? '#ef4444' : '#00e5ff'}
                        strokeWidth="2"
                        className="drop-shadow-[0_0_4px_currentColor]"
                      />
                      {preset.id === 'cyberpunk' && (
                        <path
                          d="M 0 20 Q 20 26 40 20 T 80 20 T 120 20"
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="1.2"
                          strokeOpacity="0.6"
                        />
                      )}
                    </svg>
                  </div>
                )}

                {/* 4. Particle dots for 'cyber', 'matrix', 'starfield' */}
                {preset.id === 'cyber' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-2 left-6 w-1.5 h-1.5 rounded-full bg-[#00e5ff] shadow-[0_0_6px_#00e5ff]" />
                    <div className="absolute bottom-3 right-8 w-2 h-2 rounded-full bg-[#ec4899] shadow-[0_0_8px_#ec4899]" />
                    <div className="absolute top-7 right-5 w-1 h-1 rounded-full bg-[#00e5ff] shadow-[0_0_4px_#00e5ff]" />
                    <div className="absolute bottom-2 left-10 w-1.5 h-1.5 rounded-full bg-[#ec4899] shadow-[0_0_6px_#ec4899]" />
                  </div>
                )}

                {preset.id === 'matrix' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-3 left-4 w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
                    <div className="absolute bottom-3 right-5 w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
                    <div className="absolute top-6 left-12 w-1 h-1 rounded-full bg-[#4ade80] shadow-[0_0_5px_#4ade80]" />
                    <div className="absolute top-4 right-10 w-1 h-1 rounded-full bg-[#22c55e] shadow-[0_0_5px_#22c55e]" />
                  </div>
                )}

                {preset.id === 'starfield' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-2 left-8 w-1.5 h-1.5 rounded-full bg-[#c084fc] shadow-[0_0_6px_#c084fc]" />
                    <div className="absolute bottom-4 right-6 w-1.5 h-1.5 rounded-full bg-[#ffffff] shadow-[0_0_6px_#ffffff]" />
                    <div className="absolute top-6 right-12 w-1 h-1 rounded-full bg-[#e9d5ff] shadow-[0_0_4px_#e9d5ff]" />
                    <div className="absolute bottom-2 left-6 w-1 h-1 rounded-full bg-[#ffffff] opacity-80" />
                  </div>
                )}

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
