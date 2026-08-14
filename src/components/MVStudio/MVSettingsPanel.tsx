import React, { useEffect } from 'react';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { Sliders, Key, Sparkles, Wand2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { animate, stagger } from 'animejs';

export function MVSettingsPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const style = useMVStore(s => s.style);
  const setStyle = useMVStore(s => s.setStyle);
  const pacing = useMVStore(s => s.pacing);
  const setPacing = useMVStore(s => s.setPacing);
  const beatSync = useMVStore(s => s.beatSync);
  const setBeatSync = useMVStore(s => s.setBeatSync);
  const editSeed = useMVStore(s => s.editSeed);
  const setEditSeed = useMVStore(s => s.setEditSeed);
  
  const useGemini = useMVStore(s => s.useGemini);
  const setUseGemini = useMVStore(s => s.setUseGemini);
  const geminiKey = useMVStore(s => s.geminiKey);
  const setGeminiKey = useMVStore(s => s.setGeminiKey);

  useEffect(() => {
    animate('.mv-settings-anim > *', {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(40, { start: 20 }),
      duration: 400,
      easing: 'easeOutQuart'
    });
  }, []);

  return (
    <div className="w-full h-full bg-[#060608] flex flex-col relative overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <span className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-1.5">
          <Sliders size={14} style={{ color: activeColor }} />
          <span>Music Video Settings</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="mv-settings-anim space-y-6">
          
          {/* 1. Video Style */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Video Style Theme</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="Cinematic">Cinematic</SelectItem>
                <SelectItem value="Cyberpunk">Cyberpunk</SelectItem>
                <SelectItem value="Phonk">Phonk / Hardcore</SelectItem>
                <SelectItem value="Anime">Anime Aesthetic</SelectItem>
                <SelectItem value="Vintage">Retro / Vintage VHS</SelectItem>
                <SelectItem value="Minimalist">Minimalist / Clean</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Editing Pacing */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Editing Pacing</label>
            <Select value={pacing} onValueChange={setPacing}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="Slow">Slow / Chill</SelectItem>
                <SelectItem value="Balanced">Balanced pacing</SelectItem>
                <SelectItem value="Fast">Fast / Intense</SelectItem>
                <SelectItem value="Hyper">Hyper Beat Sync</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Beat Sync Strength */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Beat Sync Strength</label>
            <Select value={beatSync} onValueChange={setBeatSync}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 hover:border-white/20 transition-glass uppercase font-bold tracking-wider text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0b]/90 backdrop-blur-xl border-white/10 uppercase text-xs font-bold tracking-wider">
                <SelectItem value="None">None (Unsynced)</SelectItem>
                <SelectItem value="Subtle">Subtle alignment</SelectItem>
                <SelectItem value="Strong">Strong cut on beat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Edit Seed */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest block">Edit Seed (Timeline Seed)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={editSeed}
                onChange={(e) => setEditSeed(parseInt(e.target.value) || 42)}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none font-mono focus:border-white/25 transition-glass"
              />
              <button
                onClick={() => setEditSeed(Math.floor(Math.random() * 900000) + 100000)}
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Wand2 size={13} />
                <span>Rand</span>
              </button>
            </div>
            <p className="text-[9px] text-slate-400 leading-normal">
              Determines clip selection order and transition patterns during automatic generation.
            </p>
          </div>

          {/* 5. AI Copilot Integration */}
          <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Gemini Copilot</span>
                </span>
                <p className="text-[9px] text-slate-400">Use AI to select matching clips based on lyrics.</p>
              </div>
              <button
                onClick={() => setUseGemini(!useGemini)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  useGemini ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    useGemini ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {useGemini && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-1 block">
                  <Key size={11} />
                  <span>Gemini API Key</span>
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AI Studio API Key..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-md p-2.5 text-xs text-white outline-none font-mono focus:border-white/20 transition-glass"
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
