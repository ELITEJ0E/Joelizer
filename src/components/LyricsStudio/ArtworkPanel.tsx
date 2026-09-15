import React, { useRef } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { ArtworkStyle, ArtworkAnimation, LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { Disc, Circle, Square, Radio, Activity, Image as ImageIcon, Upload, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function ArtworkPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const albumArt = useStore(s => s.albumArt);
  const updateCurrentTrackCover = useStore(s => s.updateCurrentTrackCover);
  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex]);

  const artwork = useLyricsVideoStore(s => s.artworkOverride);
  const updateArtwork = useLyricsVideoStore(s => s.updateArtworkOverride);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

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
    { id: 'glowing-disc', name: 'Neon Vinyl', icon: <Radio size={14} className="text-accent" /> },
    { id: 'glowing-disc-needle', name: 'Vinyl + Needle', icon: <Radio size={14} className="text-accent" /> },
    { id: 'vinyl', name: 'Vinyl Record', icon: <Disc size={14} className="text-[#7e8999]" /> },
    { id: 'vinyl-needle', name: 'Vinyl & Arm', icon: <Disc size={14} className="text-[#7e8999]" /> },
    { id: 'cd', name: 'Compact Disc', icon: <Disc size={14} className="text-[#7e8999]" /> },
    { id: 'cd-needle', name: 'CD Player', icon: <Disc size={14} className="text-[#7e8999]" /> },
    { id: 'circle', name: 'Circular Cut', icon: <Circle size={14} className="text-[#7e8999]" /> },
    { id: 'square', name: 'Square Framing', icon: <Square size={14} className="text-[#7e8999]" /> },
    { id: 'none', name: 'Disabled', icon: <span className="text-[10px] font-mono text-[#7e8999]">OFF</span> }
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
    <div className="flex flex-col h-full bg-[#0e1115] text-[#f0f3f6] p-3.5 gap-4 overflow-y-auto">
      
      {/* Active Song Cover Upload & Selector */}
      <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-[#232933] bg-[#12161c]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
            <ImageIcon size={12} className="text-accent" />
            Song Cover Artwork
          </span>
          <span className="text-[9px] font-mono text-accent font-semibold">
            {currentTrack?.name ? currentTrack.name.slice(0, 18) : 'Track Attached'}
          </span>
        </div>

        {/* Current Cover Preview & Change Button */}
        <div className="flex items-center gap-3 bg-[#0a0c0f] p-2.5 rounded-lg border border-[#232933]">
          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#232933] relative shadow-inner bg-[#12161c]">
            {albumArt ? (
              <img src={albumArt} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#7e8999]">
                <Disc size={20} />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#1f2632] border border-[#232933] hover:border-accent/50 text-[#f0f3f6] font-mono font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Upload size={12} className="text-accent" />
              <span>Upload Custom</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <p className="text-[9px] text-[#7e8999] font-mono">
              PNG, JPG, WebP. Auto-saved to current project.
            </p>
          </div>
        </div>

        {/* Quick Sample Preset Covers */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[9px] font-mono text-[#7e8999] uppercase tracking-wider">Quick Preset Covers:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sampleCovers.map((cov, idx) => (
              <button
                key={idx}
                onClick={() => updateCurrentTrackCover(cov)}
                className={`w-9 h-9 rounded-md overflow-hidden shrink-0 border transition-all cursor-pointer relative ${
                  albumArt === cov ? 'border-accent ring-1 ring-accent scale-105' : 'border-[#232933] hover:border-[#384252]'
                }`}
              >
                <img src={cov} alt="Preset" className="w-full h-full object-cover" />
                {albumArt === cov && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-accent">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Artwork Object Style Selector */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Disc size={12} className="text-accent" />
          Artwork Object Style
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {styles.map(st => {
            const isSelected = artwork.style === st.id;

            return (
              <button
                key={st.id}
                onClick={() => {
                  updateArtwork({ style: st.id });
                  if (st.id in LYRIC_VIDEO_TEMPLATES) {
                    setSelectedTemplateId(st.id as any);
                  }
                }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#161b22] border-accent/60 text-[#f0f3f6] shadow-[0_0_10px_rgba(0,230,118,0.12)] font-semibold'
                    : 'bg-[#12161c] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#161b22] hover:border-[#2e3746]'
                }`}
              >
                {st.icon}
                <span className="truncate">{st.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animation Controls */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Activity size={12} className="text-accent" />
          Object Motion & Beat Sync
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          {animations.map(anim => {
            const isSelected = artwork.animation === anim.id;

            return (
              <button
                key={anim.id}
                onClick={() => updateArtwork({ animation: anim.id })}
                className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-[#161b22] border-accent/60 text-[#f0f3f6] shadow-[0_0_10px_rgba(0,230,118,0.12)] font-semibold'
                    : 'bg-[#12161c] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#161b22] hover:border-[#2e3746]'
                }`}
              >
                {anim.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas Drag-to-Resize Indicator & Reset */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#7e8999]">Canvas Size</span>
          <span className="text-accent font-bold tabular-nums">{Math.round(artwork.sizeScale * 100)}%</span>
        </div>
        <div className="p-2.5 rounded-lg bg-[#12161c] border border-[#232933] text-[10px] text-[#7e8999] flex flex-col gap-1.5">
          <p className="leading-relaxed">
            <strong className="text-[#f0f3f6]">Canva / PPT Style Resizing:</strong> Select the vinyl or artwork directly on the stage to drag corner handles and resize interactively.
          </p>
          {artwork.sizeScale !== 1.0 && (
            <button
              type="button"
              onClick={() => updateArtwork({ sizeScale: 1.0 })}
              className="self-start text-[9px] font-mono text-accent hover:underline cursor-pointer"
            >
              Reset to 100%
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
