import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, TimelineClip } from '../../store/useMVStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { Layers, Sliders, Play, Film, X } from 'lucide-react';

export function MVStudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const rehydrateMVAssets = useMVStore(s => s.rehydrateMVAssets);
  
  useEffect(() => {
    rehydrateMVAssets();
  }, [rehydrateMVAssets]);

  // 'media' | 'controls' | 'none'
  const [activePanel, setActivePanel] = useState<'media' | 'controls' | 'none'>('media');

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#030304] text-slate-300 font-sans select-none overflow-hidden relative">
      
      {/* Mobile Top Sub-Nav Bar (Visible only on < md screens) */}
      <div className="md:hidden bg-black border-b border-white/10 flex items-center justify-between px-2.5 py-1.5 shrink-0 z-40">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
          <button
            onClick={() => setActivePanel('none')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activePanel === 'none' ? 'bg-white/20 text-white shadow' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
            style={activePanel === 'none' ? { borderBottom: `2px solid ${activeColor}` } : {}}
          >
            <Film size={12} style={{ color: activeColor }} />
            <span>Preview & Timeline</span>
          </button>

          <button
            onClick={() => setActivePanel(p => p === 'media' ? 'none' : 'media')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activePanel === 'media' ? 'bg-white/20 text-white shadow' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
            style={activePanel === 'media' ? { borderBottom: `2px solid ${activeColor}` } : {}}
          >
            <Layers size={12} />
            <span>Media Library</span>
          </button>

          <button
            onClick={() => setActivePanel(p => p === 'controls' ? 'none' : 'controls')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activePanel === 'controls' ? 'bg-white/20 text-white shadow' : 'text-slate-400 hover:text-white bg-white/5'
            }`}
            style={activePanel === 'controls' ? { borderBottom: `2px solid ${activeColor}` } : {}}
          >
            <Sliders size={12} />
            <span>Auto Editor</span>
          </button>
        </div>
      </div>

      {/* Slim Vertical Sidebar (Visible on desktop md+) */}
      <div className="hidden md:flex w-12 bg-black border-r border-white/10 flex-col items-center py-3 shrink-0 gap-3 z-40">
        <button
          onClick={() => setActivePanel(p => p === 'media' ? 'none' : 'media')}
          className={`w-10 h-32 rounded flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
            activePanel === 'media' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activePanel === 'media' ? { borderRight: `2px solid ${activeColor}` } : {}}
          title="Media Library"
        >
          <Layers size={14} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            Media
          </span>
        </button>

        <button
          onClick={() => setActivePanel(p => p === 'controls' ? 'none' : 'controls')}
          className={`w-10 h-48 rounded flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
            activePanel === 'controls' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activePanel === 'controls' ? { borderRight: `2px solid ${activeColor}` } : {}}
          title="Auto Editor Controls"
        >
          <Sliders size={14} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            Auto Editor Controls
          </span>
        </button>
      </div>

      {/* Expandable Panel: Drawer overlay on mobile, relative column on desktop */}
      {activePanel !== 'none' && (
        <>
          {/* Mobile Backdrop */}
          <div 
            onClick={() => setActivePanel('none')} 
            className="md:hidden fixed inset-0 bg-black/75 backdrop-blur-sm z-40 animate-fade-in"
          />

          <div className="fixed md:relative inset-y-0 left-0 top-10 md:top-0 z-50 md:z-30 w-full sm:w-80 md:w-72 lg:w-80 border-r border-white/10 flex flex-col bg-[#060608] shrink-0 transition-all shadow-2xl md:shadow-none">
            {/* Mobile Panel Header with Close Button */}
            <div className="md:hidden p-2.5 border-b border-white/10 flex items-center justify-between bg-black/60 shrink-0">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                {activePanel === 'media' ? <Layers size={14} style={{ color: activeColor }} /> : <Sliders size={14} style={{ color: activeColor }} />}
                {activePanel === 'media' ? 'Media Library' : 'Auto Editor Controls'}
              </span>
              <button
                onClick={() => setActivePanel('none')}
                className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {activePanel === 'media' && <MVAssetLibrary />}
              {activePanel === 'controls' && <MVWorkflow />}
            </div>
          </div>
        </>
      )}

      {/* Main Center Area: Preview & Timeline */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-[#020202]">
        
        {/* Video Preview Canvas Stage */}
        <div className="flex-1 min-h-[200px] relative flex items-center justify-center p-2 overflow-hidden">
          <MVPreview />
        </div>

        {/* Timeline Viewport */}
        <div className="h-44 sm:h-56 md:h-64 border-t border-white/10 shrink-0 bg-[#060608]">
          <MVTimeline />
        </div>
      </div>
    </div>
  );
}
