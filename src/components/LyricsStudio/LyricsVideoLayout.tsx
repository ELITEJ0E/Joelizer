import React, { useState } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore } from '../../store/useStore';
import { TemplateCarousel } from './TemplateCarousel';
import { BackgroundCarousel } from './BackgroundCarousel';
import { ArtworkPanel } from './ArtworkPanel';
import { TypographyPanel } from './TypographyPanel';
import { MVPreview } from '../MVStudio/MVPreview';
import { MVTimeline } from '../MVStudio/MVTimeline';
import { Sparkles, LayoutTemplate, Palette, Disc, Type, Wand2, X } from 'lucide-react';

export function LyricsVideoLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const isAutoGenerating = useLyricsVideoStore(s => s.isAutoGenerating);
  const generateLyricsVideo = useLyricsVideoStore(s => s.generateLyricsVideo);

  const [activeTab, setActiveTab] = useState<'templates' | 'backgrounds' | 'artwork' | 'typography'>('templates');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#030304] text-slate-300 font-sans select-none overflow-hidden relative">
      
      {/* Mobile Top Controls Bar */}
      <div className="md:hidden bg-black border-b border-white/10 flex items-center justify-between px-2.5 py-2 shrink-0 z-40">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => { setActiveTab('templates'); setMobilePanelOpen(true); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'templates' && mobilePanelOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
            }`}
          >
            <LayoutTemplate size={12} />
            <span>Templates</span>
          </button>

          <button
            onClick={() => { setActiveTab('backgrounds'); setMobilePanelOpen(true); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'backgrounds' && mobilePanelOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
            }`}
          >
            <Palette size={12} />
            <span>Backgrounds</span>
          </button>

          <button
            onClick={() => { setActiveTab('artwork'); setMobilePanelOpen(true); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'artwork' && mobilePanelOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
            }`}
          >
            <Disc size={12} />
            <span>Artwork</span>
          </button>

          <button
            onClick={() => { setActiveTab('typography'); setMobilePanelOpen(true); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'typography' && mobilePanelOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
            }`}
          >
            <Type size={12} />
            <span>Typography</span>
          </button>
        </div>

        {/* Generate Button on Mobile */}
        <button
          onClick={generateLyricsVideo}
          disabled={isAutoGenerating}
          className="px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1 text-black shadow-lg shrink-0 ml-1 cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: activeColor }}
        >
          <Wand2 size={12} className={isAutoGenerating ? 'animate-spin' : ''} />
          <span>{isAutoGenerating ? 'Generating...' : 'Auto Gen'}</span>
        </button>
      </div>

      {/* Desktop Vertical Icon Sidebar */}
      <div className="hidden md:flex w-14 bg-black border-r border-white/10 flex-col items-center py-3 shrink-0 gap-3 z-40">
        <button
          onClick={() => setActiveTab('templates')}
          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeTab === 'templates' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activeTab === 'templates' ? { borderRight: `3px solid ${activeColor}` } : {}}
          title="Templates Carousel"
        >
          <LayoutTemplate size={18} />
        </button>

        <button
          onClick={() => setActiveTab('backgrounds')}
          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeTab === 'backgrounds' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activeTab === 'backgrounds' ? { borderRight: `3px solid ${activeColor}` } : {}}
          title="Background Preset Carousel"
        >
          <Palette size={18} />
        </button>

        <button
          onClick={() => setActiveTab('artwork')}
          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeTab === 'artwork' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activeTab === 'artwork' ? { borderRight: `3px solid ${activeColor}` } : {}}
          title="Artwork & Visualizer Objects"
        >
          <Disc size={18} />
        </button>

        <button
          onClick={() => setActiveTab('typography')}
          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            activeTab === 'typography' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
          style={activeTab === 'typography' ? { borderRight: `3px solid ${activeColor}` } : {}}
          title="Typography & Aspect Ratios"
        >
          <Type size={18} />
        </button>
      </div>

      {/* Control Drawer / Panel */}
      {mobilePanelOpen && (
        <div className="fixed md:relative inset-y-0 left-0 top-11 md:top-0 z-30 w-full sm:w-80 md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-[#060608] shrink-0 shadow-2xl md:shadow-none">
          
          {/* Header with Auto Generator */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/60 shrink-0">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} style={{ color: activeColor }} />
              {activeTab === 'templates' && 'Lyric Video Templates'}
              {activeTab === 'backgrounds' && 'Background & Themes'}
              {activeTab === 'artwork' && 'Artwork Objects'}
              {activeTab === 'typography' && 'Typography & Canvas'}
            </span>

            {/* Desktop Auto-Generate Button */}
            <button
              onClick={generateLyricsVideo}
              disabled={isAutoGenerating}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-black shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: activeColor }}
            >
              <Wand2 size={13} className={isAutoGenerating ? 'animate-spin' : ''} />
              <span>{isAutoGenerating ? 'Generating...' : 'Auto-Generate'}</span>
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobilePanelOpen(false)}
              className="md:hidden p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Active Panel Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'templates' && <TemplateCarousel />}
            {activeTab === 'backgrounds' && <BackgroundCarousel />}
            {activeTab === 'artwork' && <ArtworkPanel />}
            {activeTab === 'typography' && <TypographyPanel />}
          </div>
        </div>
      )}

      {/* Center Main Stage: Preview Canvas + Timeline */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-[#020202]">
        
        {/* Preview Stage */}
        <div className="flex-1 min-h-[200px] relative flex items-center justify-center p-2 overflow-hidden">
          <MVPreview />
        </div>

        {/* Timeline Stage */}
        <div className="h-40 sm:h-48 md:h-52 border-t border-white/10 shrink-0 bg-[#060608]">
          <MVTimeline />
        </div>
      </div>
    </div>
  );
}
