import React, { useState } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { Play } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

function VisualizerSettingsPanel() {
// ... existing code ...

  const settings = useStore(s => s.visualizerSettings);
  const updateSettings = useStore(s => s.updateVisualizerSettings);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Style</label>
        </div>
        <Select value={settings.style} onValueChange={v => updateSettings({ style: v as any })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bars">Bars</SelectItem>
            <SelectItem value="waveform">Waveform</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
            <SelectItem value="particles">Particles</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Primary Color</label>
        <div className="flex gap-2">
          <input 
            type="color" 
            value={settings.color}
            onChange={e => updateSettings({ color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
          />
          <input 
            type="text"
            value={settings.color}
            onChange={e => updateSettings({ color: e.target.value })}
            className="flex-1 bg-white/5 border border-white/10 text-white rounded px-2 text-[10px] font-mono outline-none focus:border-[#00e676]/50"
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Sensitivity</label>
          <span className="text-[10px] font-mono text-[#00e676]">{settings.sensitivity.toFixed(2)}</span>
        </div>
        <input 
          type="range" min="0.1" max="2" step="0.1"
          value={settings.sensitivity}
          onChange={e => updateSettings({ sensitivity: parseFloat(e.target.value) })}
          className="w-full accent-[#00e676] h-1 bg-white/10 rounded-full appearance-none outline-none"
        />
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Smoothness</label>
          <span className="text-[10px] font-mono text-[#00e676]">{settings.smoothing.toFixed(2)}</span>
        </div>
        <input 
          type="range" min="0.1" max="0.99" step="0.01"
          value={settings.smoothing}
          onChange={e => updateSettings({ smoothing: parseFloat(e.target.value) })}
          className="w-full accent-[#00e676] h-1 bg-white/10 rounded-full appearance-none outline-none"
        />
      </div>
    </div>
  );
}

function BackgroundSettingsPanel() {
  const settings = useStore(s => s.backgroundSettings);
  const updateSettings = useStore(s => s.updateBackgroundSettings);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Type</label>
        <Select value={settings.type} onValueChange={v => updateSettings({ type: v as any })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="color">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {settings.type === 'color' && (
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Color</label>
          <input 
            type="color" 
            value={settings.value}
            onChange={e => updateSettings({ value: e.target.value })}
            className="w-full h-8 rounded cursor-pointer bg-transparent border-0 p-0"
          />
        </div>
      )}
      
      {settings.type === 'gradient' && (
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Gradient Colors</label>
          <input 
            type="text" 
            value={settings.value}
            onChange={e => updateSettings({ value: e.target.value })}
            placeholder="#111111, #333333"
            className="w-full bg-white/5 border border-white/10 text-white rounded p-2 text-[10px] font-mono outline-none focus:border-[#00e676]/50"
          />
        </div>
      )}

      {settings.type === 'image' && (
        <div>
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Upload Image</label>
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
            className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 p-3 bg-white/5 rounded-lg border border-white/5">
        <input 
          type="checkbox" 
          id="blurAlbum"
          checked={settings.blurAlbumArt}
          onChange={e => updateSettings({ blurAlbumArt: e.target.checked })}
          className="accent-[#00e676] w-4 h-4 rounded bg-[#0d0d0d] border-white/10"
        />
        <label htmlFor="blurAlbum" className="text-[10px] font-bold text-white uppercase tracking-wider">Blur Album Art Background</label>
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
  
  const [rawText, setRawText] = useState(settings.lines.map(l => l.text).join('\n'));
  const [syncMode, setSyncMode] = useState(false);
  const [syncIndex, setSyncIndex] = useState(0);

  const handleParse = () => {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    const newLines: LyricLine[] = lines.map((text, i) => ({
      id: `l_${i}`,
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
      // Give last line some default duration
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

  return (
    <div className="space-y-4">
      {!syncMode ? (
        <>
          <div>
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Lyrics Text</label>
            <textarea 
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste your lyrics here..."
              className="w-full h-32 bg-white/5 border border-white/10 text-white rounded p-2 text-[10px] font-mono outline-none resize-none focus:border-[#00e676]/50"
            />
            <button 
              onClick={startSync}
              disabled={!rawText.trim()}
              className="mt-2 w-full py-2 bg-white/5 border border-[#00e676]/20 hover:bg-[#00e676]/10 hover:border-[#00e676]/40 disabled:opacity-50 text-[#00e676] text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
            >
              <Play size={14} /> Start Tap-to-Sync
            </button>
          </div>
          
          <div>
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Animation Style</label>
            <Select value={settings.animationStyle} onValueChange={v => updateSettings({ animationStyle: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade In/Out</SelectItem>
                <SelectItem value="karaoke">Karaoke Highlight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Color</label>
            <div className="flex gap-2">
              <input 
                type="color" 
                value={settings.color}
                onChange={e => updateSettings({ color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <input 
                type="text"
                value={settings.color}
                onChange={e => updateSettings({ color: e.target.value })}
                className="flex-1 bg-white/5 border border-white/10 text-white rounded px-2 text-[10px] font-mono outline-none focus:border-[#00e676]/50"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 bg-[#00e676]/5 rounded-lg p-4 border border-[#00e676]/30">
          <div className="text-[10px] uppercase tracking-widest text-[#00e676] font-bold mb-2">Upcoming line:</div>
          <div className="text-sm font-bold text-white text-center mb-6">
            {settings.lines[syncIndex]?.text || "All done!"}
          </div>
          
          <button 
            onClick={handleTap}
            className="w-20 h-20 rounded-full bg-[#00e676] hover:bg-[#00c867] active:scale-95 text-black font-black text-xs tracking-widest flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,230,118,0.4)]"
          >
            TAP
          </button>
          
          <button 
            onClick={() => { setSyncMode(false); setIsPlaying(false); }}
            className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white"
          >
            Cancel Sync
          </button>
        </div>
      )}
    </div>
  );
}

function LogoSettingsPanel() {
  const settings = useStore(s => s.logoSettings);
  const updateSettings = useStore(s => s.updateLogoSettings);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Upload Logo</label>
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
          className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
        />
        {settings.image && (
          <button 
            onClick={() => updateSettings({ image: null })}
            className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#ff0055] hover:text-[#ff0055]/80"
          >
            Remove Logo
          </button>
        )}
      </div>
      
      <div>
        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 block">Position</label>
        <Select value={settings.position} onValueChange={v => updateSettings({ position: v as any })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top-left">Top Left</SelectItem>
            <SelectItem value="top-right">Top Right</SelectItem>
            <SelectItem value="bottom-left">Bottom Left</SelectItem>
            <SelectItem value="bottom-right">Bottom Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Size</label>
          <span className="text-[10px] font-mono text-[#00e676]">{settings.size.toFixed(2)}</span>
        </div>
        <input 
          type="range" min="0.05" max="0.5" step="0.01"
          value={settings.size}
          onChange={e => updateSettings({ size: parseFloat(e.target.value) })}
          className="w-full accent-[#00e676] h-1 bg-white/10 rounded-full appearance-none outline-none"
        />
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Opacity</label>
          <span className="text-[10px] font-mono text-[#00e676]">{settings.opacity.toFixed(2)}</span>
        </div>
        <input 
          type="range" min="0" max="1" step="0.1"
          value={settings.opacity}
          onChange={e => updateSettings({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-[#00e676] h-1 bg-white/10 rounded-full appearance-none outline-none"
        />
      </div>
    </div>
  );
}

export function RightPanel() {
  const selectedLayerId = useStore(s => s.selectedLayerId);
  const layer = useStore(s => s.layers.find(l => l.id === selectedLayerId));

  if (!layer) {
    return (
      <div className="w-full h-full bg-[#0d0d0d] border-l border-white/5 p-6 flex flex-col items-center justify-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
        Select a layer to edit settings
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0d0d0d] border-l border-white/5 flex flex-col">
      <div className="p-4 flex items-center gap-2 border-b border-white/5">
        <div className="w-3 h-3 bg-[#00e676] rounded-sm"></div>
        <span className="text-[10px] uppercase tracking-[2px] font-bold text-white">{layer.name} Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {layer.type === 'visualizer' && <VisualizerSettingsPanel />}
        {layer.type === 'background' && <BackgroundSettingsPanel />}
        {layer.type === 'lyrics' && <LyricsSettingsPanel />}
        {layer.type === 'logo' && <LogoSettingsPanel />}
      </div>
    </div>
  );
}
