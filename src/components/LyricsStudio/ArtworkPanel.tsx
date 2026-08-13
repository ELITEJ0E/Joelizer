import React, { useRef } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { ArtworkStyle, ArtworkAnimation } from '../../lib/lyricsTemplates';
import { Disc, Circle, Square, Radio, Sparkles, Activity, Image as ImageIcon, Upload, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function ArtworkPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const albumArt = useStore(s => s.albumArt);
  const updateCurrentTrackCover = useStore(s => s.updateCurrentTrackCover);
  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex]);

  const artwork = useLyricsVideoStore(s => s.artworkOverride);
  const updateArtwork = useLyricsVideoStore(s => s.updateArtworkOverride);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleCovers = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        updateCurrentTrackCover(evt.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const styles: { id: ArtworkStyle; name: string; icon: React.ReactNode }[] = [
    { id: 'vinyl', name: 'Vinyl Record', icon: <Disc size={16} /> },
    { id: 'cd', name: 'Holo CD', icon: <Disc size={16} className="text-purple-400" /> },
    { id: 'glowing-disc', name: 'Glow Disc', icon: <Radio size={16} className="text-sky-400" /> },
    { id: 'circle', name: 'Circle', icon: <Circle size={16} /> },
    { id: 'square', name: 'Square', icon: <Square size={16} /> },
    { id: 'framed', name: 'Framed Card', icon: <Square size={16} className="rounded-sm" /> },
    { id: 'none', name: 'Hidden', icon: <span className="text-xs">Off</span> }
  ];

  const animations: { id: ArtworkAnimation; name: string }[] = [
    { id: 'rotate', name: 'Vinyl Rotate' },
    { id: 'scale-beat', name: 'Beat Pulse' },
    { id: 'pulse', name: 'Glow Pulse' },
    { id: 'float', name: 'Floating' },
    { id: 'bounce', name: 'Bouncing' },
    { id: 'none', name: 'Static' }
  ];

  return (
    <div className="flex flex-col h-full bg-[#060608] text-slate-300 p-3 gap-3 overflow-y-auto">
      
      {/* Active Song Cover Upload & Selector */}
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ImageIcon size={13} style={{ color: activeColor }} />
            Song Cover Image
          </span>
          <span className="text-[9px] font-mono text-emerald-400 font-bold">
            {currentTrack?.name ? `Saved for "${currentTrack.name.slice(0, 16)}"` : 'Persistent'}
          </span>
        </div>

        {/* Current Cover Preview & Change Button */}
        <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-white/10">
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-white/20 relative shadow-md">
            {albumArt ? (
              <img src={albumArt} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
                <Disc size={20} />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              style={{ backgroundColor: activeColor }}
            >
              <Upload size={13} />
              <span>Upload Cover</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <p className="text-[9px] text-slate-400 font-mono">
              Supports PNG, JPG, WebP. Automatically saves to active song!
            </p>
          </div>
        </div>

        {/* Quick Sample Preset Covers */}
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase">Quick Presets:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sampleCovers.map((cov, idx) => (
              <button
                key={idx}
                onClick={() => updateCurrentTrackCover(cov)}
                className={`w-9 h-9 rounded-md overflow-hidden shrink-0 border transition-all cursor-pointer relative ${
                  albumArt === cov ? 'border-white ring-2 ring-emerald-400 scale-105' : 'border-white/10 hover:border-white/40'
                }`}
              >
                <img src={cov} alt="Preset" className="w-full h-full object-cover" />
                {albumArt === cov && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-emerald-400">
                    <Check size={12} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Artwork Object Style Selector */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Disc size={12} style={{ color: activeColor }} />
          Artwork Object Style
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {styles.map(st => {
            const isSelected = artwork.style === st.id;

            return (
              <button
                key={st.id}
                onClick={() => updateArtwork({ style: st.id })}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/15 border-white text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                style={isSelected ? { borderLeft: `3px solid ${activeColor}` } : {}}
              >
                {st.icon}
                <span>{st.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animation Controls */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Activity size={12} style={{ color: activeColor }} />
          Object Motion & Beat Sync
        </span>

        <div className="grid grid-cols-2 gap-2">
          {animations.map(anim => {
            const isSelected = artwork.animation === anim.id;

            return (
              <button
                key={anim.id}
                onClick={() => updateArtwork({ animation: anim.id })}
                className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/15 border-white text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {anim.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scale Slider */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-400">Object Scale</span>
          <span className="text-white">{Math.round(artwork.sizeScale * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={artwork.sizeScale}
          onChange={(e) => updateArtwork({ sizeScale: parseFloat(e.target.value) })}
          className="w-full accent-emerald-400 bg-white/10 rounded h-1.5 cursor-pointer"
        />
      </div>
    </div>
  );
}
