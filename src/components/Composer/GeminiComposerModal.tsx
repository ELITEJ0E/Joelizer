import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Music, 
  Play, 
  Pause, 
  Download, 
  Sliders, 
  RefreshCw, 
  X, 
  Check, 
  Layers, 
  Volume2, 
  ArrowRight,
  Headphones,
  FileText
} from 'lucide-react';
import { MusicComposition } from '../../../server/geminiMusicComposer';
import { geminiSynthesizer } from '../../lib/geminiMusicSynthesizer';
import { useStore, LyricLine } from '../../store/useStore';

interface GeminiComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  }
];

export function GeminiComposerModal({ isOpen, onClose }: GeminiComposerModalProps) {
  const [prompt, setPrompt] = useState('Cozy midnight lofi hip hop study beat with warm electric piano and chill groove');
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setPrompt(preset.prompt);
    setGenre(preset.genre);
    setMood(preset.mood);
    setBpm(preset.bpm);
    setKey(preset.key);
    setDuration(preset.duration);
  };

  const handleGenerate = async () => {
    setIsComposing(true);
    setStatusMessage('Prompting Gemini AI Composer for chord progressions & melody...');
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      // 1. Call server API
      const res = await fetch('/api/music/compose', {
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Composition request failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.composition) {
        throw new Error(data.error || 'No composition returned from Gemini');
      }

      const comp: MusicComposition = data.composition;
      setComposition(comp);

      // 2. Synthesize audio buffer in-browser via Web Audio
      setStatusMessage('Synthesizing instrument channels & mastering stereo audio...');
      const audioBuffer = await geminiSynthesizer.renderComposition(comp, channelVols);
      const wavBlob = geminiSynthesizer.audioBufferToWavBlob(audioBuffer);

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const newUrl = URL.createObjectURL(wavBlob);

      setRenderedBlob(wavBlob);
      setAudioUrl(newUrl);
      setStatusMessage('');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setStatusMessage(`Error: ${err.message || 'Generation failed'}`);
    } finally {
      setIsComposing(false);
    }
  };

  const handleResynthesizeMix = async () => {
    if (!composition) return;
    setIsComposing(true);
    setStatusMessage('Re-rendering mix with new channel volumes...');
    try {
      const audioBuffer = await geminiSynthesizer.renderComposition(composition, channelVols);
      const wavBlob = geminiSynthesizer.audioBufferToWavBlob(audioBuffer);

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const newUrl = URL.createObjectURL(wavBlob);

      setRenderedBlob(wavBlob);
      setAudioUrl(newUrl);
      setStatusMessage('');
    } catch (err: any) {
      console.error('Re-synth Error:', err);
      setStatusMessage(`Error: ${err.message || 'Synthesis failed'}`);
    } finally {
      setIsComposing(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  // Export to Joelizer Studio
  const handleLoadToStudio = async (targetTab: 'lrc' | 'lyrics') => {
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
    store.setActiveTab(targetTab);
    onClose();
  };

  const handleDownloadWav = () => {
    if (!renderedBlob || !composition) return;
    const cleanTitle = (composition.title || 'Gemini_Track').replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(renderedBlob);
    a.download = `${cleanTitle}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#121620] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Gemini AI Music Composer
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  100% Free & Unlimited
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Compose full multitrack musical arrangements, rhythm beats, harmonies, and lyrics with Gemini 3.7 & Web Audio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Preset Quick Chips */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Inspiration Styles
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(p)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-emerald-500/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <span>{p.emoji}</span>
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt & Style Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Prompt */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Music Prompt & Style Description
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your desired vibe, instruments, chord feelings, or atmosphere..."
                rows={3}
                className="w-full bg-black/40 border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 resize-none outline-none transition-all"
              />
            </div>

            {/* Tempo & Duration Controls */}
            <div className="space-y-3 bg-white/[0.02] border border-white/10 p-3 rounded-xl">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Tempo (BPM)</span>
                  <span className="font-bold text-emerald-400">{bpm} BPM</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="150"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Duration</span>
                  <span className="font-bold text-emerald-400">{duration}s</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setDuration(sec)}
                      className={`py-1 text-xs rounded-lg font-medium transition-all ${
                        duration === sec
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-xs text-slate-300">Generate Lyrics</span>
                <input
                  type="checkbox"
                  checked={includeLyrics}
                  onChange={(e) => setIncludeLyrics(e.target.checked)}
                  className="rounded accent-emerald-500 cursor-pointer w-4 h-4"
                />
              </div>
            </div>

          </div>

          {/* Genre, Mood & Key Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Mood</label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Key & Scale</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500/60"
              >
                <option value="C Major">C Major</option>
                <option value="A Minor">A Minor</option>
                <option value="G Major">G Major</option>
                <option value="E Minor">E Minor</option>
                <option value="D Major">D Major</option>
                <option value="B Minor">B Minor</option>
                <option value="F Major">F Major</option>
                <option value="D Minor">D Minor</option>
                <option value="Bb Major">Bb Major</option>
                <option value="Eb Major">Eb Major</option>
                <option value="F# Minor">F# Minor</option>
              </select>
            </div>
          </div>

          {/* Action Generate Button */}
          <div>
            <button
              onClick={handleGenerate}
              disabled={isComposing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isComposing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>{statusMessage || 'Composing with Gemini AI...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Compose & Synthesize Audio Now</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Track Output Card */}
          {composition && (
            <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Music size={16} className="text-emerald-400" />
                    {composition.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{composition.genre}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{composition.bpm} BPM</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{composition.key}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{composition.duration}s</span>
                  </div>
                </div>

                {/* Main Play / Pause Button */}
                {audioUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlayback}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                      <span>{isPlaying ? 'Pause' : 'Play Audio'}</span>
                    </button>
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                    />
                  </div>
                )}
              </div>

              {/* Composition Breakdown: Channels & Lyrics Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Channel Mixer */}
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Sliders size={13} className="text-emerald-400" /> Instrument Channel Balance
                    </span>
                    <button
                      onClick={handleResynthesizeMix}
                      disabled={isComposing}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      Apply Volume Changes
                    </button>
                  </div>

                  {(Object.keys(channelVols) as Array<keyof typeof channelVols>).map((ch) => (
                    <div key={ch} className="flex items-center gap-2 text-xs">
                      <span className="w-16 capitalize text-slate-400">{ch}</span>
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
                      <span className="w-8 text-right text-slate-400 text-[10px]">
                        {Math.round(channelVols[ch] * 100)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Synchronized Lyrics Preview */}
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                    <FileText size={13} className="text-emerald-400" /> Synchronized Lyrics ({composition.lyrics?.length || 0} lines)
                  </span>
                  {composition.lyrics && composition.lyrics.length > 0 ? (
                    <div className="space-y-1.5">
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
                    <p className="text-xs text-slate-500 italic">Instrumental track (no lyrics generated).</p>
                  )}
                </div>

              </div>

              {/* Action Buttons to Send to Studios */}
              <div className="pt-2 flex flex-wrap gap-2 justify-end border-t border-white/10">
                <button
                  onClick={handleDownloadWav}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download .WAV</span>
                </button>

                <button
                  onClick={() => handleLoadToStudio('lrc')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <span>🎯 Load into LRC Studio</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  onClick={() => handleLoadToStudio('lyrics')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <span>🎬 Create Lyrics Video</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
