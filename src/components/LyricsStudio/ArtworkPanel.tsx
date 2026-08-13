import React from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { ArtworkStyle, ArtworkAnimation } from '../../lib/lyricsTemplates';
import { Disc, Circle, Square, Radio, Sparkles, Activity } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function ArtworkPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const artwork = useLyricsVideoStore(s => s.artworkOverride);
  const updateArtwork = useLyricsVideoStore(s => s.updateArtworkOverride);

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
      
      {/* Artwork Object Style Selector */}
      <div className="flex flex-col gap-2">
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
