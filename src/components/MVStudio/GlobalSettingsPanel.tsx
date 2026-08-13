import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseLRC, cn } from '../../lib/utils';
import { Scrubber } from '../ui/scrubber';
import { AppColorPicker } from '../ui/color-picker';
import { animate, stagger } from 'animejs';

import { ArtworkPanel } from '../LyricsStudio/ArtworkPanel';
import { BackgroundCarousel } from '../LyricsStudio/BackgroundCarousel';
import { TemplateCarousel } from '../LyricsStudio/TemplateCarousel';
import { TypographyPanel } from '../LyricsStudio/TypographyPanel';

function VisualizerSettingsPanel() {
  const settings = useStore(s => s.visualizerSettings);
  const updateSettings = useStore(s => s.updateVisualizerSettings);
  const activeColor = settings.color || '#00e676';

  const COLOR_THEMES = [
    { label: 'Toxic', color: '#00e676' },
    { label: 'Cyber', color: '#00e5ff' },
    { label: 'Blood', color: '#ff003c' },
    { label: 'Phonk', color: '#bd5eff' }, 
    { label: 'Gold', color: '#ffd700' },
    { label: 'Ghost', color: '#ffffff' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Visualizer Style</label>
        <Select value={settings.style} onValueChange={v => updateSettings({ style: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="bars">Classic Bars</SelectItem>
            <SelectItem value="waveform">Waveform</SelectItem>
            <SelectItem value="radial">Radial Circle</SelectItem>
            <SelectItem value="particles">Particles</SelectItem>
            <SelectItem value="kaleidoscope">Kaleidoscope</SelectItem>
            <SelectItem value="orb">Energy Orb</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Primary Color Theme</label>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_THEMES.map(theme => (
            <button
              key={theme.color}
              onClick={() => updateSettings({ color: theme.color })}
              className={cn(
                "h-8 rounded-md border flex items-center justify-center transition-all",
                settings.color === theme.color ? "border-white scale-105 shadow-lg z-10" : "border-white/10 hover:border-white/30 hover:scale-105 opacity-60 hover:opacity-100"
              )}
              style={settings.color === theme.color ? { backgroundColor: theme.color, boxShadow: `0 0 15px ${theme.color}40` } : { backgroundColor: `${theme.color}40` }}
            >
              {settings.color === theme.color && <div className="w-2 h-2 rounded-full bg-black/60 shadow-sm" />}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <AppColorPicker value={settings.color} onChange={(c) => updateSettings({ color: c })} />
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Reactivity Sensitivity</label>
          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor }}>{settings.sensitivity.toFixed(2)}</span>
        </div>
        <Scrubber
          min={0.1} max={2.0} step={0.1}
          value={settings.sensitivity}
          onChange={val => updateSettings({ sensitivity: val })}
        />
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Reactivity (Smoothing)</label>
          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor }}>{settings.smoothing.toFixed(2)}</span>
        </div>
        <Scrubber
          min={0.1} max={0.99} step={0.01}
          value={settings.smoothing}
          onChange={val => updateSettings({ smoothing: val })}
        />
      </div>
    </div>
  );
}

function LyricsSettingsPanel() {
  const settings = useStore(s => s.lyricsSettings);
  const updateSettings = useStore(s => s.updateLyricsSettings);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const [activeSubTab, setActiveSubTab] = useState<'template' | 'artwork' | 'typography' | 'lrc'>('template');
  const [rawText, setRawText] = useState(settings.lines.map(l => l.text).join('\n'));

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRawText(newText);
    if (/\[\d{2}:\d{2}\.\d{2,3}\]/.test(newText)) {
      const parsed = parseLRC(newText);
      updateSettings({ lines: parsed });
    }
  };

  const bgColor = settings.backgroundColor || 'transparent';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-white/[0.02] rounded-md border border-white/10 overflow-x-auto no-scrollbar">
        {[
          { id: 'template', label: 'Templates' },
          { id: 'artwork', label: 'Artwork' },
          { id: 'typography', label: 'Type' },
          { id: 'lrc', label: 'LRC Data' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex-1 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeSubTab === tab.id 
                ? "bg-white/20 text-white shadow" 
                : "text-slate-400 hover:text-white hover:bg-white/10"
            )}
            style={activeSubTab === tab.id ? { color: activeColor } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeSubTab === 'template' && (
          <div className="h-[400px] overflow-y-auto pr-1 pb-4">
            <TemplateCarousel />
          </div>
        )}
        
        {activeSubTab === 'artwork' && (
          <div className="h-[400px] overflow-y-auto pr-1 pb-4">
            <ArtworkPanel />
          </div>
        )}
        
        {activeSubTab === 'typography' && (
          <div className="h-[400px] overflow-y-auto pr-1 pb-4">
            <TypographyPanel />
          </div>
        )}

        {activeSubTab === 'lrc' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Lyric Script (LRC Format)</label>
              
              <textarea 
                value={rawText}
                onChange={handleTextChange}
                placeholder="[00:03.00] Paste your LRC lyrics here..."
                className="w-full h-40 bg-white/[0.02] border border-white/10 text-white rounded-md p-3 text-[11px] font-mono outline-none resize-none focus:border-white/20 transition-glass leading-normal"
              />
            </div>
            
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Animation Preset</label>
              <Select value={settings.animationStyle} onValueChange={v => updateSettings({ animationStyle: v as any })}>
                <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
                  <SelectItem value="fade">Classic Fade In/Out</SelectItem>
                  <SelectItem value="karaoke">Smooth Karaoke Highlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Text Accent Color</label>
              <AppColorPicker 
                value={settings.color}
                onChange={val => updateSettings({ color: val })}
                boxShadow={`0 0 15px ${settings.color}30`}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Lyrics Background Color</label>
              <div className="space-y-2.5">
                <AppColorPicker 
                  value={bgColor === 'transparent' ? '#000000' : bgColor}
                  onChange={val => updateSettings({ backgroundColor: val })}
                  boxShadow={bgColor !== 'transparent' ? `0 0 15px ${bgColor}30` : undefined}
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    onClick={() => updateSettings({ backgroundColor: 'transparent' })}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer",
                      bgColor === 'transparent' ? "bg-white/20 border-white/40 text-white font-bold" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    None (Transparent)
                  </button>
                  <button
                    onClick={() => updateSettings({ backgroundColor: 'rgba(0, 0, 0, 0.6)' })}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer",
                      bgColor === 'rgba(0, 0, 0, 0.6)' ? "bg-white/20 border-white/40 text-white font-bold" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    Dark Glass
                  </button>
                  <button
                    onClick={() => updateSettings({ backgroundColor: '#000000' })}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer",
                      bgColor === '#000000' ? "bg-white/20 border-white/40 text-white font-bold" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    Solid Black
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BackgroundSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Background Customization</label>
        <div className="h-[400px] overflow-y-auto pr-1 pb-4">
          <BackgroundCarousel />
        </div>
      </div>
    </div>
  );
}

function LogoSettingsPanel() {
  const settings = useStore(s => s.logoSettings);
  const updateSettings = useStore(s => s.updateLogoSettings);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Branding Watermark</label>
        <input 
          type="file" 
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              const url = URL.createObjectURL(file);
              updateSettings({ image: url });
            }
          }}
          className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer transition-glass"
        />
        {settings.image && (
          <button 
            onClick={() => updateSettings({ image: null })}
            className="mt-3 text-[9px] font-bold uppercase tracking-widest text-[#ff0055] hover:text-[#ff0055]/80 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={11} />
            <span>Remove Watermark</span>
          </button>
        )}
      </div>
      
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Placement Corner</label>
        <Select value={settings.position} onValueChange={v => updateSettings({ position: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="top-left">Top-Left Corner</SelectItem>
            <SelectItem value="top-right">Top-Right Corner</SelectItem>
            <SelectItem value="bottom-left">Bottom-Left Corner</SelectItem>
            <SelectItem value="bottom-right">Bottom-Right Corner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Dimension Scale</label>
          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{(settings.size * 100).toFixed(0)}%</span>
        </div>
        <Scrubber
          min={0.05}
          max={0.4}
          step={0.01}
          value={settings.size}
          onChange={val => updateSettings({ size: val })}
          formatTooltip={val => `${(val * 100).toFixed(0)}%`}
        />
      </div>
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Alpha Opacity</label>
          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{(settings.opacity * 100).toFixed(0)}%</span>
        </div>
        <Scrubber
          min={0.1}
          max={1.0}
          step={0.05}
          value={settings.opacity}
          onChange={val => updateSettings({ opacity: val })}
          formatTooltip={val => `${(val * 100).toFixed(0)}%`}
        />
      </div>
    </div>
  );
}

export function GlobalSettingsPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const [activeTab, setActiveTab] = useState<'visualizer' | 'lyrics' | 'background' | 'logo'>('visualizer');

  useEffect(() => {
    animate('.settings-panel-anim > *', {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(40, { start: 20 }),
      duration: 400,
      easing: 'easeOutQuart'
    });
  }, [activeTab]);

  return (
    <div className="w-full h-full bg-[#060608] flex flex-col relative overflow-hidden">
      {/* Internal Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'visualizer', label: 'Visualizer' },
          { id: 'lyrics', label: 'Vinyl/Lyrics' },
          { id: 'background', label: 'Background' },
          { id: 'logo', label: 'Watermark' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white/10 text-white" 
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            )}
            style={activeTab === tab.id ? { borderBottom: `2px solid ${activeColor}` } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="settings-panel-anim space-y-6">
          {activeTab === 'visualizer' && <VisualizerSettingsPanel />}
          {activeTab === 'lyrics' && <LyricsSettingsPanel />}
          {activeTab === 'background' && <BackgroundSettingsPanel />}
          {activeTab === 'logo' && <LogoSettingsPanel />}
        </div>
      </div>
    </div>
  );
}
