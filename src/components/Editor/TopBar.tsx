import React, { useState } from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { Download, Music, Film, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AudioSourceModal } from '../Audio/AudioSourceModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function TopBar({ onExport }: { onExport: () => void }) {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isExportHovered, setIsExportHovered] = useState(false);

  const ratios: { id: AspectRatio; icon: string; label: string }[] = [
    { id: '16:9', icon: '▭', label: '16:9' },
    { id: '9:16', icon: '▯', label: '9:16' },
    { id: '1:1', icon: '□', label: '1:1' },
    { id: '3:4', icon: '◧', label: '3:4' },
    { id: '4:3', icon: '◨', label: '4:3' },
  ];

  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="h-16 sm:h-16 bg-black/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-3 sm:px-6 z-30 relative shadow-xl w-full max-w-full overflow-hidden shrink-0">
      <div className="absolute top-0 inset-x-0 h-[1px] bg-white/10 pointer-events-none" />
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        {/* Branding with gradient, equalizer motif, and soft glow */}
        <div 
          onClick={() => setActiveTab('lyrics')}
          className="flex items-center gap-1.5 sm:gap-3 group cursor-pointer transition-all duration-300 active:scale-95 shrink-0"
        >
          {/* Emblem Icon matching the official favicon and app icon */}
          <div 
            className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-black/90 border flex items-center justify-center transition-all duration-300 overflow-hidden shadow-lg group-hover:scale-105 shrink-0 p-1.5"
            style={{
              borderColor: `${activeColor}80`,
              boxShadow: `0 0 15px ${activeColor}40, inset 0 0 10px ${activeColor}30`
            }}
          >
            {/* Ambient background glow */}
            <div 
              className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity blur-xs"
              style={{ background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)` }}
            />
            
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

            {/* Faithful Miniature of Favicon SVG */}
            <svg viewBox="0 0 512 512" className="w-full h-full relative z-10 select-none pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <g filter="drop-shadow(0px 0px 12px #00ff87)">
                <rect x="72" y="240" width="26" height="32" rx="13" fill="#00e676" opacity="0.75"/>
                <rect x="112" y="190" width="26" height="132" rx="13" fill="#00e676"/>
                <rect x="152" y="140" width="26" height="232" rx="13" fill="#00ff87"/>
                <rect x="192" y="96" width="26" height="320" rx="13" fill="#00ff87"/>
                <rect x="232" y="160" width="26" height="192" rx="13" fill="#00ff87"/>
                <rect x="272" y="120" width="26" height="272" rx="13" fill="#00e5ff"/>
                <rect x="312" y="72" width="26" height="368" rx="13" fill="#00e5ff"/>
                <rect x="352" y="150" width="26" height="212" rx="13" fill="#00e5ff"/>
                <rect x="392" y="210" width="26" height="92" rx="13" fill="#00e5ff"/>
                <rect x="432" y="246" width="26" height="20" rx="10" fill="#00e5ff" opacity="0.6"/>
              </g>
              <path d="M 50 256 Q 112 160, 172 256 T 292 256 T 412 256 T 462 256" 
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="16" 
                    strokeLinecap="round" 
                    opacity="0.9" />
            </svg>
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
        <nav className="flex items-center bg-white/[0.03] border border-white/10 rounded-lg p-0.5 sm:p-1 gap-0.5 sm:gap-1 shrink-0 overflow-x-auto no-scrollbar max-w-[200px] min-[400px]:max-w-[280px] sm:max-w-none">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer relative overflow-hidden",
              activeTab === 'create' 
                ? "bg-white/15 text-white shadow-md font-black" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'create' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
            title="AI Song & Music Generation Studio (ACE-Step v1.5)"
          >
            <Sparkles size={12} style={{ color: activeColor }} />
            <span>Generate Music</span>
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer relative overflow-hidden",
              activeTab === 'studio' 
                ? "bg-white/15 text-white shadow-md" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'studio' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
            title="Multitrack DAW Workstation for recording, mixing, and stem arrangement"
          >
            <Music size={12} />
            <span>DAW Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('lrc')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer relative overflow-hidden",
              activeTab === 'lrc' 
                ? "bg-white/15 text-white shadow-md" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'lrc' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
            title="AI word-by-word timestamp alignment studio"
          >
            <span>LRC Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('lyrics')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer relative overflow-hidden",
              activeTab === 'lyrics'
                ? "bg-white/15 text-white shadow-md" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'lyrics' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
            title="Lyrics video with visualizer & album-art spinning vinyl templates"
          >
            <Sparkles size={11} className={activeTab === 'lyrics' ? "text-white" : "text-[#00e676]"} />
            <span>Lyrics Video</span>
          </button>

          <button
            onClick={() => setActiveTab('mv-studio')}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer relative overflow-hidden",
              activeTab === 'mv-studio'
                ? "bg-white/15 text-white shadow-md" 
                : "text-slate-300 hover:text-white hover:bg-white/5"
            )}
            style={activeTab === 'mv-studio' ? { 
              color: activeColor,
              backgroundColor: `${activeColor}20`,
              borderColor: `${activeColor}50` 
            } : {}}
            title="Music video timeline editing studio"
          >
            <Film size={12} />
            <span>MV Studio</span>
          </button>
        </nav>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 ml-1">
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

        {/* Aspect Ratio Selector (Mobile - Shadcn Select) */}
        <div className="flex md:hidden shrink-0">
          <Select value={aspectRatio} onValueChange={(val) => setAspectRatio(val as AspectRatio)}>
            <SelectTrigger className="h-7 w-[72px] px-2 bg-white/[0.03] border-white/10 text-[9px] font-bold tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0c]/95 border-white/15 backdrop-blur-2xl">
              {ratios.map(ratio => (
                <SelectItem key={ratio.id} value={ratio.id} className="text-[10px] font-bold">
                  {ratio.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <AudioSourceModal isOpen={isAudioModalOpen} onClose={() => setIsAudioModalOpen(false)} />
    </div>
  );
}
