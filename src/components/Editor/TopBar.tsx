import React, { useState } from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { Download, Sparkles, Music } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TemplatesModal } from './TemplatesModal';
import { AudioSourceModal } from '../Audio/AudioSourceModal';

export function TopBar({ onExport }: { onExport: () => void }) {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isExportHovered, setIsExportHovered] = useState(false);

  const ratios: { id: AspectRatio; icon: string; label: string }[] = [
    { id: '16:9', icon: '▭', label: '16:9' },
    { id: '9:16', icon: '▯', label: '9:16' },
    { id: '1:1', icon: '□', label: '1:1' },
    { id: '4:5', icon: '◧', label: '4:5' },
  ];

  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="h-14 sm:h-16 bg-black/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-2 sm:px-6 z-30 relative shadow-xl w-full max-w-full overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[1px] bg-white/10 pointer-events-none" />
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        {/* Branding with gradient, equalizer motif, and soft glow */}
        <div 
          onClick={() => setActiveTab('lyrics')}
          className="flex items-center gap-1.5 sm:gap-3 group cursor-pointer transition-all duration-300 active:scale-95 shrink-0"
        >
          {/* Emblem Icon */}
          <div 
            className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-black/80 border flex items-center justify-center transition-all duration-300 overflow-hidden shadow-lg group-hover:scale-105 shrink-0"
            style={{
              borderColor: `${activeColor}60`,
              boxShadow: `0 0 15px ${activeColor}30, inset 0 0 10px ${activeColor}20`
            }}
          >
            {/* Ambient background glow */}
            <div 
              className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity blur-sm"
              style={{ background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)` }}
            />
            
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

            {/* Equalizer Soundwave Bars SVG + J Logo */}
            <div className="relative z-10 flex items-center justify-center gap-0.5">
              <span className="font-black italic text-sm sm:text-lg select-none tracking-tighter" style={{ color: activeColor, textShadow: `0 0 8px ${activeColor}` }}>
                J
              </span>
              <div className="flex items-end gap-0.5 h-3.5 sm:h-4 ml-0.5 opacity-90 group-hover:opacity-100">
                <span className="w-[1.5px] sm:w-[2px] h-2 bg-white rounded-full animate-[pulse_1s_infinite_100ms]" style={{ backgroundColor: activeColor }} />
                <span className="w-[1.5px] sm:w-[2px] h-3 sm:h-3.5 bg-white rounded-full animate-[pulse_1s_infinite_300ms]" style={{ backgroundColor: activeColor }} />
                <span className="w-[1.5px] sm:w-[2px] h-2 bg-white rounded-full animate-[pulse_1s_infinite_200ms]" style={{ backgroundColor: activeColor }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col hidden min-[520px]:flex">
              <span className="font-black tracking-[2px] uppercase text-xs sm:text-base font-display select-none leading-none">
                <span className="text-white">JOEL</span>
                <span style={{ color: activeColor, textShadow: `0 0 12px ${activeColor}90` }}>IZER</span>
              </span>
              <span className="text-[8px] font-mono tracking-[2px] uppercase text-slate-400 font-bold mt-0.5">
                AI MUSIC STUDIO
              </span>
            </div>
            
            {/* Live Studio Capsule Badge */}
            <div 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-widest bg-black/60 shadow-sm transition-all hidden xl:flex"
              style={{
                borderColor: `${activeColor}40`,
                color: activeColor,
                boxShadow: `0 0 12px ${activeColor}20`
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
              <span>STUDIO V1.3</span>
            </div>
          </div>
        </div>

        {/* Top Navigation Links */}
        <nav className="flex items-center bg-white/[0.03] border border-white/10 rounded-lg p-0.5 sm:p-1 gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('lyrics')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
              activeTab === 'lyrics' 
                ? "bg-white/15 text-white shadow-sm font-black" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'lyrics' ? { color: activeColor } : {}}
          >
            Lyrics
          </button>
          
          <button
            onClick={() => setActiveTab('studio')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer relative overflow-hidden",
              activeTab === 'studio' 
                ? "bg-white/15 text-white shadow-md" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'studio' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
          >
            <span>Studio</span>
          </button>
        </nav>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 ml-1">
        {/* Templates Button */}
        <button 
          onClick={() => setIsTemplatesOpen(true)}
          title="Templates"
          className="group bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 sm:px-3 py-1 sm:py-1.5 rounded transition-glass flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
        >
          <Sparkles size={11} style={{ color: activeColor }} className="opacity-80 group-hover:opacity-100 group-hover:animate-pulse transition-opacity" />
          <span className="hidden sm:inline">Templates</span>
        </button>

        {/* Aspect Ratio Selector (Desktop) */}
        <div className="hidden md:flex bg-white/[0.02] border border-white/5 rounded-md p-0.5 gap-0.5 shrink-0">
          {ratios.map(ratio => (
            <button
              key={ratio.id}
              onClick={() => setAspectRatio(ratio.id)}
              title={`Switch aspect ratio to ${ratio.label}`}
              className={cn(
                "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold uppercase transition-glass",
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
        <div className="flex md:hidden bg-white/[0.02] border border-white/5 rounded px-1.5 py-1 items-center shrink-0">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            className="bg-transparent text-white text-[9px] font-bold uppercase outline-none cursor-pointer"
            title="Aspect Ratio"
          >
            {ratios.map(ratio => (
              <option key={ratio.id} value={ratio.id} className="bg-[#0a0a0a] text-white py-1">
                {ratio.label}
              </option>
            ))}
          </select>
        </div>

        {/* Audio Load Button */}
        <button
          onClick={() => setIsAudioModalOpen(true)}
          className="cursor-pointer px-1.5 sm:px-3 py-1 sm:py-1.5 bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] text-white rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-glass active:scale-95 flex items-center gap-1 shadow-sm shrink-0"
          title="Load Audio File or Track URL"
        >
          <Music size={11} style={{ color: activeColor }} className="opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="hidden min-[480px]:inline">Audio</span>
        </button>
        
        {/* Export Button with dynamic gradient and soft glow */}
        <button 
          onClick={onExport}
          onMouseEnter={() => setIsExportHovered(true)}
          onMouseLeave={() => setIsExportHovered(false)}
          className="text-black text-[9px] sm:text-[10px] font-black px-2.5 sm:px-4 py-1 sm:py-1.5 rounded uppercase tracking-widest transition-glass flex items-center gap-1 sm:gap-1.5 active:scale-95 relative overflow-hidden shrink-0 shadow-md cursor-pointer z-20"
          style={{
            background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
            boxShadow: isExportHovered ? `0 0 25px ${activeColor}80` : `0 0 15px ${activeColor}40`,
            filter: isExportHovered ? 'brightness(1.1)' : 'brightness(1)'
          }}
          title="Export Video / Audio"
        >
          {isExportHovered && (
             <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] -translate-x-full" />
          )}
          <Download size={12} strokeWidth={3} className="relative z-10 shrink-0" />
          <span className="relative z-10 font-black tracking-wider">Export</span>
        </button>
      </div>

      <TemplatesModal isOpen={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
      <AudioSourceModal isOpen={isAudioModalOpen} onClose={() => setIsAudioModalOpen(false)} />
    </div>
  );
}
