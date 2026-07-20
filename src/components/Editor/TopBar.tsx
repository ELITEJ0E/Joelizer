import React from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { Settings, Download } from 'lucide-react';
import { cn } from '../../lib/utils';

export function TopBar({ onExport }: { onExport: () => void }) {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const setAudio = useStore(s => s.setAudio);
  
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

  return (
    <div className="h-14 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#00e676] rounded flex items-center justify-center text-black font-black italic">
            J
          </div>
          <span className="text-white font-bold tracking-tight uppercase text-sm hidden sm:inline">
            Joelizer <span className="text-xs font-mono font-normal opacity-40 ml-1">v0.8</span>
          </span>
        </div>
        
        <div className="hidden sm:block h-4 w-px bg-white/10" />
        
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs uppercase tracking-widest text-slate-500 font-semibold">Project /</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-32 sm:w-48 font-medium focus:ring-0"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex bg-white/5 rounded-md p-1 gap-1">
          {ratios.map(ratio => (
            <button
              key={ratio.id}
              onClick={() => setAspectRatio(ratio.id)}
              title={ratio.label}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors flex items-center justify-center",
                aspectRatio === ratio.id 
                  ? "bg-white/10 text-white" 
                  : "opacity-40 text-white hover:opacity-100"
              )}
            >
              {ratio.label}
            </button>
          ))}
        </div>

        <label className="cursor-pointer px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors">
          Audio
          <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
        </label>
        
        <button 
          onClick={onExport}
          className="bg-[#00e676] hover:bg-[#00c867] text-black text-xs font-bold px-4 py-1.5 rounded uppercase tracking-wider transition-colors flex items-center gap-2"
        >
          <Download size={14} strokeWidth={3} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
}
