import React, { useState, useRef, useEffect } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { MVPreview } from '../MVStudio/MVPreview';
import { GlobalSettingsPanel } from '../MVStudio/GlobalSettingsPanel';
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

  const [sidebarTab, setSidebarTab] = useState<'design' | 'settings'>('design');

  const videoMode = useLyricsVideoStore(s => s.videoMode);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);

  useEffect(() => {
    setVideoMode('lyrics-video');
  }, [setVideoMode]);

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
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);

  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const audioDuration = useStore(s => s.audioDuration) || 180;

  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);

  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex] || s.tracks[0]);
  const globalAlbumArt = useStore(s => s.albumArt);
  const albumArt = currentTrack?.albumArt || globalAlbumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const [showExportModal, setShowExportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout Styles Presets mapped to Mureka layout cards
  const LAYOUT_PRESETS: Array<{ id: LyricTemplateId }> = [
    { id: 'full' },
    { id: 'square' },
    { id: 'circle' },
    { id: 'vinyl' },
    { id: 'cd' },
    { id: 'vinyl-needle' },
    { id: 'cd-needle' },
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
  const colorSwatches = ['#00e676', '#38bdf8', '#06b6d4', '#c084fc', '#f472b6', '#fef08a', '#ffffff'];

  // Waveform bars data for bottom timeline visualizer
  const WAVEFORM_BARS = [
    0.25, 0.40, 0.65, 0.85, 0.45, 0.30, 0.55, 0.75, 0.90, 0.60,
    0.35, 0.50, 0.70, 0.95, 0.80, 0.40, 0.25, 0.60, 0.85, 0.50,
    0.30, 0.45, 0.75, 0.90, 0.65, 0.35, 0.50, 0.80, 1.00, 0.70,
    0.40, 0.25, 0.60, 0.85, 0.55, 0.35, 0.50, 0.75, 0.90, 0.60,
    0.30, 0.45, 0.70, 0.95, 0.80, 0.40, 0.25, 0.55, 0.85, 0.50,
    0.30, 0.50, 0.75, 0.90, 0.65, 0.35, 0.45, 0.80, 0.95, 0.70,
    0.40, 0.25, 0.55, 0.85, 0.50, 0.30, 0.45, 0.75, 0.60, 0.35
  ];

  const handleWaveformScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(ratio * audioDuration);
  };

  const playbackProgress = Math.max(0, Math.min(1, currentTime / (audioDuration || 1)));

  return (
    <div className="flex flex-col h-full bg-[#050508] text-slate-200 font-sans select-none overflow-hidden relative">
      
      {/* MAIN WORKSPACE: LEFT CONTROL SIDEBAR + RIGHT STAGE */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* LEFT CONTROL SIDEBAR */}
        <div className="w-full md:w-80 lg:w-96 bg-[#09090e] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto no-scrollbar p-4 gap-5 z-20">
          
          {/* Sidebar Tab Toggle */}
          <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => setSidebarTab('design')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                sidebarTab === 'design'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-black shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Quick Design
            </button>
            <button
              onClick={() => setSidebarTab('settings')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                sidebarTab === 'settings'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-black shadow'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Advanced Settings
            </button>
          </div>

          {sidebarTab === 'settings' ? (
            <div className="flex-1 -mx-4 -my-4 h-full">
              <GlobalSettingsPanel />
            </div>
          ) : (
            <>
              {/* 1. LAYOUT SELECTOR SECTION */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Layout</span>
            </label>

            {/* Layout Cards Scroll */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
              {LAYOUT_PRESETS.map((layout) => {
                const isSelected = selectedTemplateId === layout.id;
                return (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedTemplateId(layout.id)}
                    className={`relative shrink-0 w-[72px] h-[96px] rounded-xl overflow-hidden border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-cyan-400 ring-1 ring-cyan-400'
                        : 'border-transparent hover:border-white/20'
                    }`}
                  >
                    {/* Blurred Background Base for all except full */}
                    {layout.id !== 'full' && (
                      <div className="absolute inset-0 z-0">
                        <img src={albumArt} alt="" className="w-full h-full object-cover blur-sm brightness-50" />
                      </div>
                    )}

                    {/* Content Layers */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-1">
                      
                      {layout.id === 'full' && (
                        <img src={albumArt} alt="" className="w-full h-full object-cover rounded-lg" />
                      )}

                      {layout.id === 'square' && (
                        <div className="w-10 h-10 rounded-md overflow-hidden shadow-lg mb-2 relative">
                           <img src={albumArt} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {layout.id === 'circle' && (
                        <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg mb-2 relative">
                           <img src={albumArt} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {(layout.id === 'vinyl' || layout.id === 'vinyl-needle') && (
                        <div className="w-12 h-12 rounded-full bg-[#111] shadow-xl mb-2 relative flex items-center justify-center border border-white/10">
                           <div className="absolute inset-1 rounded-full border border-white/10"></div>
                           <div className="absolute inset-2 rounded-full border border-white/10"></div>
                           <div className="w-4 h-4 rounded-full overflow-hidden relative z-10">
                              <img src={albumArt} alt="" className="w-full h-full object-cover" />
                           </div>
                           {layout.id === 'vinyl-needle' && (
                              <div className="absolute -top-1 -right-1 w-6 h-8 border-r-2 border-t-2 border-[#a3a3a3] rounded-tr-lg z-20 origin-top-right rotate-12">
                                <div className="absolute bottom-0 right-[-3px] w-1.5 h-2.5 bg-[#404040] rounded-sm"></div>
                              </div>
                           )}
                        </div>
                      )}

                      {(layout.id === 'cd' || layout.id === 'cd-needle') && (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 via-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(255,255,255,0.4)] mb-2 relative flex items-center justify-center">
                           <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
                             <div className="w-10 h-10 rounded-full overflow-hidden relative z-10">
                                <img src={albumArt} alt="" className="w-full h-full object-cover" />
                             </div>
                           </div>
                           {layout.id === 'cd-needle' && (
                              <div className="absolute -top-1 -right-1 w-6 h-8 border-r-2 border-t-2 border-[#e5e5e5] rounded-tr-lg z-20 origin-top-right rotate-12 shadow">
                                <div className="absolute bottom-0 right-[-3px] w-1.5 h-2.5 bg-[#525252] rounded-sm"></div>
                              </div>
                           )}
                        </div>
                      )}

                      {/* Mock Text Lines */}
                      <div className="flex flex-col gap-1 items-center w-full px-2 opacity-60">
                        <div className="h-1 w-full max-w-[40px] bg-white rounded-full"></div>
                        <div className="h-1 w-full max-w-[30px] bg-white rounded-full"></div>
                      </div>
                    </div>

                    {/* Active Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow z-20">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BACKGROUND SELECTOR SECTION - 3 ROWS HORIZONTAL SCROLL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <ImageIcon size={14} className="text-cyan-400" />
                <span>Background</span>
              </label>
              <span className="text-[10px] font-mono text-slate-500 font-semibold">
                {BACKGROUND_PRESETS.length + 1} styles · scroll left/right
              </span>
            </div>

            {/* 3-Row Horizontal Scrolling Carousel */}
            <div className="grid grid-rows-3 grid-flow-col auto-cols-[104px] sm:auto-cols-[112px] gap-2 overflow-x-auto pb-2 no-scrollbar select-none h-[220px]">
              {/* Upload Custom File Card */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-xl border border-dashed border-white/20 hover:border-cyan-400 p-2 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-cyan-300 bg-white/5 hover:bg-cyan-950/20 transition-all cursor-pointer group shrink-0"
              >
                <Upload size={14} className="group-hover:scale-110 transition-transform text-cyan-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-white">Upload</span>
                <span className="text-[8px] text-slate-500 font-medium">Img / Video</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleCustomFileUpload}
                className="hidden"
              />

              {/* Background Preset Cards flowing into 3 rows */}
              {BACKGROUND_PRESETS.map((bg) => {
                const isSongCover = bg.id === 'cover';
                const isSelected = isSongCover
                  ? customBackground.type === 'blurred-artwork' || (selectedBackgroundPresetId === 'cover' && !customBackground.videoUrl)
                  : (customBackground.value === bg.value && customBackground.type === bg.type) || selectedBackgroundPresetId === bg.id;

                return (
                  <button
                    key={bg.id}
                    onClick={() => {
                      setSelectedBackgroundPresetId(bg.id);
                      if (isSongCover) {
                        setCustomBackground({ type: 'blurred-artwork', value: albumArt });
                      } else {
                        setCustomBackground({ type: bg.type as any, value: bg.value });
                      }
                    }}
                    className={`relative rounded-xl overflow-hidden border p-1.5 text-left transition-all cursor-pointer flex flex-col justify-between shrink-0 group ${
                      isSelected
                        ? 'border-cyan-400 ring-1 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)] scale-[1.02]'
                        : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                    }`}
                    style={{
                      background: bg.previewGradient || bg.value || '#0a0a0e'
                    }}
                  >
                    {isSongCover && (
                      <img 
                        src={albumArt} 
                        alt="Song Cover" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none group-hover:opacity-75 transition-opacity" 
                      />
                    )}

                    {/* Top Row: Category/Duration Pill */}
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <span className="text-[6.5px] font-black text-white/95 bg-black/60 px-1 py-0.5 rounded backdrop-blur-xs uppercase tracking-widest scale-90 origin-left">
                        {bg.category || (bg.type === 'particles' ? 'Anim' : bg.type === 'waveform' ? 'Wave' : 'Grad')}
                      </span>
                      {bg.duration && (
                        <span className="text-[6.5px] font-mono font-bold text-slate-400 bg-black/70 px-1 py-0.5 rounded scale-90 origin-right">
                          {bg.duration}
                        </span>
                      )}
                    </div>

                    {/* Bottom Title */}
                    <div className="relative z-10 mt-auto flex items-center justify-between w-full">
                      <span className="text-[7.5px] font-extrabold text-white uppercase tracking-wider truncate drop-shadow-md bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-xs max-w-full">
                        {bg.name}
                      </span>
                    </div>

                    {/* Dark Vignette Overlay */}
                    <div className="absolute inset-0 bg-black/20 pointer-events-none" />

                    {/* Active Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-lg z-20">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. ASPECT RATIO SECTION */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Film size={14} className="text-cyan-400" />
              <span>Aspect Ratio</span>
            </label>

            <div className="grid grid-cols-4 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
              {(['16:9', '9:16', '1:1', '4:3'] as AspectRatio[]).map((ar) => {
                const isSelected = aspectRatio === ar;
                return (
                  <button
                    key={ar}
                    onClick={() => {
                      setAspectRatio(ar);
                      resetElementPositions(ar);
                    }}
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

          {/* 4. STYLE & TYPOGRAPHY SECTION */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Type size={14} className="text-cyan-400" />
              <span>Style & Typography</span>
            </label>

            {/* Font Family Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Font Family</span>
              <select
                value={typographyOverride.fontFamily}
                onChange={(e) => updateTypographyOverride({ fontFamily: e.target.value })}
                className="w-full bg-black/70 border border-white/15 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold cursor-pointer outline-none hover:border-cyan-400/50 transition-colors"
              >
                {fontOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Visible Lines Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Lyrics Display Lines</span>
              <div className="grid grid-cols-3 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                {[1, 2, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => setVisibleLineCount(count)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visibleLineCount === count
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {count} {count === 1 ? 'Line' : 'Lines'}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Swatches */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Accent Color</span>
              <div className="flex items-center gap-2 bg-black/60 p-2 rounded-xl border border-white/10 flex-wrap">
                {colorSwatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => setVisualizerColor(c)}
                    className={`w-7 h-7 rounded-full border transition-transform cursor-pointer relative ${
                      activeColor.toLowerCase() === c.toLowerCase()
                        ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.6)]'
                        : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {activeColor.toLowerCase() === c.toLowerCase() && (
                      <Check size={12} className="text-black absolute inset-0 m-auto" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </>
          )}

        </div>

        {/* RIGHT CANVAS STAGE */}
        <div className="flex-1 min-w-0 bg-[#020204] flex flex-col relative overflow-hidden">
          <div className="flex-1 min-h-[320px] relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <MVPreview mode="lyrics-video" />
          </div>

          {/* BOTTOM VISUALIZER RANGE DISPLAY PLAYER */}
          <div className="bg-[#08080c] border-t border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-4 shrink-0 z-30">
            
            {/* Circular Play / Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer shrink-0"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
            </button>

            {/* Visualizer Range Display Timeline Scrubber */}
            <div 
              onClick={handleWaveformScrub}
              className="flex-1 h-12 bg-black/80 rounded-xl border border-white/10 px-3 flex items-center gap-3 cursor-pointer relative group overflow-hidden select-none"
            >
              {/* AUD Badge */}
              <div className="flex items-center gap-1 font-mono text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/40 shrink-0 shadow">
                <Music size={11} className="text-emerald-400" />
                <span>AUD</span>
              </div>

              {/* Waveform Bars Container */}
              <div className="flex-1 h-8 flex items-center gap-[2px] relative">
                {WAVEFORM_BARS.map((height, idx) => {
                  const barRatio = idx / WAVEFORM_BARS.length;
                  const isPlayed = barRatio <= playbackProgress;
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-sm transition-colors duration-75"
                      style={{
                        height: `${height * 100}%`,
                        backgroundColor: isPlayed ? activeColor : 'rgba(255, 255, 255, 0.15)',
                        boxShadow: isPlayed ? `0 0 6px ${activeColor}80` : 'none'
                      }}
                    />
                  );
                })}
              </div>

              {/* Time readout */}
              <div className="text-[11px] font-mono font-bold text-slate-300 bg-black/60 px-2 py-0.5 rounded border border-white/10 shrink-0">
                {formatTime(currentTime)} / {formatTime(audioDuration)}
              </div>
            </div>

            {/* DOWNLOAD / EXPORT MP4 BUTTON */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 sm:px-5 py-2.5 rounded-full bg-white hover:bg-slate-200 text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Download size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Download</span>
            </button>
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
