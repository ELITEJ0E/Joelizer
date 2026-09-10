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
    <div className="w-full h-full bg-[#0e1115] text-[#f0f3f6] flex flex-col relative overflow-hidden select-none font-mono">
      {/* Panel Header */}
      <div className="p-3 border-b border-[#232933] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
          <Sliders size={13} className="text-[#00e676]" />
          <span>Music Video Settings</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="mv-settings-anim space-y-5">
          
          {/* 1. Video Style */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider block">Video Style Theme</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-[#161b22] hover:bg-[#1c222b] border-[#232933] hover:border-[#303846] text-[#f0f3f6] uppercase font-semibold tracking-wider text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0e1115] border-[#232933] text-[#f0f3f6] uppercase text-xs font-semibold tracking-wider shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
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
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider block">Editing Pacing</label>
            <Select value={pacing} onValueChange={setPacing}>
              <SelectTrigger className="bg-[#161b22] hover:bg-[#1c222b] border-[#232933] hover:border-[#303846] text-[#f0f3f6] uppercase font-semibold tracking-wider text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0e1115] border-[#232933] text-[#f0f3f6] uppercase text-xs font-semibold tracking-wider shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
                <SelectItem value="Slow">Slow / Chill</SelectItem>
                <SelectItem value="Balanced">Balanced pacing</SelectItem>
                <SelectItem value="Fast">Fast / Intense</SelectItem>
                <SelectItem value="Hyper">Hyper Beat Sync</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Beat Sync Strength */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider block">Beat Sync Strength</label>
            <Select value={beatSync} onValueChange={setBeatSync}>
              <SelectTrigger className="bg-[#161b22] hover:bg-[#1c222b] border-[#232933] hover:border-[#303846] text-[#f0f3f6] uppercase font-semibold tracking-wider text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0e1115] border-[#232933] text-[#f0f3f6] uppercase text-xs font-semibold tracking-wider shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
                <SelectItem value="None">None (Unsynced)</SelectItem>
                <SelectItem value="Subtle">Subtle alignment</SelectItem>
                <SelectItem value="Strong">Strong cut on beat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Edit Seed */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider block">Edit Seed (Timeline Seed)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={editSeed}
                onChange={(e) => setEditSeed(parseInt(e.target.value) || 42)}
                className="flex-1 bg-[#0a0c0f] border border-[#232933] focus:border-[#00e676] rounded px-3 py-1.5 text-xs text-[#f0f3f6] font-mono outline-none transition-colors"
              />
              <button
                onClick={() => setEditSeed(Math.floor(Math.random() * 900000) + 100000)}
                className="px-3 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Wand2 size={12} className="text-[#00e676]" />
                <span>RAND</span>
              </button>
            </div>
            <p className="text-[10px] text-[#7e8999] font-sans leading-normal">
              Determines clip selection order and transition patterns during automatic generation.
            </p>
          </div>

          {/* 5. AI Copilot Integration */}
          <div className="pt-3 border-t border-[#232933] space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#f0f3f6] flex items-center gap-1.5 font-mono">
                  <Sparkles size={13} className="text-[#00e676]" />
                  <span>Gemini Copilot</span>
                </span>
                <p className="text-[10px] text-[#7e8999] font-sans">Use AI to select matching clips based on lyrics.</p>
              </div>
              <button
                onClick={() => setUseGemini(!useGemini)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[#232933] transition-colors duration-200 ease-in-out focus:outline-none ${
                  useGemini ? 'bg-[#00e676]' : 'bg-[#161b22]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 mt-0.5 transform rounded-full transition duration-200 ease-in-out ${
                    useGemini ? 'translate-x-4 bg-[#0a0c0f]' : 'translate-x-0.5 bg-[#7e8999]'
                  }`}
                />
              </button>
            </div>

            {useGemini && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider flex items-center gap-1 block">
                  <Key size={11} />
                  <span>Gemini API Key</span>
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AI Studio API Key..."
                  className="w-full bg-[#0a0c0f] border border-[#232933] focus:border-[#00e676] rounded p-2 text-xs text-[#f0f3f6] outline-none font-mono transition-colors"
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
