import React, { useState } from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { Download, Sparkles, Music } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TemplatesModal } from './TemplatesModal';

export function TopBar({ onExport }: { onExport: () => void }) {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const setAudio = useStore(s => s.setAudio);
  
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isExportHovered, setIsExportHovered] = useState(false);

  const ratios: { id: AspectRatio; icon: string; label: string }[] = [
    { id: '16:9', icon: '▭', label: '16:9' },
    { id: '9:16', icon: '▯', label: '9:16' },
    { id: '1:1', icon: '□', label: '1:1' },
    { id: '4:5', icon: '◧', label: '4:5' },
  ];

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudio(file, url, audio.duration, null);
      };
    }
  };

  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-3 sm:px-6 z-30 relative shadow-xl">
      <div className="absolute top-0 inset-x-0 h-[1px] bg-white/10 pointer-events-none" />
      <div className="flex items-center gap-2 sm:gap-6">
        {/* Branding with gradient and soft glow */}
        <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer transition-glass">
          <div 
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded flex items-center justify-center transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
              boxShadow: `0 0 15px ${activeColor}40`
            }}
          >
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] rounded" />
            <span className="text-black font-black italic text-sm sm:text-base select-none z-10">
              J
            </span>
          </div>
          <div className="flex flex-col hidden sm:block">
            <span className="text-white font-black tracking-[1.5px] uppercase text-xs font-display">
              Joelizer
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Templates Button */}
        <button 
          onClick={() => setIsTemplatesOpen(true)}
          title="Templates"
          className="group bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] text-white text-[10px] font-bold uppercase tracking-widest px-2 sm:px-3 py-1.5 rounded transition-glass flex items-center gap-1 sm:gap-1.5 shadow-sm active:scale-95 animate-in fade-in"
        >
          <Sparkles size={12} style={{ color: activeColor }} className="opacity-80 group-hover:opacity-100 group-hover:animate-pulse transition-opacity" />
          <span className="hidden sm:inline">Templates</span>
        </button>

        {/* Aspect Ratio Selector (Desktop) */}
        <div className="hidden md:flex bg-white/[0.02] border border-white/5 rounded-md p-0.5 gap-0.5">
          {ratios.map(ratio => (
            <button
              key={ratio.id}
              onClick={() => setAspectRatio(ratio.id)}
              title={`Switch aspect ratio to ${ratio.label}`}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-glass",
                aspectRatio === ratio.id 
                  ? "bg-white/[0.08] text-white font-black" 
                  : "border border-transparent text-slate-400 hover:text-white hover:bg-white/[0.04]"
              )}
              style={aspectRatio === ratio.id ? { color: activeColor, textShadow: `0 0 10px ${activeColor}40` } : {}}
            >
              {ratio.label}
            </button>
          ))}
        </div>

        {/* Aspect Ratio Selector (Mobile) */}
        <div className="flex md:hidden bg-white/[0.02] border border-white/5 rounded px-2 py-1 items-center">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            className="bg-transparent text-white text-[10px] font-bold uppercase outline-none cursor-pointer"
            title="Aspect Ratio"
          >
            {ratios.map(ratio => (
              <option key={ratio.id} value={ratio.id} className="bg-[#0a0a0a] text-white py-1">
                {ratio.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-white/10 hidden sm:block mx-1" />

        {/* Audio Upload */}
        <label className="cursor-pointer px-2 sm:px-3 py-1.5 bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] text-white rounded text-[10px] font-bold uppercase tracking-widest transition-glass active:scale-95 flex items-center gap-1.5 shadow-sm" title="Load Audio">
          <Music size={12} style={{ color: activeColor }} className="opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="hidden min-[450px]:inline">Load Audio</span>
          <span className="inline min-[450px]:hidden">Audio</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
        </label>
        
        {/* Export Button with dynamic gradient and soft glow */}
        <button 
          onClick={onExport}
          onMouseEnter={() => setIsExportHovered(true)}
          onMouseLeave={() => setIsExportHovered(false)}
          className="text-black text-[10px] font-black px-2.5 sm:px-4 py-1.5 rounded uppercase tracking-widest transition-glass flex items-center gap-1 sm:gap-1.5 active:scale-95 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
            boxShadow: isExportHovered ? `0 0 25px ${activeColor}80` : `0 0 15px ${activeColor}40`,
            filter: isExportHovered ? 'brightness(1.1)' : 'brightness(1)'
          }}
        >
          {isExportHovered && (
             <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] -translate-x-full" />
          )}
          <Download size={13} strokeWidth={3} className="relative z-10" />
          <span className="relative z-10 hidden min-[380px]:inline">Export</span>
        </button>
      </div>

      <TemplatesModal isOpen={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
