import React, { useState } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { Type, Palette, Layout, ShieldCheck, Eye, Check, Sparkles, Globe, Clock } from 'lucide-react';
import { CURATED_FONTS } from '../../lib/curatedFonts';

export function TypographyPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const lyricsPos = useStore(s => s.lyricsSettings.position || 'bottom');
  const updateMainLyricsSettings = useStore(s => s.updateLyricsSettings);

  const typo = useLyricsVideoStore(s => s.typographyOverride);
  const updateTypo = useLyricsVideoStore(s => s.updateTypographyOverride);
  const showSafeArea = useLyricsVideoStore(s => s.showSafeArea);
  const setShowSafeArea = useLyricsVideoStore(s => s.setShowSafeArea);
  const visibleLineCount = useLyricsVideoStore(s => s.visibleLineCount);
  const setVisibleLineCount = useLyricsVideoStore(s => s.setVisibleLineCount);
  const animationStyle = useLyricsVideoStore(s => s.animationStyle);
  const setAnimationStyle = useLyricsVideoStore(s => s.setAnimationStyle);
  const fadeInDuration = useLyricsVideoStore(s => s.fadeInDuration ?? 0.4);
  const fadeOutDuration = useLyricsVideoStore(s => s.fadeOutDuration ?? 0.4);
  const fadeEasing = useLyricsVideoStore(s => s.fadeEasing ?? 'smooth');
  const setFadeDurations = useLyricsVideoStore(s => s.setFadeDurations);
  const bilingualEnabled = useLyricsVideoStore(s => s.bilingualEnabled ?? false);
  const setBilingualEnabled = useLyricsVideoStore(s => s.setBilingualEnabled);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const aspectRatios: { id: AspectRatio; label: string; tag: string }[] = [
    { id: '16:9', label: '16:9', tag: 'Landscape' },
    { id: '9:16', label: '9:16', tag: 'Vertical' },
    { id: '1:1', label: '1:1', tag: 'Square' },
    { id: '3:4', label: '3:4', tag: 'Portrait' },
    { id: '4:3', label: '4:3', tag: 'Classic' }
  ];

  const categories = ['All', 'Modern Sans', 'Display / Urban', 'Retro / Synth', 'Serif & Luxury'];

  const filteredFonts = selectedCategory === 'All'
    ? CURATED_FONTS
    : CURATED_FONTS.filter(f => f.category === selectedCategory);

  const applyCinematicElegantPreset = () => {
    setSelectedTemplateId('cinematic-clean');
    updateTypo({
      fontFamily: 'Outfit',
      fontWeight: '600',
      fontSizeScale: 1.0,
      textColor: '#ffffff',
      showContainerPill: false
    });
    setAnimationStyle('fade');
    setVisibleLineCount(1);
    setFadeDurations(0.4, 0.4, 'smooth');
    updateMainLyricsSettings({
      position: 'center',
      showBackgroundBox: false,
      animationStyle: 'fade'
    });
  };

  const applyModernKaraokePreset = () => {
    setSelectedTemplateId('vinyl');
    updateTypo({
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSizeScale: 1.05,
      textColor: '#ffffff',
      activeWordColor: '#fef08a',
      glowColor: '#eab308',
      showContainerPill: true
    });
    setAnimationStyle('karaoke');
    setVisibleLineCount(2);
    updateMainLyricsSettings({
      position: 'bottom',
      showBackgroundBox: true,
      animationStyle: 'karaoke'
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0e1115] text-[#f0f3f6] p-3.5 gap-4 overflow-y-auto">

      {/* Typography Presets */}
      <div className="bg-[#12161c] border border-[#232933] rounded-xl p-3 flex flex-col gap-2.5">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Sparkles size={12} className="text-accent" />
          Quick Typography Presets
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={applyCinematicElegantPreset}
            className="p-2.5 rounded-lg border border-accent/40 bg-[#161b22] hover:bg-[#1f2632] hover:border-accent text-left transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.12)] group"
          >
            <div className="text-xs font-mono font-bold text-accent flex items-center justify-between">
              <span>Cinematic Clean</span>
              <Check size={12} />
            </div>
            <div className="text-[9px] text-[#7e8999] font-sans mt-0.5">Smooth Fade · No Pill · White Text</div>
          </button>

          <button
            type="button"
            onClick={applyModernKaraokePreset}
            className="p-2.5 rounded-lg border border-[#232933] bg-[#12161c] hover:bg-[#161b22] hover:border-[#384252] text-left transition-all cursor-pointer group"
          >
            <div className="text-xs font-mono font-bold text-[#f0f3f6]">Modern Karaoke</div>
            <div className="text-[9px] text-[#7e8999] font-sans mt-0.5">Active Glow · Liquid Sweep · 2 Lines</div>
          </button>
        </div>
      </div>

      {/* Animation Style & Fade Controls */}
      <div className="bg-[#12161c] border border-[#232933] rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
            <Clock size={12} className="text-accent" />
            Lyric Animation & Transitions
          </span>
          <span className="text-[9px] font-mono text-accent font-bold uppercase">
            {animationStyle === 'fade' ? 'Fade In/Out' : 'Karaoke Highlight'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAnimationStyle('fade')}
            className={`py-2 px-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer text-center ${
              animationStyle === 'fade'
                ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
            }`}
          >
            Smooth Fade
          </button>

          <button
            type="button"
            onClick={() => setAnimationStyle('karaoke')}
            className={`py-2 px-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer text-center ${
              animationStyle === 'karaoke'
                ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
            }`}
          >
            Karaoke Highlight
          </button>
        </div>

        {/* Fade In & Out Timing Controls */}
        {animationStyle === 'fade' && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#232933]">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#7e8999]">
              <span>Fade In Duration: <strong className="text-accent">{fadeInDuration.toFixed(1)}s</strong></span>
              <span>Fade Out: <strong className="text-accent">{fadeOutDuration.toFixed(1)}s</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.1}
                value={fadeInDuration}
                onChange={(e) => setFadeDurations(Number(e.target.value), fadeOutDuration, fadeEasing)}
                className="w-full accent-accent h-1.5 bg-[#0a0c0f] rounded-lg cursor-pointer"
              />
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.1}
                value={fadeOutDuration}
                onChange={(e) => setFadeDurations(fadeInDuration, Number(e.target.value), fadeEasing)}
                className="w-full accent-accent h-1.5 bg-[#0a0c0f] rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-mono text-[#7e8999]">Fade Easing:</span>
              <div className="flex gap-1">
                {(['smooth', 'linear', 'ease'] as const).map(curve => (
                  <button
                    key={curve}
                    type="button"
                    onClick={() => setFadeDurations(fadeInDuration, fadeOutDuration, curve)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase cursor-pointer border ${
                      fadeEasing === curve
                        ? 'bg-accent/20 border-accent text-accent font-bold'
                        : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999]'
                    }`}
                  >
                    {curve}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bilingual Subtitle Presentation Toggle */}
      <div className="bg-[#12161c] border border-[#232933] rounded-xl p-3 flex flex-col gap-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-[#f0f3f6] flex items-center gap-2">
            <Globe size={14} className="text-accent" />
            Bilingual Lyrics (Translation Subtitle)
          </span>
          <input
            type="checkbox"
            checked={bilingualEnabled}
            onChange={(e) => setBilingualEnabled(e.target.checked)}
            className="w-4 h-4 accent-accent rounded cursor-pointer"
          />
        </label>
        <p className="text-[10px] text-[#7e8999] font-sans leading-normal">
          Renders a secondary translation line below each lyric line (as seen in the reference video).
        </p>
      </div>
      
      {/* Extended Aspect Ratio Picker */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Layout size={12} className="text-accent" />
          Canvas Aspect Ratio
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {aspectRatios.map(ar => {
            const isSelected = aspectRatio === ar.id;
            return (
              <button
                key={ar.id}
                onClick={() => setAspectRatio(ar.id)}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#161b22] border-accent/60 text-[#f0f3f6] shadow-[0_0_10px_rgba(0,230,118,0.12)]'
                    : 'bg-[#12161c] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#161b22] hover:border-[#2e3746]'
                }`}
              >
                <div className="text-[11px] font-mono font-bold">{ar.label}</div>
                <div className="text-[9px] font-mono text-[#7e8999]">{ar.tag}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lyrics Display Lines (Default: 2 lines) */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
            <Type size={12} className="text-accent" />
            Lyrics Display Lines
          </span>
          <span className="text-[9px] font-mono text-accent font-semibold">
            {visibleLineCount} {visibleLineCount === 1 ? 'Line' : 'Lines'} {visibleLineCount === 2 ? '(Default)' : ''}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((count) => {
            const isSelected = visibleLineCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => setVisibleLineCount(count)}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${
                  isSelected
                    ? 'bg-[#161b22] border-accent/60 text-accent shadow-[0_0_10px_rgba(0,230,118,0.12)] font-bold'
                    : 'bg-[#12161c] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#161b22] hover:border-[#2e3746]'
                }`}
              >
                <div className="text-xs">{count} {count === 1 ? 'Line' : 'Lines'}</div>
                {count === 2 && <div className="text-[8px] text-accent/80 font-sans">Default</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Family Picker */}
      <div className="flex flex-col gap-2.5 pt-3 border-t border-[#232933]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
            <Type size={12} className="text-accent" />
            Curated Font Families
          </span>
          <span className="text-[9px] font-mono text-accent font-semibold">
            {typo.fontFamily || 'Outfit'}
          </span>
        </div>

        {/* Genre / Style Category Filter Chips */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-[#1e2530] text-accent border-accent/60 font-semibold'
                  : 'bg-[#12161c] text-[#7e8999] border-[#232933] hover:text-[#f0f3f6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Font Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1 select-none">
          {filteredFonts.map(fontItem => {
            const isSelected = typo.fontFamily === fontItem.family;
            return (
              <button
                key={fontItem.family}
                onClick={() => updateTypo({ fontFamily: fontItem.family })}
                className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group ${
                  isSelected
                    ? 'bg-[#161b22] border-accent/60 text-[#f0f3f6] shadow-[0_0_10px_rgba(0,230,118,0.15)] ring-1 ring-accent/30'
                    : 'bg-[#12161c] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#161b22] hover:border-[#2e3746]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono text-[#7e8999] uppercase tracking-wider">{fontItem.category}</span>
                  {isSelected && <Check size={12} className="text-accent" />}
                </div>

                {/* Live Font Sample */}
                <div 
                  className="text-base leading-tight font-bold text-[#f0f3f6] group-hover:text-accent transition-colors"
                  style={{ fontFamily: fontItem.family }}
                >
                  {fontItem.family}
                </div>

                <div className="text-[9px] text-[#5e6877] truncate">
                  {fontItem.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Customization */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
          <Palette size={12} className="text-accent" />
          Color & Glow Palette
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Active Word Highlight Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[#7e8999]">Active Word</span>
            <div className="flex items-center gap-2 bg-[#12161c] border border-[#232933] p-1.5 rounded-lg">
              <input
                type="color"
                value={typo.activeWordColor || '#fde047'}
                onChange={(e) => updateTypo({ activeWordColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="text-[10px] font-mono font-semibold text-[#f0f3f6] uppercase">{typo.activeWordColor}</span>
            </div>
          </div>

          {/* Active Word Glow Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[#7e8999]">Glow Accent</span>
            <div className="flex items-center gap-2 bg-[#12161c] border border-[#232933] p-1.5 rounded-lg">
              <input
                type="color"
                value={typo.glowColor && typo.glowColor !== 'transparent' ? typo.glowColor : '#eab308'}
                onChange={(e) => updateTypo({ glowColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="text-[10px] font-mono font-semibold text-[#f0f3f6] uppercase">{typo.glowColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Container Pill & Safe Area Overlays */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#232933]">
        <label className="flex items-center justify-between bg-[#12161c] border border-[#232933] p-2.5 rounded-lg cursor-pointer hover:border-[#2e3746] transition-colors">
          <span className="text-xs font-medium text-[#f0f3f6] flex items-center gap-2">
            <Eye size={14} className="text-accent" />
            Background Pill Backdrop
          </span>
          <input
            type="checkbox"
            checked={typo.showContainerPill}
            onChange={(e) => updateTypo({ showContainerPill: e.target.checked })}
            className="w-4 h-4 accent-accent rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between bg-[#12161c] border border-[#232933] p-2.5 rounded-lg cursor-pointer hover:border-[#2e3746] transition-colors">
          <span className="text-xs font-medium text-[#f0f3f6] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            Safe Area Guide Lines
          </span>
          <input
            type="checkbox"
            checked={showSafeArea}
            onChange={(e) => setShowSafeArea(e.target.checked)}
            className="w-4 h-4 accent-accent rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
