import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, isAutoManagedClip } from '../../store/useMVStore';
import { generateAutoEdit, generateGapFill } from '../../lib/mvAutoEdit';
import { Wand2, RefreshCw, Cpu, Download, Settings, Sliders, Key, Sparkles, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { pollinationsProvider } from '../../lib/providers/PollinationsImageProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function MVWorkflow() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const videoAssets = useMVStore(s => s.videoAssets);
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const style = useMVStore(s => s.style);
  const setStyle = useMVStore(s => s.setStyle);
  const pacing = useMVStore(s => s.pacing);
  const setPacing = useMVStore(s => s.setPacing);
  const beatSync = useMVStore(s => s.beatSync);
  const setBeatSync = useMVStore(s => s.setBeatSync);
  const autoTransitions = useMVStore(s => s.autoTransitions);
  const setAutoTransitions = useMVStore(s => s.setAutoTransitions);
  const defaultTransition = useMVStore(s => s.defaultTransition);
  const setDefaultTransition = useMVStore(s => s.setDefaultTransition);
  const transitionDuration = useMVStore(s => s.transitionDuration);
  const setTransitionDuration = useMVStore(s => s.setTransitionDuration);
  const editSeed = useMVStore(s => s.editSeed);
  const setEditSeed = useMVStore(s => s.setEditSeed);
  
  const localEngineConnected = useMVStore(s => s.localEngineConnected);

  const audioUrl = useStore(s => s.audioUrl);
  const audioDuration = useStore(s => s.audioDuration);
  const lyrics = useStore(s => s.lyricsSettings.lines);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);

  // 1. Core Browser-Based Basic Auto Edit (Works 100% Offline)
  const handleRunBasicAutoEdit = (newSeed?: number) => {
    setIsProcessing(true);
    setProgress(30);
    setStatusText('Analyzing...');

    setTimeout(() => {
      setProgress(65);
      setStatusText('Generating...');

      setTimeout(() => {
        const targetSeed = newSeed ?? editSeed;
        const songDur = audioDuration || 120;

        // Auto load sample stock if no media uploaded yet
        let assetsToUse = videoAssets;
        if (assetsToUse.length === 0) {
          const defaultSample = {
            id: 'sample-stock-1',
            url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
            name: 'Concert Stage Atmosphere.jpg',
            type: 'image' as const,
            duration: 8,
            thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60',
            isStock: true,
            status: 'ready' as const
          };
          addVideoAsset(defaultSample);
          assetsToUse = [defaultSample];
        }

        const mv = useMVStore.getState();
        // Treat manually changed clips as immutable anchors for generation,
        // even when the user never pressed the Lock button.
        const protectedClips = mv.timelineClips
          .filter(clip => !isAutoManagedClip(clip))
          .map(clip => ({ ...clip, locked: true }));
        const editResult = generateAutoEdit({
          songDuration: songDur,
          lyricsLines: lyrics,
          mediaAssets: assetsToUse,
          style,
          pacing,
          beatSync,
          seed: targetSeed,
          existingClips: protectedClips,
          songAnalysis: mv.songAnalysis
        });

        const generatedOnly = editResult.timelineClips.filter(clip =>
          !protectedClips.some(protectedClip => protectedClip.id === clip.id));
        // One atomic replacement: previously generated clips may change,
        // but manual clips retain exactly the same timing and presentation.
        const count = mv.applyAutoEditClips(generatedOnly);
        mv.setSongAnalysis(editResult.songAnalysis);
        mv.setWordTimings(editResult.wordTimings);
        useMVStore.getState().commitTimeline();

        setProgress(100);
        setStatusText(`Auto Edit completed: ${count} automatic scenes; manual edits preserved.`);

        setTimeout(() => {
          setIsProcessing(false);
        }, 600);
      }, 500);
    }, 400);
  };

  const handleRegenerate = () => {
    const nextSeed = Math.floor(Math.random() * 900000) + 100000;
    setEditSeed(nextSeed);
    handleRunBasicAutoEdit(nextSeed);
  };

  // Fill only the uncovered timeline spans. Manual clips, trims, effects,
  // captions, and existing song analysis are never regenerated or replaced.
  const handleFillEmptyGaps = () => {
    const state = useMVStore.getState();
    const media = state.videoAssets.filter(asset =>
      (asset.type === 'image' || asset.type === 'video') &&
      asset.status !== 'error' && !!asset.url
    );
    if (media.length === 0) {
      setStatusText('Import an image or video before filling gaps.');
      return;
    }
    const songDuration = audioDuration || Math.max(0, ...state.timelineClips.map(c => c.endTime));
    if (songDuration <= 0) {
      setStatusText('Load audio before filling timeline gaps.');
      return;
    }
    setIsProcessing(true);
    setStatusText('Filling uncovered timeline slots...');
    setProgress(20);
    try {
      const additions = generateGapFill({
        songDuration,
        lyricsLines: lyrics,
        mediaAssets: media,
        style: state.style,
        pacing: state.pacing,
        beatSync: state.beatSync,
        seed: state.editSeed,
        existingClips: state.timelineClips,
        songAnalysis: state.songAnalysis
      });
      const count = state.addGapFillClips(additions);
      if (count) useMVStore.getState().commitTimeline();
      setProgress(100);
      setStatusText(count > 0
        ? `Filled ${count} empty slot${count === 1 ? '' : 's'}; existing edits preserved.`
        : 'No additional slots could be filled with available media.');
    } catch (error) {
      console.error('[MVWorkflow] Gap fill failed:', error);
      setStatusText('Could not fill gaps. Existing edits were preserved.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFillVisuals = async () => {
    setIsProcessing(true);
    setProgress(10);
    setStatusText('Analyzing missing visual coverage...');

    try {
      setProgress(30);
      setStatusText('Prompting Pollinations.ai for visuals...');

      // Pick some lyrics or default prompt
      let prompts = ["Cinematic music video scene, 4k", "Dreamy atmosphere, neon lighting", "Youthful energy, stage lights"];
      if (lyrics && lyrics.length >= 3) {
        // Pick 3 random lyrics to generate visuals
        const shuffled = [...lyrics].sort(() => 0.5 - Math.random());
        prompts = shuffled.slice(0, 3).map(l => `Cinematic, ${l.text}, moody lighting, 4k`);
      }

      for (let i = 0; i < prompts.length; i++) {
        const result = await pollinationsProvider.generateImages({
          prompt: prompts[i],
          aspectRatio: '16:9',
          amount: 1
        });
        
        result.forEach(img => {
          addVideoAsset({
            id: img.id,
            file: undefined as any,
            url: img.url,
            name: `AI Fill: ${prompts[i].substring(0, 20)}...`,
            type: 'image',
            duration: 8,
            thumbnail: img.url,
            isStock: true,
            sourceType: 'generated',
            status: 'ready'
          });
        });
        setProgress(30 + ((i + 1) / prompts.length) * 40);
      }
      
      setStatusText('New visuals added to library. Filling timeline gaps...');
      handleFillEmptyGaps();
      
    } catch (err: any) {
      console.error(err);
      setStatusText('AI generation unavailable. Filling gaps from existing media...');
      handleFillEmptyGaps();
    }
  };

  const handleExportMV = () => {
    window.dispatchEvent(new CustomEvent('open-export-modal'));
  };

  const currentTimeline = useMVStore(s => s.timelineClips);
  const hasTimeline = currentTimeline.length > 0;
  const manuallyProtected = currentTimeline.filter(c => !isAutoManagedClip(c)).length;

  return (
    <div className="flex flex-col h-full bg-[#08080c] text-slate-300">
      {/* Title */}
      <div className="p-3 border-b border-white/10 flex items-center gap-2 text-white text-xs font-bold tracking-widest uppercase">
        <Sliders size={14} style={{ color: activeColor }} />
        Auto Editor Controls
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">


        {/* Main Action Section */}
        <div 
          className="p-3.5 rounded-lg border flex flex-col gap-3 shadow-lg bg-black/60 relative overflow-hidden"
          style={{ borderColor: `${activeColor}40` }}
        >
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{ background: `radial-gradient(circle at top right, ${activeColor}, transparent 70%)` }}
          />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} style={{ color: activeColor }} />
              Music Video Auto Edit
            </span>
            <span 
              className="text-[9px] px-2 py-0.5 rounded border font-extrabold uppercase tracking-widest"
              style={{ backgroundColor: `${activeColor}20`, borderColor: `${activeColor}50`, color: activeColor }}
            >
              READY
            </span>
          </div>

          <button
            onClick={() => handleRunBasicAutoEdit()}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-md text-black text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] relative z-10"
            style={{ backgroundColor: activeColor, boxShadow: `0 0 15px ${activeColor}40` }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Auto-Editing...</span>
              </>
            ) : (
              <>
                <Wand2 size={15} />
                <span>{hasTimeline ? 'Re-Run Auto Edit (Keep Manual)' : '✦ AUTO EDIT'}</span>
              </>
            )}
          </button>

          {hasTimeline && (
            <>
              <p className="text-[10px] text-slate-400 relative z-10">
                {manuallyProtected} manual or locked clip{manuallyProtected === 1 ? '' : 's'} protected.
                Re-run only replaces automatically generated clips.
              </p>
              <button
                onClick={handleRegenerate}
                disabled={isProcessing}
                className="w-full py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 relative z-10"
              >
                {isProcessing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                <span>Regenerate Auto Clips (New Seed)</span>
              </button>
              <button
                onClick={handleFillEmptyGaps}
                disabled={isProcessing}
                className="w-full py-2 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 relative z-10 disabled:opacity-50"
                title="Fill empty video slots without changing any existing edited clips"
              >
                <Wand2 size={13} />
                <span>Fill Empty Gaps — Keep My Edits</span>
              </button>
              <p className="text-[10px] leading-relaxed text-slate-400 relative z-10">
                Uses your current editing style, pacing and imported footage. Only uncovered video slots are filled.
              </p>
              <button
                onClick={handleAutoFillVisuals}
                disabled={isProcessing}
                className="w-full py-1.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 relative z-10 shadow"
              >
                {isProcessing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ImageIcon size={12} />
                )}
                <span>Generate AI Visuals + Fill Gaps</span>
              </button>
            </>
          )}

          {isProcessing && (
            <div className="w-full flex flex-col gap-1.5 mt-1 relative z-10 items-center">
              <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${progress}%`, backgroundColor: activeColor }} 
                />
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                <Loader2 size={11} className="animate-spin" style={{ color: activeColor }} />
                <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: activeColor }}>{statusText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Auto Edit owns transition defaults for all automatically generated clips. */}
        <section className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/10" aria-label="Scene transitions">
          <label className="flex items-center justify-between gap-3 text-xs font-semibold text-white">
            <span>Scene Transitions</span>
            <input type="checkbox" checked={autoTransitions}
              onChange={event => setAutoTransitions(event.target.checked)}
              aria-label="Enable scene transitions" className="accent-emerald-400" />
          </label>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase" htmlFor="mv-auto-transition">
            Transition style
          </label>
          <select id="mv-auto-transition" value={defaultTransition} disabled={!autoTransitions}
            onChange={event => setDefaultTransition(event.target.value as typeof defaultTransition)}
            className="w-full bg-black/80 border border-white/20 rounded p-2 text-xs text-white disabled:opacity-50">
            <option value="morph">Morph — smooth blend</option>
            <option value="crossfade">Crossfade / Mix</option>
            <option value="dissolve">Dissolve</option>
            <option value="fade">Fade in / out</option>
            <option value="slide">Slide</option>
            <option value="zoom">Smooth zoom</option>
            <option value="glitch">Glitch</option>
            <option value="cut">Hard cut</option>
          </select>
          <label className="flex items-center justify-between text-[10px] text-slate-400" htmlFor="mv-auto-transition-length">
            <span>Transition duration</span>
            <span className="font-mono text-emerald-400">{transitionDuration.toFixed(1)}s</span>
          </label>
          <input id="mv-auto-transition-length" type="range" min="0.1" max="2" step="0.1"
            value={transitionDuration} disabled={!autoTransitions}
            onChange={event => setTransitionDuration(Number(event.target.value))}
            className="w-full accent-emerald-400 disabled:opacity-50" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Applies to automatic clips immediately, including previously auto-edited scenes.
            Manually changed clip transitions remain protected.
          </p>
        </section>

        {/* Style & Pacing Settings */}
        <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/10">
          <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Settings size={13} style={{ color: activeColor }} />
            Editing Aesthetics
          </h4>

          {/* Style Preset */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Visual Style</label>
            <Select value={style} onValueChange={(val) => setStyle(val)}>
              <SelectTrigger className="h-8 text-xs bg-black/80 border-white/20">
                <SelectValue placeholder="Select Visual Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cinematic">Cinematic Montage</SelectItem>
                <SelectItem value="Performance">Performance Focus</SelectItem>
                <SelectItem value="K-pop">K-pop Fast Cut</SelectItem>
                <SelectItem value="Y2K">Y2K / Glitch Aesthetic</SelectItem>
                <SelectItem value="Dreamy">Dreamy & Slow Motion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pacing */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Cutting Pacing</label>
            <div className="grid grid-cols-3 gap-1">
              {['Slow', 'Balanced', 'Fast'].map(p => (
                <button
                  key={p}
                  onClick={() => setPacing(p as any)}
                  className="py-1 text-[10px] font-bold rounded border transition-colors"
                  style={pacing === p ? {
                    backgroundColor: activeColor,
                    borderColor: activeColor,
                    color: '#000'
                  } : {
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#94a3b8'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Beat Sync */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Beat Synchronization</label>
            <div className="grid grid-cols-3 gap-1">
              {['Off', 'Loose', 'Strong'].map(b => (
                <button
                  key={b}
                  onClick={() => setBeatSync(b as any)}
                  className="py-1 text-[10px] font-bold rounded border transition-colors"
                  style={beatSync === b ? {
                    backgroundColor: activeColor,
                    borderColor: activeColor,
                    color: '#000'
                  } : {
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#94a3b8'
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Edit Seed */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
            <span className="text-slate-400">Edit Seed:</span>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                value={editSeed} 
                onChange={(e) => setEditSeed(parseInt(e.target.value) || 1234)}
                className="w-16 bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-center text-white font-mono text-[10px]"
              />
              <button 
                onClick={handleRegenerate}
                title="Randomize Seed"
                className="p-1 bg-white/10 hover:bg-white/20 rounded text-white"
              >
                <RefreshCw size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Export Button */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <button 
          onClick={handleExportMV}
          disabled={!hasTimeline || isProcessing}
          className="w-full py-2.5 rounded-md text-black text-xs font-black tracking-widest uppercase transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: activeColor, boxShadow: `0 0 12px ${activeColor}30` }}
        >
          <Download size={14} />
          Export Final Music Video
        </button>
      </div>
    </div>
  );
}
