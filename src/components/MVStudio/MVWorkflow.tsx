import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { generateAutoEdit } from '../../lib/mvAutoEdit';
import { Wand2, RefreshCw, Cpu, Download, Settings, Sliders, Key, Sparkles, CheckCircle2, Image as ImageIcon } from 'lucide-react';
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
    setProgress(20);
    setStatusText('Analyzing Song & Lyrics Structure...');

    setTimeout(() => {
      setProgress(50);
      setStatusText('Selecting Media Clips & Applying Pacing Rules...');

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

        const currentClips = useMVStore.getState().timelineClips;

        const editResult = generateAutoEdit({
          songDuration: songDur,
          lyricsLines: lyrics,
          mediaAssets: assetsToUse,
          style,
          pacing,
          beatSync,
          seed: targetSeed,
          existingClips: currentClips,
          songAnalysis: useMVStore.getState().songAnalysis
        });

        useMVStore.getState().setSongAnalysis(editResult.songAnalysis);
        useMVStore.getState().setWordTimings(editResult.wordTimings);
        useMVStore.getState().setTimelineClips(editResult.timelineClips);

        setProgress(100);
        setStatusText('Auto Edit Generated!');

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
      
      setStatusText('Media Generated. Running Auto Edit...');
      setTimeout(() => {
        handleRunBasicAutoEdit();
      }, 1000);
      
    } catch (err: any) {
      console.error(err);
      setStatusText('Pollinations.ai generation failed. Running fallback Auto Edit...');
      setTimeout(() => {
        handleRunBasicAutoEdit();
      }, 1500);
    }
  };

  const handleExportMV = () => {
    window.dispatchEvent(new CustomEvent('open-export-modal'));
  };

  const hasTimeline = useMVStore(s => s.timelineClips).length > 0;

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
            <Wand2 size={15} />
            {isProcessing ? statusText : (hasTimeline ? 'Re-Run Auto Edit' : '✦ AUTO EDIT')}
          </button>

          {hasTimeline && (
            <>
              <button
                onClick={handleRegenerate}
                disabled={isProcessing}
                className="w-full py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 relative z-10"
              >
                <RefreshCw size={12} />
                Regenerate (New Seed)
              </button>
              <button
                onClick={handleAutoFillVisuals}
                disabled={isProcessing}
                className="w-full py-1.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 relative z-10 shadow"
              >
                <ImageIcon size={12} />
                Auto Fill Missing Visuals (AI)
              </button>
            </>
          )}

          {isProcessing && (
            <div className="w-full flex flex-col gap-1 mt-1 relative z-10">
              <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300" 
                  style={{ width: `${progress}%`, backgroundColor: activeColor }} 
                />
              </div>
              <span className="text-[10px] font-mono text-center" style={{ color: activeColor }}>{statusText}</span>
            </div>
          )}
        </div>

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
