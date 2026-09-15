import React, { useState, useRef, useEffect } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { MVPreview } from '../MVStudio/MVPreview';
import { GlobalSettingsPanel } from '../MVStudio/GlobalSettingsPanel';
import { InteractiveStageOverlay } from './InteractiveStageOverlay';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { CURATED_FONTS, FONT_OPTIONS } from '../../lib/curatedFonts';
import { cn, formatTime } from '../../lib/utils';
import { SongListSection } from './SongListSection';
import { SongListPopover } from '../Audio/SongListPopover';
import { VideoSlider } from '../ui/video-slider';
import { AppColorPicker } from '../ui/color-picker';
import { audioManager } from '../../lib/audio';
import {
  Play, Pause, Check, Upload, RotateCcw, RotateCw, Maximize2,
  Sparkles, Type, Film, Image as ImageIcon, Music, Sliders, Palette,
  SkipBack, SkipForward, Repeat
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

  const animationStyle = useLyricsVideoStore(s => s.animationStyle);
  const setAnimationStyle = useLyricsVideoStore(s => s.setAnimationStyle);

  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsLooping = useStore(s => s.setIsLooping);
  const previousTrack = useStore(s => s.previousTrack);
  const nextTrack = useStore(s => s.nextTrack);
  const audioDuration = useStore(s => s.audioDuration) || 180;

  const handleSeek = (time: number) => {
    const t = Math.max(0, Math.min(audioDuration, time));
    setCurrentTime(t);
    audioManager.seek(t);
  };

  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);

  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex] || s.tracks[0]);
  const globalAlbumArt = useStore(s => s.albumArt);
  const albumArt = currentTrack?.albumArt || globalAlbumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layout Styles Presets mapped to Mureka layout cards
  const LAYOUT_PRESETS: Array<{ id: LyricTemplateId }> = [
    { id: 'full' },
    { id: 'square' },
    { id: 'circle' },
    { id: 'vinyl' },
    { id: 'glowing-disc' },
    { id: 'vinyl-needle' },
    { id: 'glowing-disc-needle' },
    { id: 'cd' },
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
    <div className="flex flex-col h-full bg-[#0a0c0f] text-[#f0f3f6] font-sans select-none overflow-hidden relative">
      
      {/* MAIN WORKSPACE: LEFT CONTROL SIDEBAR + RIGHT STAGE */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* LEFT CONTROL SIDEBAR */}
        <div className="w-full md:w-80 lg:w-96 bg-[#12161c] border-r border-[#232933] flex flex-col shrink-0 overflow-y-auto no-scrollbar p-3.5 gap-4 z-20">
          
          {/* Sidebar Tab Toggle */}
          <div className="flex gap-1 p-0.5 bg-[#0e1115] rounded border border-[#232933] shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab('design')}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center",
                sidebarTab === 'design'
                  ? "bg-[#181d26] text-accent border border-[#2b3442]"
                  : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/50"
              )}
            >
              Quick Design
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('settings')}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center",
                sidebarTab === 'settings'
                  ? "bg-[#181d26] text-accent border border-[#2b3442]"
                  : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/50"
              )}
            >
              Advanced Settings
            </button>
          </div>

          {sidebarTab === 'settings' ? (
            <div className="flex-1 -mx-3.5 -my-3.5 h-full">
              <GlobalSettingsPanel />
            </div>
          ) : (
            <>
              {/* 0. SONG LIST SECTION */}
              <div className="pb-3 border-b border-[#232933]">
                <SongListSection />
              </div>

              {/* 1. LAYOUT SELECTOR SECTION */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span>Layout</span>
                </label>

                {/* Layout Cards Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                  {LAYOUT_PRESETS.map((layout) => {
                    const isSelected = selectedTemplateId === layout.id;
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(layout.id)}
                        className={cn(
                          "relative shrink-0 w-[72px] h-[94px] rounded overflow-hidden border transition-all cursor-pointer group bg-[#181d26]",
                          isSelected
                            ? "border-accent ring-1 ring-accent"
                            : "border-[#232933] hover:border-[#2b3442]"
                        )}
                      >
                        {/* Blurred Background Base for all except full */}
                        {layout.id !== 'full' && (
                          <div className="absolute inset-0 z-0">
                            <img src={albumArt} alt="" className="w-full h-full object-cover blur-sm brightness-40" />
                          </div>
                        )}

                        {/* Content Layers */}
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-1">
                          
                          {layout.id === 'full' && (
                            <img src={albumArt} alt="" className="w-full h-full object-cover rounded" />
                          )}

                          {layout.id === 'square' && (
                            <div className="w-9 h-9 rounded overflow-hidden shadow mb-1.5 relative border border-white/10">
                               <img src={albumArt} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {layout.id === 'circle' && (
                            <div className="w-9 h-9 rounded-full overflow-hidden shadow mb-1.5 relative border border-white/20">
                               <img src={albumArt} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {(layout.id === 'glowing-disc' || layout.id === 'glowing-disc-needle') && (
                            <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#232933] mb-1.5 relative flex items-center justify-center border border-accent/40">
                              <div className="w-full h-full rounded-full bg-[#111317] relative overflow-hidden flex items-center justify-center border border-white/10">
                                <div className="absolute inset-1 rounded-full border border-white/10"></div>
                                <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                  <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                </div>
                                {layout.id === 'glowing-disc-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(layout.id === 'vinyl' || layout.id === 'vinyl-needle') && (
                            <div className="w-11 h-11 rounded-full bg-[#111317] shadow mb-1.5 relative flex items-center justify-center border border-[#232933]">
                               <div className="absolute inset-1 rounded-full border border-white/10"></div>
                               <div className="absolute inset-2 rounded-full border border-white/10"></div>
                               <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                  <img src={albumArt} alt="" className="w-full h-full object-cover" />
                               </div>
                               {layout.id === 'vinyl-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                               )}
                            </div>
                          )}

                          {(layout.id === 'cd' || layout.id === 'cd-needle') && (
                            <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#1d222b] mb-1.5 relative flex items-center justify-center border border-[#232933]">
                               <div className="w-full h-full rounded-full bg-[#14171d] relative overflow-hidden flex items-center justify-center">
                                 <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20">
                                    <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                 </div>
                                 <div className="w-1.5 h-1.5 rounded-full bg-black border border-white/20 absolute"></div>
                               </div>
                               {layout.id === 'cd-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                               )}
                            </div>
                          )}

                          {/* Mock Text Lines */}
                          <div className="flex flex-col gap-0.5 items-center w-full px-2 opacity-50">
                            <div className="h-0.5 w-full max-w-[36px] bg-white rounded-full"></div>
                            <div className="h-0.5 w-full max-w-[26px] bg-white rounded-full"></div>
                          </div>
                        </div>

                        {/* Active Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                            <Check size={9} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. BACKGROUND SELECTOR SECTION - 3 ROWS HORIZONTAL SCROLL */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-accent" />
                    <span>Background</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#5e6877]">
                    {BACKGROUND_PRESETS.length + 1} styles · scroll
                  </span>
                </div>

                {/* 3-Row Horizontal Scrolling Carousel */}
                <div className="grid grid-rows-3 grid-flow-col auto-cols-[104px] sm:auto-cols-[112px] gap-1.5 overflow-x-auto pb-1.5 no-scrollbar select-none h-[210px]">
                  {/* Upload Custom File Card */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative rounded border border-dashed border-[#2b3442] hover:border-accent p-2 flex flex-col items-center justify-center gap-1 text-[#7e8999] hover:text-accent bg-[#0e1115] hover:bg-[#181d26] transition-colors cursor-pointer group shrink-0"
                  >
                    <Upload size={13} className="text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#f0f3f6]">Upload</span>
                    <span className="text-[8px] text-[#5e6877]">Img / Video</span>
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
                        type="button"
                        onClick={() => {
                          setSelectedBackgroundPresetId(bg.id);
                          if (isSongCover) {
                            setCustomBackground({ type: 'blurred-artwork', value: albumArt });
                          } else {
                            setCustomBackground({ type: bg.type as any, value: bg.value });
                          }
                        }}
                        className={cn(
                          "relative rounded overflow-hidden border p-1.5 text-left transition-colors cursor-pointer flex flex-col justify-between shrink-0 group bg-[#181d26]",
                          isSelected
                            ? "border-accent ring-1 ring-accent"
                            : "border-[#232933] hover:border-[#2b3442]"
                        )}
                        style={{
                          background: bg.previewGradient || bg.value || '#12161c'
                        }}
                      >
                        {isSongCover && (
                          <img 
                            src={albumArt} 
                            alt="Song Cover" 
                            className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none group-hover:opacity-70 transition-opacity" 
                          />
                        )}

                        {/* Top Row: Category/Duration Pill */}
                        <div className="relative z-10 flex items-center justify-between w-full">
                          <span className="text-[7px] font-bold text-[#f0f3f6] bg-[#0a0c0f]/80 px-1 py-0.5 rounded uppercase tracking-widest">
                            {bg.category || (bg.type === 'particles' ? 'Anim' : bg.type === 'waveform' ? 'Wave' : 'Grad')}
                          </span>
                          {bg.duration && (
                            <span className="text-[7px] font-mono text-[#7e8999] bg-[#0a0c0f]/80 px-1 py-0.5 rounded">
                              {bg.duration}
                            </span>
                          )}
                        </div>

                        {/* Bottom Title */}
                        <div className="relative z-10 mt-auto flex items-center justify-between w-full">
                          <span className="text-[8px] font-bold text-[#f0f3f6] uppercase tracking-wider truncate bg-[#0a0c0f]/70 px-1 py-0.5 rounded max-w-full">
                            {bg.name}
                          </span>
                        </div>

                        {/* Dark Vignette Overlay */}
                        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

                        {/* Active Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                            <Check size={9} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. ASPECT RATIO SECTION - ALL 6 RATIOS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <Film size={13} className="text-accent" />
                    <span>Aspect Ratio</span>
                  </label>
                  <span className="text-[10px] font-mono text-accent font-bold">
                    {aspectRatio}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1 bg-[#0e1115] p-1 rounded border border-[#232933]">
                  {(['16:9', '9:16', '1:1', '4:5', '3:4', '4:3'] as AspectRatio[]).map((ar) => {
                    const isSelected = aspectRatio === ar;
                    return (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => {
                          setAspectRatio(ar);
                          resetElementPositions(ar);
                        }}
                        className={cn(
                          "py-1.5 px-0.5 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center",
                          isSelected
                            ? "bg-[#181d26] text-accent border border-accent"
                            : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                        )}
                      >
                        <span className="text-[10px] font-mono whitespace-nowrap">{ar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. LYRIC ANIMATION STYLE SECTION */}
              <div className="space-y-2 pt-2 border-t border-[#232933]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <Sparkles size={13} className="text-accent" />
                    <span>Animation Style</span>
                  </label>
                  <span className="text-[10px] font-mono text-accent font-bold uppercase">
                    {animationStyle === 'karaoke' ? 'Karaoke' : 'Fade In/Out'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 bg-[#0e1115] p-1 rounded border border-[#232933]">
                  <button
                    type="button"
                    onClick={() => setAnimationStyle('karaoke')}
                    className={cn(
                      "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                      animationStyle === 'karaoke'
                        ? "bg-[#181d26] text-accent border border-accent"
                        : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">Karaoke</span>
                    <span className="text-[9px] text-[#7e8999]">Word Highlight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnimationStyle('fade')}
                    className={cn(
                      "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                      animationStyle === 'fade'
                        ? "bg-[#181d26] text-accent border border-accent"
                        : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">Fade In / Out</span>
                    <span className="text-[9px] text-[#7e8999]">Line Crossfade</span>
                  </button>
                </div>
              </div>

              {/* 5. STYLE & TYPOGRAPHY SECTION */}
              <div className="space-y-2.5 pt-2 border-t border-[#232933]">
                <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                  <Type size={13} className="text-accent" />
                  <span>Style & Typography</span>
                </label>

                {/* Font Family Selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#7e8999]">Font Family</span>
                    <span className="text-[10px] font-mono text-accent">{typographyOverride.fontFamily}</span>
                  </div>
                  <select
                    value={typographyOverride.fontFamily}
                    onChange={(e) => updateTypographyOverride({ fontFamily: e.target.value })}
                    className="w-full bg-[#0e1115] border border-[#232933] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] font-medium cursor-pointer outline-none hover:border-[#2b3442] focus:border-accent transition-colors"
                  >
                    {['Modern Sans', 'Display / Urban', 'Retro / Synth', 'Serif & Luxury', 'Bold Poster'].map(groupName => {
                      const groupFonts = CURATED_FONTS.filter(f => f.category === groupName);
                      if (groupFonts.length === 0) return null;
                      return (
                        <optgroup key={groupName} label={groupName} className="bg-[#12161c] text-[#7e8999] font-bold">
                          {groupFonts.map(f => (
                            <option key={f.family} value={f.family} className="bg-[#161b22] text-[#f0f3f6] font-normal">
                              {f.family} — {f.previewText}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* Visible Lines Selector */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#7e8999]">Lyrics Display Lines</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#0e1115] p-1 rounded border border-[#232933]">
                    {[1, 2, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setVisibleLineCount(count)}
                        className={cn(
                          "py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                          visibleLineCount === count
                            ? "bg-[#181d26] text-accent border border-accent"
                            : "text-[#7e8999] hover:text-[#f0f3f6]"
                        )}
                      >
                        {count} {count === 1 ? 'Line' : 'Lines'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color Swatches */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#7e8999]">Accent Color</span>
                    <span className="text-[10px] font-mono text-[#4a5568]">{activeColor}</span>
                  </div>
                  <div className="bg-[#0e1115] p-2 rounded border border-[#232933]">
                    <AppColorPicker
                      value={activeColor}
                      onChange={(c) => setVisualizerColor(c)}
                      boxShadow={`0 0 15px ${activeColor}30`}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* RIGHT CANVAS STAGE */}
        <div className="flex-1 min-w-0 bg-[#0a0c0f] flex flex-col relative overflow-hidden">
          <div className="flex-1 min-h-[320px] relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <MVPreview mode="lyrics-video" />
          </div>

          {/* BOTTOM VISUALIZER RANGE DISPLAY PLAYER */}
          <div className="bg-[#0e1115] border-t border-[#232933] px-3 sm:px-4 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 z-30 min-h-[56px]">
            
            {/* Transport & Playlist Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Song List Dropdown / Popup */}
              <SongListPopover align="left" />

              <div className="h-5 w-[1px] bg-[#232933] mx-1" />

              {/* Previous Track Button */}
              <button
                type="button"
                onClick={previousTrack}
                className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                title="Previous Track"
              >
                <SkipBack size={15} />
              </button>

              {/* Circular Play / Pause Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Next Track Button */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                title="Next Track"
              >
                <SkipForward size={15} />
              </button>

              {/* Looping / Repeat Button */}
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                className={cn(
                  "p-1.5 rounded transition-colors cursor-pointer shrink-0 relative",
                  isLooping
                    ? "bg-[#181d26] border border-accent text-accent"
                    : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]"
                )}
                title={isLooping ? "Disable Loop" : "Enable Loop (Repeat Current Song)"}
              >
                <Repeat size={14} />
                {isLooping && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 text-[#0a0c0f] text-[8px] font-bold rounded-full bg-accent flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Standardized Scrubber / Seek Bar */}
            <div className="flex-1 min-w-[160px] flex items-center gap-3">
              <div className="flex-1 flex items-center">
                <VideoSlider
                  value={currentTime}
                  min={0}
                  max={audioDuration || 100}
                  step={0.01}
                  onChange={handleSeek}
                  formatTooltip={formatTime}
                  className="w-full"
                />
              </div>

              {/* Time & Duration */}
              <div className="text-[10px] sm:text-[11px] font-mono font-medium text-[#7e8999] tracking-wider shrink-0 min-w-[80px] text-right">
                <span className="text-[#c4cad4] font-bold">{formatTime(currentTime)}</span> / {formatTime(audioDuration)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
