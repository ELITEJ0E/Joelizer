import React from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { Type, Palette, Layout, ShieldCheck, Eye } from 'lucide-react';

export function TypographyPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);

  const typo = useLyricsVideoStore(s => s.typographyOverride);
  const updateTypo = useLyricsVideoStore(s => s.updateTypographyOverride);
  const showSafeArea = useLyricsVideoStore(s => s.showSafeArea);
  const setShowSafeArea = useLyricsVideoStore(s => s.setShowSafeArea);

  const aspectRatios: { id: AspectRatio; label: string }[] = [
    { id: '16:9', label: '16:9 (Landscape)' },
    { id: '9:16', label: '9:16 (Vertical)' },
    { id: '1:1', label: '1:1 (Square)' },
    { id: '3:4', label: '3:4 (Portrait)' },
    { id: '4:3', label: '4:3 (Classic)' }
  ];

  const fonts = ['Inter', 'Outfit', 'Syne', 'Plus Jakarta Sans', 'Space Grotesk', 'Playfair Display'];

  return (
    <div className="flex flex-col h-full bg-[#060608] text-slate-300 p-3 gap-3.5 overflow-y-auto">
      
      {/* Extended Aspect Ratio Picker */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layout size={12} style={{ color: activeColor }} />
          Canvas Aspect Ratio
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {aspectRatios.map(ar => (
            <button
              key={ar.id}
              onClick={() => setAspectRatio(ar.id)}
              className={`p-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                aspectRatio === ar.id
                  ? 'bg-white/15 border-white text-white shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family Picker */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Type size={12} style={{ color: activeColor }} />
          Font Family
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          {fonts.map(font => (
            <button
              key={font}
              onClick={() => updateTypo({ fontFamily: font })}
              className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                typo.fontFamily === font
                  ? 'bg-white/15 border-white text-white shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              style={{ fontFamily: font }}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      {/* Color Customization */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Palette size={12} style={{ color: activeColor }} />
          Color & Glow Palette
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Active Word Highlight Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400">Active Word</span>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-lg">
              <input
                type="color"
                value={typo.activeWordColor || '#fde047'}
                onChange={(e) => updateTypo({ activeWordColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="text-[10px] font-mono font-bold uppercase">{typo.activeWordColor}</span>
            </div>
          </div>

          {/* Active Word Glow Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400">Neon Glow</span>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-lg">
              <input
                type="color"
                value={typo.glowColor && typo.glowColor !== 'transparent' ? typo.glowColor : '#eab308'}
                onChange={(e) => updateTypo({ glowColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="text-[10px] font-mono font-bold uppercase">{typo.glowColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Container Pill & Safe Area Overlays */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Eye size={14} className="text-sky-400" />
            Background Pill Backdrop
          </span>
          <input
            type="checkbox"
            checked={typo.showContainerPill}
            onChange={(e) => updateTypo({ showContainerPill: e.target.checked })}
            className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <ShieldCheck size={14} className="text-red-400" />
            Safe Area Guide Lines
          </span>
          <input
            type="checkbox"
            checked={showSafeArea}
            onChange={(e) => setShowSafeArea(e.target.checked)}
            className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
