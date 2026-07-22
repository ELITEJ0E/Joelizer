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
    <div className="h-16 bg-[#070707]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-30 relative shadow-lg">
      <div className="flex items-center gap-6">
        {/* Branding with gradient and soft glow */}
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative w-9 h-9 rounded bg-gradient-to-br from-[#00e676] to-[#00b4d8] flex items-center justify-center shadow-[0_0_15px_rgba(0,230,118,0.3)] group-hover:shadow-[0_0_25px_rgba(0,230,118,0.5)] transition-all duration-300">
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] rounded" />
            <span className="text-black font-black italic text-base select-none">
              V
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black tracking-[1.5px] uppercase text-xs">
              Visualizer
            </span>
          </div>
        </div>
        
        <div className="hidden sm:block h-6 w-px bg-white/10" />
        
        {/* Project Name Input */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-slate-400 font-black">PROJECT:</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="NAME YOUR PROJECT..."
            className="bg-white/5 border border-white/5 hover:border-white/10 focus:border-[#00e676]/30 px-2.5 py-1 rounded text-white text-xs w-32 sm:w-44 font-bold uppercase tracking-wider outline-none transition-all focus:ring-0 placeholder-white/20"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Templates Button */}
        <button 
          onClick={() => setIsTemplatesOpen(true)}
          className="bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <Sparkles size={11} className="text-[#00e676] animate-pulse" />
          <span>Templates</span>
        </button>

        {/* Aspect Ratio Selector */}
        <div className="hidden md:flex bg-white/[0.03] border border-white/10 rounded-md p-0.5 gap-0.5">
          {ratios.map(ratio => (
            <button
              key={ratio.id}
              onClick={() => setAspectRatio(ratio.id)}
              title={`Switch aspect ratio to ${ratio.label}`}
              className={cn(
                "px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all duration-200",
                aspectRatio === ratio.id 
                  ? "bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/20 font-black" 
                  : "border border-transparent text-slate-400 hover:text-white"
              )}
            >
              {ratio.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-white/10 hidden sm:block" />

        {/* Audio Upload */}
        <label className="cursor-pointer px-3.5 py-1.5 bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] text-white rounded text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 shadow-sm">
          <Music size={11} className="text-slate-400" />
          <span>Load Audio</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
        </label>
        
        {/* Export Button with dynamic gradient and soft glow */}
        <button 
          onClick={onExport}
          className="bg-gradient-to-r from-[#00e676] to-[#00b4d8] text-black text-[10px] font-black px-4 py-1.5 rounded uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,230,118,0.25)] hover:shadow-[0_0_30px_rgba(0,230,118,0.45)] hover:brightness-110 active:scale-95"
        >
          <Download size={12} strokeWidth={3} />
          <span>Export</span>
        </button>
      </div>

      <TemplatesModal isOpen={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
