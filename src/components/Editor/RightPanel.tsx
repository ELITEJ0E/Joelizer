import React, { useState, useEffect, useRef } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { Play, Upload, Clock, Plus, Minus, Trash2, Eye, EyeOff, Film, AlignLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseLRC } from '../../lib/utils';
import { Scrubber } from '../ui/scrubber';

function VisualizerSettingsPanel() {
  const settings = useStore(s => s.visualizerSettings);
  const updateSettings = useStore(s => s.updateVisualizerSettings);
  const resetSettings = useStore(s => s.resetVisualizerSettings);
  const activeColor = settings.color || '#00e676';

  const COLOR_THEMES = [
    { label: 'Toxic', color: '#00e676' },
    { label: 'Cyber', color: '#00e5ff' },
    { label: 'Blood', color: '#ff003c' },
    { label: 'Phonk', color: '#bd5eff' }, // Magenta/Purple
    { label: 'Sun', color: '#ff9e00' },
    { label: 'White', color: '#ffffff' },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Visualizer Style</label>
        <button
          onClick={resetSettings}
          className="text-[9px] uppercase font-bold tracking-widest text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded"
        >
          Reset Default
        </button>
      </div>
      <div className="-mt-4">
        <Select value={settings.style} onValueChange={v => updateSettings({ style: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="bars">Bars</SelectItem>
            <SelectItem value="waveform">Waveform</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
            <SelectItem value="particles">Particles</SelectItem>
            <SelectItem value="kaleidoscope">Kaleidoscope</SelectItem>
            <SelectItem value="orb">Sci-Fi Glowing Orb</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {settings.style === 'kaleidoscope' && (
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Mirror Segments</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{settings.segments || 8} segments</span>
          </div>
          <Scrubber
            min={4} max={18} step={2}
            value={settings.segments || 8}
            onChange={val => updateSettings({ segments: val })}
            formatTooltip={val => `${val}`}
          />
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Neon Accent Color</label>
        <div className="flex gap-2 mb-3">
          <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer shadow-sm hover:border-white/30 transition-glass"
               style={{ boxShadow: `0 0 15px ${activeColor}30` }}>
            <input 
              type="color" 
              value={settings.color}
              onChange={e => updateSettings({ color: e.target.value })}
              className="absolute -inset-1 w-[150%] h-[150%] cursor-pointer p-0 border-0 bg-transparent"
            />
          </div>
          <input 
            type="text"
            value={settings.color}
            onChange={e => updateSettings({ color: e.target.value })}
            className="flex-1 bg-white/[0.02] border border-white/10 text-white rounded px-3 text-xs font-mono tabular-nums outline-none focus:border-white/20 transition-glass uppercase tracking-wider font-bold"
          />
        </div>
        <div className="grid grid-cols-6 gap-2">
          {COLOR_THEMES.map(theme => (
            <button
              key={theme.label}
              onClick={() => updateSettings({ color: theme.color })}
              className="h-6 rounded border border-white/10 transition-glass hover:scale-110 active:scale-95"
              style={{ 
                backgroundColor: theme.color,
                boxShadow: settings.color === theme.color ? `0 0 15px ${theme.color}60` : 'none',
                borderColor: settings.color === theme.color ? '#ffffff' : 'rgba(255,255,255,0.1)'
              }}
              title={theme.label}
            />
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-5">
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Hit Response</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{(settings.hitResponse * 100).toFixed(0)}%</span>
          </div>
          <Scrubber
            min={0} max={2.0} step={0.05}
            value={settings.hitResponse}
            onChange={val => updateSettings({ hitResponse: val })}
            formatTooltip={val => `${(val * 100).toFixed(0)}%`}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Glitch Intensity</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{(settings.glitchIntensity * 100).toFixed(0)}%</span>
          </div>
          <Scrubber
            min={0} max={1.0} step={0.05}
            value={settings.glitchIntensity}
            onChange={val => updateSettings({ glitchIntensity: val })}
            formatTooltip={val => `${(val * 100).toFixed(0)}%`}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Camera Shake</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{(settings.shakeIntensity * 100).toFixed(0)}%</span>
          </div>
          <Scrubber
            min={0} max={1.0} step={0.05}
            value={settings.shakeIntensity}
            onChange={val => updateSettings({ shakeIntensity: val })}
            formatTooltip={val => `${(val * 100).toFixed(0)}%`}
          />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={settings.showGrain}
              onChange={e => updateSettings({ showGrain: e.target.checked })}
              className="accent-[#00e676] w-4 h-4 cursor-pointer"
              style={{ accentColor: activeColor }}
            />
            <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest group-hover:text-white transition-colors">Film Grain</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={settings.showScanlines}
              onChange={e => updateSettings({ showScanlines: e.target.checked })}
              className="accent-[#00e676] w-4 h-4 cursor-pointer"
              style={{ accentColor: activeColor }}
            />
            <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest group-hover:text-white transition-colors">Scanlines</span>
          </label>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-5">
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Sensitivity</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{settings.sensitivity.toFixed(2)}x</span>
          </div>
          <Scrubber
            min={0.1}
            max={2.0}
            step={0.05}
            value={settings.sensitivity}
            onChange={val => updateSettings({ sensitivity: val })}
            formatTooltip={val => `${val.toFixed(2)}x`}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Temporal Smoothing</label>
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>{settings.smoothing.toFixed(2)}</span>
          </div>
          <Scrubber
            min={0.1}
            max={0.99}
            step={0.01}
            value={settings.smoothing}
            onChange={val => updateSettings({ smoothing: val })}
            formatTooltip={val => val.toFixed(2)}
          />
        </div>
      </div>
    </div>
  );
}

function BackgroundSettingsPanel() {
  const settings = useStore(s => s.backgroundSettings);
  const updateSettings = useStore(s => s.updateBackgroundSettings);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Background Type</label>
        <Select value={settings.type} onValueChange={v => updateSettings({ type: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="color">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient Fill</SelectItem>
            <SelectItem value="image">Still Image</SelectItem>
            <SelectItem value="video">Reactive Video</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {settings.type === 'color' && (
        <div>
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Hex Code</label>
          <div className="flex gap-2">
            <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer shadow-sm">
              <input 
                type="color" 
                value={settings.value}
                onChange={e => updateSettings({ value: e.target.value })}
                className="absolute -inset-1 w-[150%] h-[150%] cursor-pointer p-0 border-0 bg-transparent"
              />
            </div>
            <input 
              type="text" 
              value={settings.value}
              onChange={e => updateSettings({ value: e.target.value })}
              className="flex-1 bg-white/[0.02] border border-white/10 text-white rounded px-3 text-xs font-mono tabular-nums outline-none focus:border-white/20 transition-glass uppercase tracking-wider font-bold"
            />
          </div>
        </div>
      )}
      
      {settings.type === 'gradient' && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Color 1</label>
            <div className="flex gap-2">
              <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer shadow-sm">
                <input 
                  type="color" 
                  value={settings.value.split(',')[0]?.trim() || '#0c0c14'}
                  onChange={e => {
                    const c2 = settings.value.split(',')[1]?.trim() || '#030308';
                    updateSettings({ value: `${e.target.value}, ${c2}` })
                  }}
                  className="absolute -inset-1 w-[150%] h-[150%] cursor-pointer p-0 border-0 bg-transparent"
                />
              </div>
              <input 
                type="text" 
                value={settings.value.split(',')[0]?.trim() || '#0c0c14'}
                onChange={e => {
                    const c2 = settings.value.split(',')[1]?.trim() || '#030308';
                    updateSettings({ value: `${e.target.value}, ${c2}` })
                }}
                className="flex-1 bg-white/[0.02] border border-white/10 text-white rounded px-3 text-xs font-mono tabular-nums outline-none focus:border-white/20 transition-glass uppercase tracking-wider font-bold"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Color 2</label>
            <div className="flex gap-2">
              <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer shadow-sm">
                <input 
                  type="color" 
                  value={settings.value.split(',')[1]?.trim() || '#030308'}
                  onChange={e => {
                    const c1 = settings.value.split(',')[0]?.trim() || '#0c0c14';
                    updateSettings({ value: `${c1}, ${e.target.value}` })
                  }}
                  className="absolute -inset-1 w-[150%] h-[150%] cursor-pointer p-0 border-0 bg-transparent"
                />
              </div>
              <input 
                type="text" 
                value={settings.value.split(',')[1]?.trim() || '#030308'}
                onChange={e => {
                    const c1 = settings.value.split(',')[0]?.trim() || '#0c0c14';
                    updateSettings({ value: `${c1}, ${e.target.value}` })
                }}
                className="flex-1 bg-white/[0.02] border border-white/10 text-white rounded px-3 text-xs font-mono tabular-nums outline-none focus:border-white/20 transition-glass uppercase tracking-wider font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {settings.type === 'image' && (
        <div>
          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Upload Still Image</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                updateSettings({ value: url });
              }
            }}
            className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer transition-glass"
          />
        </div>
      )}

      {settings.type === 'video' && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Upload Video Asset</label>
            <input 
              type="file" 
              accept="video/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  updateSettings({ value: url });
                }
              }}
              className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:tracking-widest file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer transition-glass"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-2 block">Screen Scale Mode</label>
            <Select value={settings.fit || 'cover'} onValueChange={v => updateSettings({ fit: v as any })}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="cover">Scale to Fill (Zoom Crop)</SelectItem>
                <SelectItem value="contain">Show Whole Video (Letterbox)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mt-5 p-3.5 bg-white/[0.02] rounded-lg border border-white/5 group hover:border-white/10 transition-glass">
        <input 
          type="checkbox" 
          id="blurAlbum"
          checked={settings.blurAlbumArt}
          onChange={e => updateSettings({ blurAlbumArt: e.target.checked })}
          className="w-4 h-4 rounded bg-[#0d0d0d] border-white/10 cursor-pointer"
          style={{ accentColor: activeColor }}
        />
        <label htmlFor="blurAlbum" className="text-[9px] font-bold text-slate-300 uppercase tracking-widest cursor-pointer select-none group-hover:text-white transition-colors">Blur Album Art Cover</label>
      </div>
    </div>
  );
}

function LyricsSettingsPanel() {
  const settings = useStore(s => s.lyricsSettings);
  const updateSettings = useStore(s => s.updateLyricsSettings);
  const currentTime = useStore(s => s.currentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const [rawText, setRawText] = useState(settings.lines.map(l => l.text).join('\n'));

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRawText(newText);
    
    // Auto-parse LRC format if detected
    if (/\[\d{2}:\d{2}\.\d{2,3}\]/.test(newText)) {
      const parsed = parseLRC(newText);
      updateSettings({ lines: parsed });
    }
  };

  const nudgeLineStart = (index: number, amount: number) => {
    const updated = [...settings.lines];
    updated[index].startTime = Math.max(0, updated[index].startTime + amount);
    if (index > 0) {
      updated[index - 1].endTime = updated[index].startTime;
    }
    updateSettings({ lines: updated });
  };

  const nudgeLineEnd = (index: number, amount: number) => {
    const updated = [...settings.lines];
    updated[index].endTime = Math.max(updated[index].startTime, updated[index].endTime + amount);
    if (index < updated.length - 1) {
      updated[index + 1].startTime = updated[index].endTime;
    }
    updateSettings({ lines: updated });
  };

  const removeLine = (index: number) => {
    const updated = settings.lines.filter((_, i) => i !== index);
    updateSettings({ lines: updated });
    setRawText(updated.map(l => l.text).join('\n'));
  };

  return (
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
            <div className="flex gap-2">
              <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer shadow-sm hover:border-white/30 transition-glass"
                   style={{ boxShadow: `0 0 15px ${settings.color}30` }}>
                <input 
                  type="color" 
                  value={settings.color}
                  onChange={e => updateSettings({ color: e.target.value })}
                  className="absolute -inset-1 w-[150%] h-[150%] cursor-pointer p-0 border-0 bg-transparent"
                />
              </div>
              <input 
                type="text"
                value={settings.color}
                onChange={e => updateSettings({ color: e.target.value })}
                className="flex-1 bg-white/[0.02] border border-white/10 text-white rounded px-3 text-xs font-mono tabular-nums outline-none focus:border-white/20 transition-glass uppercase tracking-wider font-bold"
              />
            </div>
          </div>

          {/* Sync timeline list */}
          {settings.lines.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                <AlignLeft size={11} className="text-slate-400" />
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Interactive Sync Timeline</label>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {settings.lines.map((line, idx) => (
                  <div 
                    key={line.id}
                    className={`p-2.5 rounded border text-[10px] flex items-center justify-between gap-2.5 transition-glass bg-white/[0.02] border-white/5 hover:border-white/10`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold truncate leading-none">{line.text}</p>
                      <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-wider tabular-nums">
                        SPAN: {line.startTime.toFixed(1)}s - {line.endTime.toFixed(1)}s
                      </p>
                    </div>

                    {/* Precision adjust trigger */}
                    <div className="flex items-center gap-1.5">
                      {/* Start adjust */}
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">START</span>
                        <div className="flex items-center bg-black/40 rounded border border-white/10 p-0.5 transition-colors hover:border-white/20">
                          <button onClick={() => nudgeLineStart(idx, -0.1)} className="p-0.5 text-slate-400 hover:text-white transition-colors">
                            <Minus size={9} />
                          </button>
                          <button onClick={() => nudgeLineStart(idx, 0.1)} className="p-0.5 text-slate-400 transition-colors" style={{ color: activeColor }}>
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>

                      {/* End adjust */}
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">END</span>
                        <div className="flex items-center bg-black/40 rounded border border-white/10 p-0.5 transition-colors hover:border-white/20">
                          <button onClick={() => nudgeLineEnd(idx, -0.1)} className="p-0.5 text-slate-400 hover:text-white transition-colors">
                            <Minus size={9} />
                          </button>
                          <button onClick={() => nudgeLineEnd(idx, 0.1)} className="p-0.5 text-slate-400 transition-colors" style={{ color: activeColor }}>
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => removeLine(idx)}
                        className="p-1 text-slate-500 hover:text-red-500 rounded hover:bg-white/10 transition-colors ml-1"
                        title="Remove segment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

export function RightPanel() {
  const selectedLayerId = useStore(s => s.selectedLayerId);
  const layers = useStore(s => s.layers);
  const updateLayerVisibility = useStore(s => s.updateLayerVisibility);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const layer = layers.find(l => l.id === selectedLayerId);

  if (!layer) {
    return (
      <div className="w-full h-full bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col items-center justify-center text-slate-500 text-[10px] font-bold uppercase tracking-[2px] text-center leading-relaxed">
        <Film size={24} className="text-slate-600 mb-4 opacity-50" />
        <span>Select an Editor Layer<br />To Configure Settings</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col relative overflow-hidden">
      
      {/* Dynamic colored corner light indicator */}
      <div 
        className="absolute top-[-20px] right-[-20px] w-[80px] h-[80px] rounded-full blur-[35px] opacity-20 pointer-events-none transition-all duration-500"
        style={{ background: activeColor }}
      />

      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div 
            className="w-3.5 h-3.5 rounded-sm shadow-md transition-all duration-500" 
            style={{ 
              background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
              boxShadow: `0 0 12px ${activeColor}60`
            }}
          />
          <span className="text-xs uppercase tracking-[2px] font-bold text-white font-display">{layer.name} Settings</span>
        </div>

        {/* Toggle layer visibility directly */}
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => updateLayerVisibility(layer.id, !layer.visible)}>
          <span className="text-[9px] font-mono tracking-widest font-bold text-slate-500 uppercase group-hover:text-white transition-colors">
            {layer.visible ? 'ON' : 'OFF'}
          </span>
          <button
            className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 outline-none ${
              layer.visible ? 'bg-white/90' : 'bg-white/10'
            }`}
            style={layer.visible ? { boxShadow: `0 0 10px ${activeColor}80`, backgroundColor: activeColor } : {}}
            title="Toggle layer visibility"
          >
            <div
              className={`w-3 h-3 rounded-full bg-black transition-transform duration-300 ${
                layer.visible ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {!layer.visible && (
        <div className="mx-5 mt-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wide text-amber-500 flex items-center gap-2 backdrop-blur-sm">
          <EyeOff size={13} />
          <span>This layer is hidden from the preview</span>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6 relative z-10">
        {layer.type === 'visualizer' && <VisualizerSettingsPanel />}
        {layer.type === 'background' && <BackgroundSettingsPanel />}
        {layer.type === 'lyrics' && <LyricsSettingsPanel />}
        {layer.type === 'logo' && <LogoSettingsPanel />}
      </div>
    </div>
  );
}
