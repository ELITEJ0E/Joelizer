import React, { useState, useEffect, useRef } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { Play, Upload, Clock, Plus, Minus, Trash2, Eye, EyeOff, Film, AlignLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { parseLRC } from '../../lib/utils';
import { Scrubber } from '../ui/scrubber';

function VisualizerSettingsPanel() {
  const settings = useStore(s => s.visualizerSettings);
  const updateSettings = useStore(s => s.updateVisualizerSettings);
  const activeColor = settings.color || '#00e676';

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Visualizer Style</label>
        <Select value={settings.style} onValueChange={v => updateSettings({ style: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-colors uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b] border-white/10 uppercase text-xs font-bold tracking-wider">
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
            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Mirror Segments</label>
            <span className="text-[10px] font-mono font-bold" style={{ color: activeColor }}>{settings.segments || 8} segments</span>
          </div>
          <input 
            type="range" min="4" max="18" step="2"
            value={settings.segments || 8}
            onChange={e => updateSettings({ segments: parseInt(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-full appearance-none outline-none cursor-pointer"
            style={{ accentColor: activeColor }}
          />
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Primary Accent Color</label>
        <div className="flex gap-2">
          <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer">
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
            className="flex-1 bg-white/[0.03] border border-white/10 text-white rounded px-3 text-xs font-mono outline-none focus:border-white/20 uppercase tracking-wider font-bold"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Sensitivity</label>
          <span className="text-[10px] font-mono font-bold" style={{ color: activeColor }}>{settings.sensitivity.toFixed(2)}x</span>
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
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Temporal Smoothing</label>
          <span className="text-[10px] font-mono font-bold" style={{ color: activeColor }}>{settings.smoothing.toFixed(2)}</span>
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
  );
}

function BackgroundSettingsPanel() {
  const settings = useStore(s => s.backgroundSettings);
  const updateSettings = useStore(s => s.updateBackgroundSettings);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Background Type</label>
        <Select value={settings.type} onValueChange={v => updateSettings({ type: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-colors uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b] border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="color">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient Fill</SelectItem>
            <SelectItem value="image">Still Image</SelectItem>
            <SelectItem value="video">Reactive Video</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {settings.type === 'color' && (
        <div>
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Hex Code</label>
          <div className="flex gap-2">
            <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer">
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
              className="flex-1 bg-white/[0.03] border border-white/10 text-white rounded px-3 text-xs font-mono outline-none focus:border-white/20 uppercase tracking-wider font-bold"
            />
          </div>
        </div>
      )}
      
      {settings.type === 'gradient' && (
        <div>
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Gradient Stops (Comma Separated)</label>
          <input 
            type="text" 
            value={settings.value}
            onChange={e => updateSettings({ value: e.target.value })}
            placeholder="#0c0c14, #030308"
            className="w-full bg-white/[0.03] border border-white/10 text-white rounded p-2.5 text-xs font-mono outline-none focus:border-white/20 uppercase tracking-wider font-bold"
          />
        </div>
      )}

      {settings.type === 'image' && (
        <div>
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Upload Still Image</label>
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
            className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer"
          />
        </div>
      )}

      {settings.type === 'video' && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Upload Video Asset</label>
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
              className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Screen Scale Mode</label>
            <Select value={settings.fit || 'cover'} onValueChange={v => updateSettings({ fit: v as any })}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-colors uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b] border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="cover">Scale to Fill (Zoom Crop)</SelectItem>
                <SelectItem value="contain">Show Whole Video (Letterbox)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mt-5 p-3.5 bg-white/[0.02] rounded-lg border border-white/5">
        <input 
          type="checkbox" 
          id="blurAlbum"
          checked={settings.blurAlbumArt}
          onChange={e => updateSettings({ blurAlbumArt: e.target.checked })}
          className="w-4 h-4 rounded bg-[#0d0d0d] border-white/10 cursor-pointer"
          style={{ accentColor: activeColor }}
        />
        <label htmlFor="blurAlbum" className="text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer select-none">Blur Album Art Cover</label>
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
  const [syncMode, setSyncMode] = useState(false);
  const [syncIndex, setSyncIndex] = useState(0);

  // Synchronize keydown triggers during tap sync (Spacebar support)
  useEffect(() => {
    if (!syncMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [syncMode, syncIndex, settings.lines, currentTime]);

  const handleParse = () => {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    const newLines: LyricLine[] = lines.map((text, i) => ({
      id: `l_${i}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      startTime: 0,
      endTime: 0
    }));
    updateSettings({ lines: newLines });
  };

  const handleTap = () => {
    if (syncIndex >= settings.lines.length) {
      setSyncMode(false);
      setIsPlaying(false);
      return;
    }
    
    const updatedLines = [...settings.lines];
    
    if (syncIndex > 0) {
      updatedLines[syncIndex - 1].endTime = currentTime;
    }
    
    updatedLines[syncIndex].startTime = currentTime;
    
    if (syncIndex === settings.lines.length - 1) {
      updatedLines[syncIndex].endTime = currentTime + 5; 
    }
    
    updateSettings({ lines: updatedLines });
    setSyncIndex(syncIndex + 1);
  };

  const startSync = () => {
    handleParse();
    setSyncIndex(0);
    setSyncMode(true);
    setIsPlaying(true);
  };

  const handleLrcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseLRC(text);
          updateSettings({ lines: parsed });
          setRawText(parsed.map(l => l.text).join('\n'));
        }
      };
      reader.readAsText(file);
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
    <div className="space-y-5">
      {!syncMode ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest block">Lyric Script</label>
              
              {/* LRC File Loader */}
              <label className="cursor-pointer text-[9px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                <Upload size={10} />
                <span>Import LRC</span>
                <input type="file" accept=".lrc,text/*" className="hidden" onChange={handleLrcUpload} />
              </label>
            </div>
            
            <textarea 
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Type or paste lyric sheet lines here..."
              className="w-full h-28 bg-white/[0.03] border border-white/10 text-white rounded-md p-2.5 text-[10px] font-mono outline-none resize-none focus:border-white/20 transition-all leading-normal"
            />
            
            <button 
              onClick={startSync}
              disabled={!rawText.trim()}
              className="w-full py-2.5 bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Clock size={12} className="text-[#00e676]" /> <span>Start Tap-To-Sync</span>
            </button>
          </div>
          
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Animation Preset</label>
            <Select value={settings.animationStyle} onValueChange={v => updateSettings({ animationStyle: v as any })}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-colors uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b] border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="fade">Classic Fade In/Out</SelectItem>
                <SelectItem value="karaoke">Smooth Karaoke Highlight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Text Accent Color</label>
            <div className="flex gap-2">
              <div className="relative w-9 h-9 rounded overflow-hidden border border-white/15 flex-shrink-0 cursor-pointer">
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
                className="flex-1 bg-white/[0.03] border border-white/10 text-white rounded px-3 text-xs font-mono outline-none focus:border-white/20 uppercase tracking-wider font-bold"
              />
            </div>
          </div>

          {/* Sync timeline list */}
          {settings.lines.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                <AlignLeft size={11} className="text-slate-400" />
                <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Interactive Sync Timeline</label>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {settings.lines.map((line, idx) => (
                  <div 
                    key={line.id}
                    className={`p-2.5 rounded border text-[10px] flex items-center justify-between gap-2.5 transition-all bg-white/[0.02] border-white/5 hover:border-white/10`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold truncate leading-none">{line.text}</p>
                      <p className="text-[8px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                        SPAN: {line.startTime.toFixed(1)}s - {line.endTime.toFixed(1)}s
                      </p>
                    </div>

                    {/* Precision adjust trigger */}
                    <div className="flex items-center gap-1.5">
                      {/* Start adjust */}
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">START</span>
                        <div className="flex items-center bg-black/40 rounded border border-white/10 p-0.5">
                          <button onClick={() => nudgeLineStart(idx, -0.1)} className="p-0.5 text-slate-400 hover:text-white">
                            <Minus size={9} />
                          </button>
                          <button onClick={() => nudgeLineStart(idx, 0.1)} className="p-0.5 text-slate-400 hover:text-[#00e676]">
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>

                      {/* End adjust */}
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">END</span>
                        <div className="flex items-center bg-black/40 rounded border border-white/10 p-0.5">
                          <button onClick={() => nudgeLineEnd(idx, -0.1)} className="p-0.5 text-slate-400 hover:text-white">
                            <Minus size={9} />
                          </button>
                          <button onClick={() => nudgeLineEnd(idx, 0.1)} className="p-0.5 text-slate-400 hover:text-[#00e676]">
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => removeLine(idx)}
                        className="p-1 text-slate-500 hover:text-red-500 rounded hover:bg-white/5 transition-colors"
                        title="Remove segment"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/10 rounded-lg backdrop-blur-md relative overflow-hidden shadow-2xl">
          {/* Pulsing ambient border halo */}
          <div className="absolute inset-0 border border-[#00e676]/20 animate-pulse pointer-events-none" />

          <p className="text-[8px] font-mono tracking-widest text-[#00e676] font-black uppercase mb-1">
            RECORD TIMINGS IN SYNC
          </p>
          <p className="text-[8px] font-mono tracking-widest text-slate-500 uppercase mb-4">
            PRESS [SPACEBAR] OR TAP BUTTON
          </p>

          <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">
            UPCOMING ({syncIndex + 1}/{settings.lines.length}):
          </p>
          <div className="text-xs font-bold text-white text-center min-h-[44px] flex items-center justify-center max-w-xs mt-1.5 px-2 mb-5 leading-normal">
            {settings.lines[syncIndex]?.text || "All lines synced successfully!"}
          </div>
          
          <button 
            onClick={handleTap}
            className="w-20 h-20 rounded-full text-black font-black text-xs tracking-widest flex items-center justify-center transition-all shadow-xl active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
              boxShadow: `0 0 25px ${activeColor}40`
            }}
          >
            TAP
          </button>
          
          <button 
            onClick={() => { setSyncMode(false); setIsPlaying(false); }}
            className="mt-5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white border-b border-dashed border-white/10 hover:border-white/30 transition-all"
          >
            Abort Syncer
          </button>
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
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Branding Watermark</label>
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
          className="w-full text-xs text-slate-400 file:mr-3.5 file:py-1 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-white/10 file:text-white hover:file:bg-white/15 cursor-pointer"
        />
        {settings.image && (
          <button 
            onClick={() => updateSettings({ image: null })}
            className="mt-2.5 text-[9px] font-black uppercase tracking-widest text-[#ff0055] hover:text-[#ff0055]/80 flex items-center gap-1"
          >
            <Trash2 size={10} />
            <span>Remove Watermark</span>
          </button>
        )}
      </div>
      
      <div>
        <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2 block">Placement Corner</label>
        <Select value={settings.position} onValueChange={v => updateSettings({ position: v as any })}>
          <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-colors uppercase font-bold tracking-wider text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0b0b] border-white/10 uppercase text-xs font-bold tracking-wider">
            <SelectItem value="top-left">Top-Left Corner</SelectItem>
            <SelectItem value="top-right">Top-Right Corner</SelectItem>
            <SelectItem value="bottom-left">Bottom-Left Corner</SelectItem>
            <SelectItem value="bottom-right">Bottom-Right Corner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Dimension Scale</label>
          <span className="text-[10px] font-mono font-bold" style={{ color: activeColor }}>{(settings.size * 100).toFixed(0)}%</span>
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
          <label className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Alpha Opacity</label>
          <span className="text-[10px] font-mono font-bold" style={{ color: activeColor }}>{(settings.opacity * 100).toFixed(0)}%</span>
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
      <div className="w-full h-full bg-[#070707] border-l border-white/10 p-6 flex flex-col items-center justify-center text-slate-500 text-[10px] font-black uppercase tracking-[2px] text-center leading-relaxed">
        <Film size={20} className="text-slate-600 mb-3 animate-pulse" />
        <span>Select an Editor Layer<br />To Configure Settings</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#070707] border-l border-white/10 flex flex-col relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      
      {/* Dynamic colored corner light indicator */}
      <div 
        className="absolute top-0 right-0 w-[40px] h-[40px] rounded-full blur-[25px] opacity-[0.08] pointer-events-none"
        style={{ background: activeColor }}
      />

      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div 
            className="w-3.5 h-3.5 rounded-sm shadow-md" 
            style={{ 
              background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
              boxShadow: `0 0 10px ${activeColor}40`
            }}
          />
          <span className="text-xs uppercase tracking-[2px] font-black text-white">{layer.name} Settings</span>
        </div>

        {/* Toggle layer visibility directly */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono tracking-wider font-bold text-slate-500 uppercase">
            {layer.visible ? 'ON' : 'OFF'}
          </span>
          <button
            onClick={() => updateLayerVisibility(layer.id, !layer.visible)}
            className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 outline-none ${
              layer.visible ? 'bg-[#00e676]' : 'bg-white/10'
            }`}
            title="Toggle layer visibility"
          >
            <div
              className={`w-3 h-3 rounded-full bg-black transition-transform duration-200 ${
                layer.visible ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {!layer.visible && (
        <div className="mx-5 mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wide text-amber-500 flex items-center gap-2">
          <EyeOff size={12} />
          <span>This layer is hidden from the preview</span>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {layer.type === 'visualizer' && <VisualizerSettingsPanel />}
        {layer.type === 'background' && <BackgroundSettingsPanel />}
        {layer.type === 'lyrics' && <LyricsSettingsPanel />}
        {layer.type === 'logo' && <LogoSettingsPanel />}
      </div>
    </div>
  );
}
