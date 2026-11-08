import React, { useEffect } from 'react';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { Sliders, Key, Sparkles, Wand2, Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { animate, stagger } from 'animejs';

export function MVSettingsPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const lyricsSettings = useStore(s => s.lyricsSettings);
  const updateLyricsSettings = useStore(s => s.updateLyricsSettings);
  const setLyricsVideoAnimation = useLyricsVideoStore(s => s.setAnimationStyle);
  const lyricsVideoAnim = useLyricsVideoStore(s => s.animationStyle);
  const lyricsAnimStyle = lyricsSettings?.animationStyle || lyricsVideoAnim || 'karaoke';
  const lyricsPos = lyricsSettings?.position || 'bottom';
  const showBox = lyricsSettings?.showBackgroundBox ?? false;
  
  const style = useMVStore(s => s.style);
  const setStyle = useMVStore(s => s.setStyle);
  const pacing = useMVStore(s => s.pacing);
  const setPacing = useMVStore(s => s.setPacing);
  const beatSync = useMVStore(s => s.beatSync);
  const setBeatSync = useMVStore(s => s.setBeatSync);
  const editSeed = useMVStore(s => s.editSeed);
  const setEditSeed = useMVStore(s => s.setEditSeed);
  
  const autoTransitions = useMVStore(s => s.autoTransitions);
  const setAutoTransitions = useMVStore(s => s.setAutoTransitions);
  const defaultTransition = useMVStore(s => s.defaultTransition);
  const setDefaultTransition = useMVStore(s => s.setDefaultTransition);
  const transitionDuration = useMVStore(s => s.transitionDuration);
  const setTransitionDuration = useMVStore(s => s.setTransitionDuration);
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
          <Sliders size={13} className="text-accent" />
          <span>Music Video Settings</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="mv-settings-anim space-y-5">
          
          <section className="space-y-3 rounded-lg border border-[#303846] bg-[#121a23] p-3" aria-label="Video clip transitions">
            <label className="flex items-center justify-between gap-3 text-xs font-semibold">
              <span>Automatic transitions</span>
              <input type="checkbox" checked={autoTransitions} onChange={e => setAutoTransitions(e.target.checked)}
                aria-label="Enable transitions at adjacent clip boundaries" className="accent-emerald-400" />
            </label>
            <div className="space-y-1">
              <label htmlFor="mv-default-transition" className="block text-[10px] text-[#9ba8b8]">Default transition</label>
              <select id="mv-default-transition" disabled={!autoTransitions} value={defaultTransition}
                onChange={e => setDefaultTransition(e.target.value as typeof defaultTransition)}
                className="w-full rounded border border-[#303846] bg-[#0d1219] p-2 text-xs">
                <option value="crossfade">Crossfade / Mix</option>
                <option value="fade">Fade in / out</option>
                <option value="dissolve">Dissolve</option>
                <option value="morph">Morph (smooth blend)</option>
                <option value="slide">Slide</option>
                <option value="zoom">Smooth zoom</option>
                <option value="glitch">Glitch</option>
                <option value="cut">Hard cut</option>
              </select>
            </div>
            <label className="block text-[10px] text-[#9ba8b8]" htmlFor="mv-transition-duration">
              Transition duration: {transitionDuration.toFixed(1)}s
            </label>
            <input id="mv-transition-duration" type="range" min="0.1" max="2" step="0.1"
              disabled={!autoTransitions} value={transitionDuration}
              onChange={e => setTransitionDuration(Number(e.target.value))} className="w-full accent-emerald-400" />
            <p className="text-[10px] text-[#9ba8b8]">
              Clip transitions affect adjacent cuts. Trimming and moving clips cannot overwrite neighboring clips.
            </p>
          </section>

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

          {/* Unified Caption & Lyric Style */}
          <div className="pt-3 border-t border-[#232933] space-y-2.5">
            <span className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider flex items-center gap-1.5">
              <Type size={12} className="text-accent" />
              <span>Lyric Animation & Subtitles</span>
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  updateLyricsSettings({ animationStyle: 'fade' });
                  setLyricsVideoAnimation('fade');
                }}
                className={`p-2 rounded text-xs font-mono border text-center transition-all cursor-pointer ${
                  lyricsAnimStyle === 'fade'
                    ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                    : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                Smooth Fade
              </button>

              <button
                type="button"
                onClick={() => {
                  updateLyricsSettings({ animationStyle: 'karaoke' });
                  setLyricsVideoAnimation('karaoke');
                }}
                className={`p-2 rounded text-xs font-mono border text-center transition-all cursor-pointer ${
                  lyricsAnimStyle === 'karaoke'
                    ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                    : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                Karaoke Highlight
              </button>
            </div>

            {/* Subtitle Positioning & Background Box */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const nextPos = lyricsPos === 'center' ? 'bottom' : 'center';
                  updateLyricsSettings({ position: nextPos });
                  useLyricsVideoStore.getState().updateTypographyOverride({ position: nextPos });
                  useLyricsVideoStore.getState().setElementPosition('lyrics', {
                    x: 0.5,
                    y: nextPos === 'center' ? 0.5 : 0.82
                  });
                }}
                className="p-1.5 rounded text-[10px] font-mono border bg-[#0a0c0f] border-[#232933] text-[#f0f3f6] flex items-center justify-between cursor-pointer hover:border-[#384252]"
              >
                <span className="text-[#7e8999]">Position:</span>
                <span className="text-accent font-bold uppercase">{lyricsPos}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextBox = !showBox;
                  updateLyricsSettings({ showBackgroundBox: nextBox });
                  useLyricsVideoStore.getState().updateTypographyOverride({ showContainerPill: nextBox });
                }}
                className="p-1.5 rounded text-[10px] font-mono border bg-[#0a0c0f] border-[#232933] text-[#f0f3f6] flex items-center justify-between cursor-pointer hover:border-[#384252]"
              >
                <span className="text-[#7e8999]">Box:</span>
                <span className="text-accent font-bold uppercase">{showBox ? 'Dark Box' : 'Clear (No Box)'}</span>
              </button>
            </div>
          </div>

          {/* 4. Edit Seed */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider block">Edit Seed (Timeline Seed)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={editSeed}
                onChange={(e) => setEditSeed(parseInt(e.target.value) || 42)}
                className="flex-1 bg-[#0a0c0f] border border-[#232933] focus:border-accent rounded px-3 py-1.5 text-xs text-[#f0f3f6] font-mono outline-none transition-colors"
              />
              <button
                onClick={() => setEditSeed(Math.floor(Math.random() * 900000) + 100000)}
                className="px-3 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Wand2 size={12} className="text-accent" />
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
                  <Sparkles size={13} className="text-accent" />
                  <span>Gemini Copilot</span>
                </span>
                <p className="text-[10px] text-[#7e8999] font-sans">Use AI to select matching clips based on lyrics.</p>
              </div>
              <button
                onClick={() => setUseGemini(!useGemini)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[#232933] transition-colors duration-200 ease-in-out focus:outline-none ${
                  useGemini ? 'bg-accent' : 'bg-[#161b22]'
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
                  className="w-full bg-[#0a0c0f] border border-[#232933] focus:border-accent rounded p-2 text-xs text-[#f0f3f6] outline-none font-mono transition-colors"
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
