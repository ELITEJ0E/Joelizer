import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { generateAutoEdit } from '../../lib/mvAutoEdit';
import { Wand2, RefreshCw, Cpu, Download, Settings, Sliders, Key, Sparkles, CheckCircle2 } from 'lucide-react';

export function MVWorkflow() {
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
  const geminiKey = useMVStore(s => s.geminiKey);
  const setGeminiKey = useMVStore(s => s.setGeminiKey);
  const useGemini = useMVStore(s => s.useGemini);
  const setUseGemini = useMVStore(s => s.setUseGemini);

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
            mediaType: 'image' as const,
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

  // 2. Advanced Local AI Enhancement (When Local Engine on Port 4000 is Online)
  const handleRunAdvancedLocalAI = async () => {
    if (!localEngineConnected) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Sending Audio to Local WhisperX Engine...');

    try {
      const formData = new FormData();
      if (useStore.getState().audioFile) {
        formData.append('audio', useStore.getState().audioFile!);
      } else if (audioUrl) {
        const res = await fetch(audioUrl);
        const blob = await res.blob();
        formData.append('audio', blob, 'song.mp3');
      }
      formData.append('rawLyrics', lyrics.map(l => l.text).join('\n'));

      const audioRes = await fetch('http://localhost:4000/api/mv/analyze-audio', {
        method: 'POST',
        body: formData
      });
      const audioData = await audioRes.json();

      setProgress(60);
      setStatusText('Processing WhisperX Alignment & Beat Mapping...');

      if (audioData.sections) {
        useMVStore.getState().setSongAnalysis(audioData);
      }
      if (audioData.wordTimings) {
        useMVStore.getState().setWordTimings(audioData.wordTimings);
      }

      setProgress(85);
      setStatusText('Refining Timeline Cuts...');

      // Re-run auto edit with improved audio analysis
      handleRunBasicAutoEdit();
    } catch (err) {
      console.error(err);
      setStatusText('Local AI enhancement failed. Reverting to Basic Auto Edit.');
      setTimeout(() => {
        handleRunBasicAutoEdit();
      }, 1000);
    }
  };

  // 3. Export Handling
  const handleExportMV = async () => {
    setIsProcessing(true);
    setProgress(20);
    setStatusText('Preparing Export Manifest...');

    if (localEngineConnected) {
      try {
        const exportRes = await fetch('http://localhost:4000/api/mv/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timelineClips: useMVStore.getState().timelineClips,
            videoAssets,
            outputPath: `joelizer-mv-${Date.now()}.mp4`
          })
        });
        const exportData = await exportRes.json();

        setProgress(100);
        setStatusText('Export Triggered in Local Engine!');
        setTimeout(() => {
          setIsProcessing(false);
          alert(`Export job sent to local FFmpeg engine: ${exportData.path || 'joelizer-export.mp4'}`);
        }, 1000);
      } catch (err) {
        console.error(err);
        setIsProcessing(false);
        alert('Local FFmpeg export failed.');
      }
    } else {
      // Offline Browser Export / Manifest Download
      setTimeout(() => {
        const manifest = {
          songUrl: audioUrl,
          timelineClips: useMVStore.getState().timelineClips,
          wordTimings: useMVStore.getState().wordTimings,
          exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `joelizer-mv-timeline-${Date.now()}.json`;
        link.click();

        setProgress(100);
        setStatusText('Timeline Manifest Downloaded!');
        setTimeout(() => setIsProcessing(false), 800);
      }, 1000);
    }
  };

  const hasTimeline = useMVStore(s => s.timelineClips).length > 0;

  return (
    <div className="flex flex-col h-full bg-[#08080c] text-slate-300">
      {/* Title */}
      <div className="p-3 border-b border-white/10 flex items-center gap-2 text-white text-xs font-bold tracking-widest uppercase">
        <Sliders size={14} className="text-purple-400" />
        Auto Editor Controls
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Main Action Section */}
        <div className="bg-gradient-to-b from-purple-900/30 to-black/60 p-3.5 rounded-lg border border-purple-500/30 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" />
              Music Video Auto Edit
            </span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
              READY
            </span>
          </div>

          <button
            onClick={() => handleRunBasicAutoEdit()}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            <Wand2 size={15} />
            {isProcessing ? statusText : (hasTimeline ? 'Re-Run Auto Edit' : '✦ AUTO EDIT')}
          </button>

          {hasTimeline && (
            <button
              onClick={handleRegenerate}
              disabled={isProcessing}
              className="w-full py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} />
              Regenerate (New Seed)
            </button>
          )}

          {isProcessing && (
            <div className="w-full flex flex-col gap-1 mt-1">
              <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <span className="text-[10px] text-purple-300 font-mono text-center">{statusText}</span>
            </div>
          )}
        </div>

        {/* Style & Pacing Settings */}
        <div className="space-y-3 bg-white/5 p-3 rounded border border-white/10">
          <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Settings size={13} className="text-purple-400" />
            Editing Aesthetics
          </h4>

          {/* Style Preset */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Visual Style</label>
            <select 
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="bg-black/60 border border-white/20 rounded p-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="Cinematic">Cinematic Montage</option>
              <option value="Performance">Performance Focus</option>
              <option value="K-pop">K-pop Fast Cut</option>
              <option value="Y2K">Y2K / Glitch Aesthetic</option>
              <option value="Dreamy">Dreamy & Slow Motion</option>
            </select>
          </div>

          {/* Pacing */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Cutting Pacing</label>
            <div className="grid grid-cols-3 gap-1">
              {['Slow', 'Balanced', 'Fast'].map(p => (
                <button
                  key={p}
                  onClick={() => setPacing(p)}
                  className={`py-1 text-[10px] font-bold rounded border transition-colors ${
                    pacing === p 
                      ? 'bg-purple-600 border-purple-400 text-white' 
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
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
                  onClick={() => setBeatSync(b)}
                  className={`py-1 text-[10px] font-bold rounded border transition-colors ${
                    beatSync === b 
                      ? 'bg-purple-600 border-purple-400 text-white' 
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
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

        {/* Optional Local Engine Enhancement */}
        <div className="bg-white/5 p-3 rounded border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={13} className={localEngineConnected ? 'text-emerald-400' : 'text-slate-500'} />
              Advanced Local AI
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              localEngineConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {localEngineConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            {localEngineConnected 
              ? 'Local engine on port 4000 active for WhisperX word-level lyrics alignment.'
              : 'Optional. Start the Joelizer local server on port 4000 to enable WhisperX alignment.'}
          </p>

          <button
            onClick={handleRunAdvancedLocalAI}
            disabled={!localEngineConnected || isProcessing}
            className="w-full py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Sparkles size={12} />
            Enhance Edit with Local AI
          </button>
        </div>

        {/* Optional Gemini Intelligence */}
        <div className="bg-white/5 p-3 rounded border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Key size={13} className="text-purple-400" />
              Gemini AI (BYOK)
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={useGemini} 
                onChange={(e) => setUseGemini(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {useGemini && (
            <input 
              type="password" 
              placeholder="Enter Gemini API Key..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded p-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          )}
        </div>
      </div>

      {/* Footer / Export Button */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <button 
          onClick={handleExportMV}
          disabled={!hasTimeline || isProcessing}
          className="w-full py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold tracking-widest uppercase transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          {localEngineConnected ? 'Export Local FFmpeg' : 'Export Timeline / Manifest'}
        </button>
      </div>
    </div>
  );
}
