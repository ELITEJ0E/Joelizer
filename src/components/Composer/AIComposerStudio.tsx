import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Music, 
  Play, 
  Pause, 
  Download, 
  Sliders, 
  RefreshCw, 
  Check, 
  Layers, 
  Volume2, 
  ArrowRight,
  Headphones,
  FileText,
  Wand2,
  SlidersHorizontal,
  Disc3,
  Gauge,
  Activity,
  ListMusic
} from 'lucide-react';
import { MusicComposition } from '../../../server/geminiMusicComposer';
import { geminiSynthesizer } from '../../lib/geminiMusicSynthesizer';
import { useStore, LyricLine } from '../../store/useStore';
import { cn } from '../../lib/utils';

const PRESETS = [
  {
    name: 'Midnight Lo-Fi',
    emoji: '☕',
    prompt: 'Cozy midnight lofi hip hop study beat with warm electric piano, smooth mellow bass, and relaxed drum groove',
    genre: 'Lo-Fi Chillhop',
    mood: 'Nostalgic & Cozy',
    bpm: 78,
    key: 'C Major',
    duration: 30
  },
  {
    name: 'Neon Synthwave 80s',
    emoji: '🌆',
    prompt: 'Retro 80s outrun synthwave with driving detuned saw plucks, punchy 808 kick, and energetic neon chords',
    genre: 'Synthwave / Retrowave',
    mood: 'Euphoric & Energetic',
    bpm: 118,
    key: 'A Minor',
    duration: 30
  },
  {
    name: 'Sunset Acoustic Pop',
    emoji: '🌅',
    prompt: 'Uplifting acoustic pop ballad with bright piano melody, inspiring progression, and warm rhythmic percussion',
    genre: 'Acoustic Pop',
    mood: 'Uplifting & Inspiring',
    bpm: 92,
    key: 'G Major',
    duration: 30
  },
  {
    name: 'Deep Space Ambient',
    emoji: '🌌',
    prompt: 'Ethereal cinematic ambient soundscape with lush atmospheric pads, celestial plucks, and deep meditative hum',
    genre: 'Ambient / Drone',
    mood: 'Peaceful & Meditative',
    bpm: 65,
    key: 'D Minor',
    duration: 30
  },
  {
    name: 'Neo-Soul Jazz',
    emoji: '🎷',
    prompt: 'Smooth neo-soul jazz beat with lush maj7 chords, syncopated bassline, and laid-back groove',
    genre: 'Neo-Soul / Jazz',
    mood: 'Chill & Groovy',
    bpm: 84,
    key: 'F Major',
    duration: 30
  },
  {
    name: 'Cyberpunk Dark Electro',
    emoji: '⚡',
    prompt: 'Heavy dark electro cyberpunk groove with aggressive saw bass, industrial percussion, and glitchy synth sequences',
    genre: 'Cyberpunk Electro',
    mood: 'Intense & Driving',
    bpm: 125,
    key: 'E Minor',
    duration: 30
  }
];

export function AIComposerStudio() {
  const [prompt, setPrompt] = useState('Cozy midnight lofi hip hop study beat with warm electric piano, smooth bassline, and chill drums');
  const [genre, setGenre] = useState('Lo-Fi Chillhop');
  const [mood, setMood] = useState('Nostalgic & Chill');
  const [bpm, setBpm] = useState(80);
  const [key, setKey] = useState('C Major');
  const [duration, setDuration] = useState(30);
  const [includeLyrics, setIncludeLyrics] = useState(true);

  // Mixer channels
  const [channelVols, setChannelVols] = useState({
    melody: 0.85,
    chords: 0.75,
    bass: 0.95,
    drums: 0.9,
    pads: 0.65
  });

  // State
  const [isComposing, setIsComposing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [composition, setComposition] = useState<MusicComposition | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [activeStep, setActiveStep] = useState<'prompt' | 'result'>('prompt');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setActiveTab = useStore(s => s.setActiveTab);

  // Cleanup audio playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setPrompt(preset.prompt);
    setGenre(preset.genre);
    setMood(preset.mood);
    setBpm(preset.bpm);
    setKey(preset.key);
    setDuration(preset.duration);
  };

  const handleCompose = async () => {
    if (!prompt.trim()) return;

    setIsComposing(true);
    setStatusMessage('🧠 Gemini 3.7 Flash is analyzing your musical concept...');

    try {
      // 1. Request composition from server Gemini endpoint
      const response = await fetch('/api/music/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          genre,
          mood,
          bpm,
          key,
          duration,
          includeLyrics
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Composition request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.composition) {
        throw new Error(data.error || 'No composition returned from Gemini');
      }

      const compData: MusicComposition = data.composition;
      setComposition(compData);

      // 2. Synthesize audio buffer directly in browser Web Audio
      setStatusMessage('🎹 Synthesizing acoustic keys, synthwave leads, 808 bass & drum layers...');
      const audioBuffer = await geminiSynthesizer.renderComposition(compData, channelVols);

      // 3. Convert to high quality WAV Blob
      setStatusMessage('🎛️ Mastering stereo mix to 16-bit PCM WAV...');
      const wavBlob = geminiSynthesizer.audioBufferToWavBlob(audioBuffer);
      setRenderedBlob(wavBlob);

      // 4. Setup HTML5 Audio element for immediate auditioning
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.ontimeupdate = () => {
        setPlaybackTime(audio.currentTime);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };

      setIsComposing(false);
      setStatusMessage('');
      setActiveStep('result');

      // Auto play on generate
      audio.play().then(() => setIsPlaying(true)).catch(() => {});

    } catch (err: any) {
      console.error('Composition error:', err);
      setIsComposing(false);
      setStatusMessage(`Error: ${err.message || 'Composition failed'}`);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleResynthesizeMix = async () => {
    if (!composition) return;
    setIsComposing(true);
    setStatusMessage('🎚️ Applying channel volume re-balance & re-mastering...');
    try {
      const audioBuffer = await geminiSynthesizer.renderComposition(composition, channelVols);
      const wavBlob = geminiSynthesizer.audioBufferToWavBlob(audioBuffer);
      setRenderedBlob(wavBlob);

      if (audioRef.current) {
        const wasPlaying = isPlaying;
        const curTime = audioRef.current.currentTime;
        audioRef.current.pause();
        const audioUrl = URL.createObjectURL(wavBlob);
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = Math.min(curTime, composition.duration);
        if (wasPlaying) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsComposing(false);
      setStatusMessage('');
    }
  };

  const handleDownloadWav = () => {
    if (!renderedBlob || !composition) return;
    const cleanTitle = (composition.title || 'Gemini_AI_Track').replace(/[^a-zA-Z0-9_-]/g, '_');
    const url = URL.createObjectURL(renderedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadToStudio = async (targetTab: 'lrc' | 'lyrics' | 'mv-studio') => {
    if (!renderedBlob || !composition) return;

    // 1. Create File object and object URL
    const cleanTitle = (composition.title || 'Gemini_AI_Track').replace(/[^a-zA-Z0-9_-]/g, '_');
    const audioFile = new File([renderedBlob], `${cleanTitle}.wav`, { type: 'audio/wav' });
    const localAudioUrl = URL.createObjectURL(renderedBlob);

    // 2. Set audio in store
    const store = useStore.getState();
    store.setAudio(audioFile, localAudioUrl, composition.duration, null);
    store.setName(composition.title);
    store.setIsPlaying(true);

    // 3. If composition has lyrics, convert to LyricLine models
    if (composition.lyrics && composition.lyrics.length > 0) {
      const lyricLines: LyricLine[] = composition.lyrics.map((l, index) => ({
        id: `gemini-line-${index}-${Date.now()}`,
        text: l.text,
        startTime: l.startTime,
        endTime: l.startTime + l.duration,
        words: l.text.split(/\s+/).map((w, wIdx, arr) => {
          const wDur = l.duration / Math.max(1, arr.length);
          return {
            id: `w-${index}-${wIdx}`,
            word: w,
            startTime: l.startTime + wIdx * wDur,
            endTime: l.startTime + (wIdx + 1) * wDur
          };
        })
      }));

      store.updateLyricsSettings({
        lines: lyricLines
      });
    }

    // 4. Navigate to target studio tab
    setActiveTab(targetTab);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#07090e] text-slate-200 overflow-y-auto custom-scrollbar">
      
      {/* Studio Header Banner */}
      <div className="border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-black/60 px-4 sm:px-8 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shadow-lg shadow-emerald-500/20 shrink-0">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Gemini AI Music Composer
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                100% Free AI Audio
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate full multi-track instrumental backing tracks and rhythm-locked lyrics with Gemini 3.7 Flash & Studio Web Audio
            </p>
          </div>
        </div>

        {/* Action / State Indicators */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end">
          {composition && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStep(activeStep === 'prompt' ? 'result' : 'prompt')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {activeStep === 'prompt' ? <Disc3 size={14} className="text-emerald-400" /> : <Wand2 size={14} className="text-emerald-400" />}
                <span>{activeStep === 'prompt' ? 'View Composed Track' : 'Back to Prompt Settings'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: Prompt, Style, Presets & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Quick Inspiration Presets */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Wand2 size={14} className="text-emerald-400" /> Quick Genre Presets
              </span>
              <span className="text-[11px] text-slate-500">Click to load musical prompt</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all group cursor-pointer relative overflow-hidden",
                    genre === p.genre 
                      ? "bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm" 
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-300 hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>{p.emoji}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <span>{p.bpm} BPM</span>
                    <span>•</span>
                    <span>{p.key}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Music Prompt / Vibe Description</span>
                <span className="text-[10px] text-emerald-400 font-mono font-normal">Gemini 3.7 AI</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your track vibe, instruments, chord feelings, tempo..."
                rows={3}
                className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition-colors custom-scrollbar"
              />
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Lo-Fi Chillhop">Lo-Fi Chillhop</option>
                  <option value="Synthwave / Retrowave">Synthwave</option>
                  <option value="Acoustic Pop">Acoustic Pop</option>
                  <option value="Ambient / Drone">Ambient</option>
                  <option value="Neo-Soul / Jazz">Neo-Soul Jazz</option>
                  <option value="Cyberpunk Electro">Cyberpunk</option>
                  <option value="Cinematic Orchestral">Orchestral</option>
                  <option value="Trap / Hip-Hop">Trap / Hip-Hop</option>
                  <option value="House / EDM">House / EDM</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mood</label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Tempo: <span className="text-emerald-400 font-bold">{bpm} BPM</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="160"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={15}>15s (Short Loop)</option>
                  <option value={30}>30s (Standard Preview)</option>
                  <option value={45}>45s (Extended Verse/Chorus)</option>
                  <option value={60}>60s (Full Track)</option>
                </select>
              </div>
            </div>

            {/* Key & Lyrics Options */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Musical Key:</span>
                <select
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="bg-black/50 border border-white/15 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {['C Major', 'G Major', 'D Major', 'A Major', 'F Major', 'A Minor', 'E Minor', 'D Minor', 'B Minor'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={includeLyrics}
                  onChange={(e) => setIncludeLyrics(e.target.checked)}
                  className="rounded accent-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-slate-300">Generate rhyming synchronized lyrics</span>
              </label>
            </div>

            {/* Compose CTA Button */}
            <button
              onClick={handleCompose}
              disabled={isComposing || !prompt.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-sm tracking-wide shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isComposing ? (
                <>
                  <RefreshCw size={18} className="animate-spin text-black" />
                  <span>Composing with Gemini 3.7 Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} className="text-black" />
                  <span>Generate AI Music Track</span>
                </>
              )}
            </button>

            {/* Status Progress text */}
            {statusMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-pulse">
                <Activity size={15} className="shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: Player, Mixer & Direct Studio Actions (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">

          {composition && renderedBlob ? (
            <div className="bg-white/[0.03] border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-5">
              
              {/* Header Info */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Generated Composition
                  </span>
                  <h3 className="text-base font-black text-white mt-1.5">{composition.title}</h3>
                  <p className="text-xs text-slate-400">
                    {composition.genre} • {composition.bpm} BPM • {composition.key}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Headphones size={20} />
                </div>
              </div>

              {/* Interactive Player Card */}
              <div className="bg-black/60 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleTogglePlay}
                    className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                  </button>

                  <div className="flex-1 ml-4 space-y-1">
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span className="text-emerald-400 font-bold">{playbackTime.toFixed(1)}s</span>
                      <span>{composition.duration}s</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-100"
                        style={{ width: `${(playbackTime / (composition.duration || 30)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5">
                  <span>Chords: <strong className="text-slate-200">{composition.chords?.map(c => c.chord).slice(0, 4).join(' → ')}</strong></span>
                  <span className="text-emerald-400 font-mono">16-bit PCM Stereo</span>
                </div>
              </div>

              {/* Multi-Track Channel Mixer */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders size={13} className="text-emerald-400" /> Multi-Track Channel Mixer
                  </span>
                  <button
                    onClick={handleResynthesizeMix}
                    disabled={isComposing}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Apply Mix
                  </button>
                </div>

                {(Object.keys(channelVols) as Array<keyof typeof channelVols>).map((ch) => (
                  <div key={ch} className="flex items-center gap-2 text-xs">
                    <span className="w-16 capitalize text-slate-400 text-[11px]">{ch}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={channelVols[ch]}
                      onChange={(e) =>
                        setChannelVols({ ...channelVols, [ch]: parseFloat(e.target.value) })
                      }
                      className="flex-1 accent-emerald-500 h-1 bg-white/10 rounded cursor-pointer"
                    />
                    <span className="w-8 text-right text-slate-400 text-[10px] font-mono">
                      {Math.round(channelVols[ch] * 100)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Lyrics Preview */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3.5 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText size={13} className="text-emerald-400" /> Synchronized Lyrics ({composition.lyrics?.length || 0} lines)
                </span>
                {composition.lyrics && composition.lyrics.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {composition.lyrics.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {line.startTime.toFixed(1)}s
                        </span>
                        <span className="text-slate-300">{line.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Instrumental track (no lyrics).</p>
                )}
              </div>

              {/* Action Buttons to Load into Studio */}
              <div className="pt-2 space-y-2 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLoadToStudio('lrc')}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <span>🎯 Send to LRC Studio</span>
                  </button>

                  <button
                    onClick={() => handleLoadToStudio('lyrics')}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <span>🎬 Send to Lyrics Video</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLoadToStudio('mv-studio')}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>🎞️ Send to MV Studio</span>
                  </button>

                  <button
                    onClick={handleDownloadWav}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download .WAV</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* Empty state when no composition yet */
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 text-center space-y-3 h-full flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Disc3 size={32} className="animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No Track Composed Yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Choose a preset or type a prompt on the left, then click <strong>Generate AI Music Track</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
