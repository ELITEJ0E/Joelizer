import React, { useState, useRef, useEffect } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { MVPreview } from '../MVStudio/MVPreview';
import { InteractiveStageOverlay } from './InteractiveStageOverlay';
import { ExportModal } from '../Editor/ExportModal';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { formatTime } from '../../lib/utils';
import {
  Play, Pause, Download, Check, Upload, RotateCcw, RotateCw, Maximize2,
  Sparkles, Type, Film, Image as ImageIcon, Music, Sliders, Palette
} from 'lucide-react';

export function LyricsVideoLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setVisualizerColor = (color: string) => useStore.getState().updateVisualizerSettings({ color });

  const videoMode = useLyricsVideoStore(s => s.videoMode);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);

  const selectedTemplateId = useLyricsVideoStore(s => s.selectedTemplateId);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

  const selectedBackgroundPresetId = useLyricsVideoStore(s => s.selectedBackgroundPresetId);
  const setSelectedBackgroundPresetId = useLyricsVideoStore(s => s.setSelectedBackgroundPresetId);
  const customBackground = useLyricsVideoStore(s => s.customBackground);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);

  const typographyOverride = useLyricsVideoStore(s => s.typographyOverride);
  const updateTypographyOverride = useLyricsVideoStore(s => s.updateTypographyOverride);

  const visibleLineCount = useLyricsVideoStore(s => s.visibleLineCount);
  const setVisibleLineCount = useLyricsVideoStore(s => s.setVisibleLineCount);

  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const audioDuration = useStore(s => s.audioDuration);

  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);

  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex]) || useStore(s => s.tracks[0]);
  const albumArt = currentTrack?.albumArt || useStore(s => s.albumArt) || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const [showExportModal, setShowExportModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 640, height: 360 });

  // Update overlay stage dimensions on resize
  useEffect(() => {
    if (!stageContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setStageDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(stageContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Find active line timestamp for top bar
  const activeLine = lyricsLines.find(l => currentTime >= l.startTime && currentTime <= l.endTime);

  // Layout Styles Presets mapped to Mureka layout cards
  const LAYOUT_PRESETS: Array<{ id: LyricTemplateId; name: string; tag: string }> = [
    { id: 'full-screen', name: 'Full Cover', tag: 'Full Art' },
    { id: 'classic', name: 'Square Card', tag: 'Square' },
    { id: 'dreamy', name: 'Circle Card', tag: 'Circle' },
    { id: 'vinyl', name: 'Vinyl Record', tag: 'Spinning' },
    { id: 'kinetic', name: 'CD Disc', tag: 'CD Frame' },
    { id: 'centered', name: 'Glassmorphism', tag: 'Frosted' },
    { id: 'minimal', name: 'Minimal Focus', tag: 'Clean' },
  ];

  // Motion Background Preset Video Loops
  const BACKGROUND_LOOPS = [
    { id: 'cover', name: 'Song Cover', type: 'blurred-artwork', val: albumArt, isDefault: true },
    { id: 'sunset', name: 'Sunset Glow', type: 'gradient', val: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', duration: '00:05' },
    { id: 'cyber', name: 'Cyber Neon', type: 'particles', val: '#083344', duration: '00:03' },
    { id: 'aurora', name: 'Cosmic Aurora', type: 'gradient', val: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)', duration: '00:04' },
    { id: 'minimal', name: 'Deep Onyx', type: 'color', val: '#09090b', duration: '00:10' },
    { id: 'ocean', name: 'Ocean Depth', type: 'gradient', val: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', duration: '00:06' },
    { id: 'crimson', name: 'Crimson Fall', type: 'gradient', val: 'linear-gradient(135deg, #4c0519 0%, #2a0410 100%)', duration: '00:06' },
    { id: 'gold', name: 'Liquid Gold', type: 'gradient', val: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)', duration: '00:08' },
    { id: 'waveform', name: 'Sound Wave', type: 'waveform', val: '#171717', duration: '00:03' },
  ];

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      setCustomBackground({ type: 'video', value: url, videoUrl: url });
    } else {
      setCustomBackground({ type: 'image', value: url });
    }
  };

  const fontOptions = ['Outfit', 'Inter', 'Playfair Display', 'Space Grotesk', 'Plus Jakarta Sans', 'Cinzel'];

  return (
    <div className="flex flex-col h-full bg-[#050508] text-slate-200 font-sans select-none overflow-hidden relative">
      
      {/* 1. TOP HEADER */}
      <div className="bg-[#09090e] border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0 z-30">
        
        {/* Track Title Pill */}
        <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-xs text-slate-300 max-w-[200px] sm:max-w-md truncate">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ backgroundColor: activeColor }} />
          <span className="font-mono text-cyan-400 text-[11px] shrink-0" style={{ color: activeColor }}>
            {formatTime(currentTime)}
          </span>
          <span className="truncate font-semibold italic text-slate-200">
            {currentTrack?.name || 'Untitled Song'}
          </span>
        </div>

        {/* Top Right Preview Title */}
        <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
          <span>Preview</span>
          <span className="text-white font-bold max-w-[120px] sm:max-w-[200px] truncate">
            {currentTrack?.name || 'Untitled Song'}
          </span>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: LEFT CONTROL SIDEBAR + RIGHT STAGE */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* LEFT CONTROL SIDEBAR */}
        <div className="w-full md:w-80 lg:w-96 bg-[#09090e] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto no-scrollbar p-4 gap-5 z-20">
          
          {/* LAYOUT SELECTOR SECTION */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-cyan-400" />
                <span>Layout Style</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Select Design</span>
            </div>

            {/* Layout Cards Carousel/Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2.5">
              {LAYOUT_PRESETS.map((layout) => {
                const isSelected = selectedTemplateId === layout.id;
                return (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedTemplateId(layout.id)}
                    className={`group relative rounded-xl p-2.5 border text-left transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-400 text-white ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                        : 'bg-white/5 border-white/10 hover:border-white/25 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {/* Thumbnail Artwork Preview */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 shadow-md group-hover:scale-105 transition-transform">
                      <img src={albumArt} alt={layout.name} className="w-full h-full object-cover" />
                      {layout.id === 'vinyl' && (
                        <div className="absolute inset-0 rounded-full border-2 border-black/80 bg-black/40 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-cyan-400" />
                        </div>
                      )}
                      {layout.id === 'dreamy' && (
                        <div className="absolute inset-0 rounded-full border-2 border-cyan-400/60" />
                      )}
                    </div>

                    {/* Title & Badge */}
                    <div className="text-center">
                      <div className="text-[11px] font-bold truncate leading-tight">{layout.name}</div>
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">{layout.tag}</div>
                    </div>

                    {/* Active Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BACKGROUND SELECTOR SECTION */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Palette size={14} className="text-cyan-400" />
                <span>Background</span>
              </label>
              <span className="text-[10px] text-slate-400">Media / Color</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Upload Custom File Card */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-dashed border-white/20 hover:border-cyan-400 p-2 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-cyan-300 bg-white/5 hover:bg-cyan-950/20 transition-all cursor-pointer h-20"
              >
                <Upload size={16} />
                <span className="text-[10px] font-bold">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleCustomFileUpload}
                className="hidden"
              />

              {/* Default Song Cover & Background Loop Options */}
              {BACKGROUND_LOOPS.map((bg) => {
                const isSelected = customBackground.value === bg.val || (bg.isDefault && customBackground.type === 'blurred-artwork');
                return (
                  <button
                    key={bg.id}
                    onClick={() => {
                      if (bg.isDefault) {
                        setCustomBackground({ type: 'blurred-artwork', value: bg.val });
                      } else {
                        setCustomBackground({ type: bg.type as any, value: bg.val });
                      }
                    }}
                    className={`relative rounded-xl overflow-hidden border p-1 text-left transition-all cursor-pointer h-20 flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 ring-1 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                    style={{ background: bg.type === 'color' ? bg.val : bg.type === 'gradient' ? bg.val : '#111' }}
                  >
                    {bg.isDefault && (
                      <img src={albumArt} alt="Song Cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    )}

                    {/* Duration badge */}
                    {bg.duration && (
                      <span className="relative z-10 self-end text-[9px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-slate-300">
                        {bg.duration}
                      </span>
                    )}

                    <span className="relative z-10 text-[10px] font-bold text-white drop-shadow truncate mt-auto">
                      {bg.name}
                    </span>

                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow z-10">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ASPECT RATIO SECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Film size={14} className="text-cyan-400" />
              <span>Aspect Ratio</span>
            </label>

            <div className="grid grid-cols-4 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
              {(['16:9', '9:16', '3:4', '4:3'] as AspectRatio[]).map((ar) => {
                const isSelected = aspectRatio === ar;
                return (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black shadow'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[11px]">{ar}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT CANVAS STAGE & DRAGGABLE OVERLAY */}
        <div className="flex-1 min-w-0 bg-[#020204] flex flex-col relative overflow-hidden">
          
          {/* STAGE CONTAINER */}
          <div
            ref={stageContainerRef}
            className="flex-1 min-h-[320px] relative flex items-center justify-center p-4 overflow-hidden"
          >
            {/* Live Canvas Renderer */}
            <MVPreview />

            {/* Interactive Drag & Drop Overlay */}
            <InteractiveStageOverlay
              stageWidth={stageDimensions.width}
              stageHeight={stageDimensions.height}
            />
          </div>

          {/* BOTTOM STAGE CONTROLS TOOLBAR */}
          <div className="bg-[#08080c] border-t border-white/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 z-30">
            
            {/* Play/Pause & Time Scrubber */}
            <div className="flex items-center gap-4 w-full md:w-auto flex-1">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer shrink-0"
              >
                {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
              </button>

              <div className="flex items-center gap-3 text-sm font-mono text-slate-300 w-full max-w-md">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 100}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  style={{ accentColor: activeColor }}
                />
                <span>{formatTime(audioDuration)}</span>
              </div>
            </div>

            {/* Color Dot Picker, Lines, Font & Download Button */}
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              
              {/* Color Accent Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-9 h-9 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-md"
                  style={{ backgroundColor: activeColor }}
                  title="Accent Color"
                />
                {showColorPicker && (
                  <div className="absolute bottom-12 right-0 md:left-0 md:right-auto bg-black/90 border border-white/20 p-2 rounded-xl flex gap-2 shadow-2xl z-50">
                    {['#00e676', '#38bdf8', '#06b6d4', '#c084fc', '#f472b6', '#fef08a', '#ffffff'].map((c) => (
                      <button
                        key={c}
                        onClick={() => { setVisualizerColor(c); setShowColorPicker(false); }}
                        className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Visible Lines Count Selector */}
              <select
                value={visibleLineCount}
                onChange={(e) => setVisibleLineCount(parseInt(e.target.value))}
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 font-semibold cursor-pointer outline-none hover:bg-white/5"
              >
                <option value={1}>1 Line</option>
                <option value={2}>2 Lines</option>
                <option value={5}>5 Lines</option>
              </select>

              {/* Font Dropdown */}
              <select
                value={typographyOverride.fontFamily}
                onChange={(e) => updateTypographyOverride({ fontFamily: e.target.value })}
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 font-semibold cursor-pointer outline-none hover:bg-white/5 max-w-[140px]"
              >
                {fontOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* DOWNLOAD / EXPORT MP4 BUTTON */}
              <button
                onClick={() => setShowExportModal(true)}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer ml-2"
              >
                <Download size={18} strokeWidth={2.5} />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Production Remotion Export Modal */}
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
