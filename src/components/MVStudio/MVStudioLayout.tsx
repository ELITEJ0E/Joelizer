import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, TimelineClip } from '../../store/useMVStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { Layers, Sliders, Play } from 'lucide-react';

export function MVStudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  // 'media' | 'controls' | 'none'
  const [activePanel, setActivePanel] = useState<'media' | 'controls' | 'none'>('media');

  return (
    <div className="flex flex-row h-full bg-[#030304] text-slate-300 font-sans select-none overflow-hidden">
      
      {/* Slim Vertical Sidebar for toggling panels */}
      <div className="w-12 bg-black border-r border-white/10 flex flex-col items-center py-3 shrink-0 gap-3 z-40">
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

      {/* Expandable Panel */}
      {activePanel !== 'none' && (
        <div className="w-64 sm:w-72 lg:w-80 border-r border-white/10 flex flex-col bg-[#060608] shrink-0 transition-all z-30">
          {activePanel === 'media' && <MVAssetLibrary />}
          {activePanel === 'controls' && <MVWorkflow />}
        </div>
      )}

      {/* Main Center Area: Preview & Timeline */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-[#020202]">
        
        {/* Video Preview Canvas Stage */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden">
          <MVPreview />
        </div>

        {/* Timeline Viewport */}
        <div className="h-56 sm:h-64 border-t border-white/10 shrink-0 bg-[#060608]">
          <MVTimeline />
        </div>
      </div>
    </div>
  );
}
