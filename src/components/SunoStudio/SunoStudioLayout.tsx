import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, GeneratedTrack } from '../../store/useMVStore';
import { 
  Sparkles, Music, Wand2, Sliders, Play, Pause, Download, Heart, Trash2, 
  Search, Filter, List, Grid, RotateCcw, Volume2, Plus, Disc, Share2, 
  Layers, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ShieldCheck, 
  Clock, ArrowUpRight, Zap
} from 'lucide-react';

export function SunoStudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setAudio = useStore(s => s.setAudio);
  const isPlaying = useStore(s => s.isPlaying);
  const activeAudioUrl = useStore(s => s.audioUrl);
  const setActiveTab = useStore(s => s.setActiveTab);

  const prompt = useMVStore(s => s.aiMusicPrompt);
  const setPrompt = useMVStore(s => s.setAiMusicPrompt);
  const lyrics = useMVStore(s => s.aiMusicLyrics);
  const setLyrics = useMVStore(s => s.setAiMusicLyrics);
  const duration = useMVStore(s => s.aiMusicDuration);
  const setDuration = useMVStore(s => s.setAiMusicDuration);
  const status = useMVStore(s => s.aiMusicStatus);
  const statusText = useMVStore(s => s.aiMusicStatusText);
  const setStatus = useMVStore(s => s.setAiMusicStatus);
  const resultUrl = useMVStore(s => s.aiMusicResultUrl);
  const setResultUrl = useMVStore(s => s.setAiMusicResultUrl);
  const errorMsg = useMVStore(s => s.aiMusicError);
  const setErrorMsg = useMVStore(s => s.setAiMusicError);

  const generatedTracks = useMVStore(s => s.generatedTracks);
  const addGeneratedTrack = useMVStore(s => s.addGeneratedTrack);
  const toggleLikeTrack = useMVStore(s => s.toggleLikeGeneratedTrack);
  const deleteTrack = useMVStore(s => s.deleteGeneratedTrack);
  const updateGeneratedTrackCover = useMVStore(s => s.updateGeneratedTrackCover);
  const timelineClips = useMVStore(s => s.timelineClips);
  const setTimelineClips = useMVStore(s => s.setTimelineClips);

  // Local state
  const [mode, setMode] = useState<'simple' | 'custom'>('simple');
  const [model, setModel] = useState<string>('ACE-Step v1.5');
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vocal' | 'instrumental' | 'liked'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [progress, setProgress] = useState(0);
  const [showLyricsMap, setShowLyricsMap] = useState<Record<string, boolean>>({});
  const [loadedNotice, setLoadedNotice] = useState<string | null>(null);

  const sampleCovers = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80'
  ];

  const inspoTags = [
    { label: '+ Synthwave', text: 'Upbeat 80s synthwave electronic track with driving bassline, retro arp synths, and punchy drums' },
    { label: '+ Lo-Fi Chill', text: 'Relaxing lo-fi hip hop beat with warm electric piano chords, vinyl crackle, and chill bass' },
    { label: '+ Cinematic', text: 'Epic cinematic orchestral soundscape with building strings, brass, and powerful climax' },
    { label: '+ K-Pop Pop', text: 'High-energy K-Pop dance track with catchy vocal chops, bouncy bass, and vibrant synths' },
    { label: '+ Ambient Vox', text: 'Atmospheric ambient chillout soundscape with soaring vocal pads and soothing reverb' }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus('generating', 'CONNECTING TO ACE-STEP AI SPACE (30-60S COLD START)...');
    setErrorMsg(null);
    setProgress(15);

    const interval = setInterval(() => {
      setProgress(prev => (prev >= 90 ? 90 : prev + 4));
    }, 1200);

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          lyrics: isInstrumental ? '' : lyrics.trim(),
          duration
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate music');
      }

      const generatedUrl = data.audioUrl;
      const trackDuration = data.duration || duration;

      setProgress(100);
      setStatus('ready', 'SONG READY!');
      setResultUrl(generatedUrl);

      // Extract tags
      const promptLower = prompt.toLowerCase();
      const tags: string[] = [];
      if (promptLower.includes('synth') || promptLower.includes('electronic')) tags.push('Synthwave');
      if (promptLower.includes('lo-fi') || promptLower.includes('chill')) tags.push('Lo-Fi');
      if (promptLower.includes('pop') || promptLower.includes('k-pop')) tags.push('Pop');
      if (promptLower.includes('cinematic') || promptLower.includes('epic')) tags.push('Cinematic');
      if (isInstrumental) tags.push('Instrumental');
      else tags.push('Vocal');

      const randomCover = sampleCovers[Math.floor(Math.random() * sampleCovers.length)];

      const newTrack: GeneratedTrack = {
        id: `track-${Date.now()}`,
        title: prompt.slice(0, 32).trim() || 'AI Generated Track',
        prompt: prompt.trim(),
        lyrics: isInstrumental ? undefined : lyrics.trim(),
        duration: trackDuration,
        audioUrl: generatedUrl,
        createdAt: Date.now(),
        tags: tags.length ? tags : ['AI Track'],
        model,
        coverUrl: randomCover,
        isLiked: false
      };

      addGeneratedTrack(newTrack);

      // Auto load as active song
      handleSetMainAudio(newTrack);

    } catch (err: any) {
      clearInterval(interval);
      console.error('Music Generation Failed:', err);
      setStatus('error', 'GENERATION FAILED');
      setErrorMsg(err?.message || 'Failed to connect to ACE-Step model Space. Please retry.');
      setProgress(0);
    }
  };

  const handleSetMainAudio = async (track: GeneratedTrack) => {
    try {
      const audioRes = await fetch(track.audioUrl);
      const audioBlob = await audioRes.blob();
      setAudio(audioBlob, track.audioUrl, track.duration, track.coverUrl);
    } catch {
      setAudio(null as any, track.audioUrl, track.duration, track.coverUrl);
    }
    showNotification(`Loaded "${track.title}" as active studio audio!`);
  };

  const handleAddToTimeline = (track: GeneratedTrack) => {
    const newClip = {
      id: `aud-${Date.now()}`,
      assetId: track.id,
      startTime: 0,
      endTime: track.duration,
      trimStart: 0,
      trimEnd: track.duration,
      locked: false
    };

    setTimelineClips([...timelineClips, newClip]);
    handleSetMainAudio(track);
    showNotification(`Added "${track.title}" to MV Studio Timeline!`);
  };

  const showNotification = (msg: string) => {
    setLoadedNotice(msg);
    setTimeout(() => setLoadedNotice(null), 3500);
  };

  const generateRandomLyrics = () => {
    const samples = [
      `[Verse 1]\nNeon lights in the cyber rain\nChasing shadows across the frame\nEvery beat is a pulse in time\nElectric energy in your mind\n\n[Chorus]\nFly away into the synthwave sky\nWe live forever, you and I`,
      `[Verse 1]\nWhispers in the quiet room\nChasing dreams beneath the moon\nLo-fi vinyl spinning slow\nWhere the chill beat starts to flow\n\n[Chorus]\nLost inside this aesthetic vibe\nNothing left for us to hide`,
      `[Verse 1]\nRising up from the dark night\nStanding tall in the spotlight\nHeart is pounding like a drum\nOur golden hour has finally come\n\n[Chorus]\nShine bright, break through the wall\nTogether we stand, we never fall`
    ];
    setLyrics(samples[Math.floor(Math.random() * samples.length)]);
  };

  // Filter & Search Logic
  const filteredTracks = generatedTracks
    .filter(t => {
      if (activeFilter === 'vocal') return !t.tags.includes('Instrumental');
      if (activeFilter === 'instrumental') return t.tags.includes('Instrumental');
      if (activeFilter === 'liked') return t.isLiked;
      return true;
    })
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q) ||
        (t.lyrics && t.lyrics.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return b.createdAt - a.createdAt;
    });

  const isGenerating = status === 'generating';

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#08080a] text-slate-200 overflow-hidden select-none font-sans">
      {/* Toast Notification Banner */}
      {loadedNotice && (
        <div 
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider text-black shadow-2xl flex items-center gap-2 animate-bounce"
          style={{ backgroundColor: activeColor, borderColor: '#ffffff', boxShadow: `0 0 20px ${activeColor}` }}
        >
          <Zap size={15} />
          {loadedNotice}
        </div>
      )}

      {/* LEFT CONTROL PANEL (Suno-style Generation Panel) */}
      <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-white/10 flex flex-col bg-[#0b0c10] overflow-y-auto">
        {/* Top Header & Mode Toggle */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          {/* Simple vs Custom (Advanced) Switcher */}
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 gap-1">
            <button
              onClick={() => setMode('simple')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                mode === 'simple' ? 'bg-white/15 text-white shadow font-black' : 'text-slate-400 hover:text-white'
              }`}
              style={mode === 'simple' ? { color: activeColor } : {}}
            >
              Simple
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                mode === 'custom' ? 'bg-white/15 text-white shadow font-black' : 'text-slate-400 hover:text-white'
              }`}
              style={mode === 'custom' ? { color: activeColor } : {}}
            >
              Custom
            </button>
          </div>

          {/* Model Selector Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black border border-white/15 text-[10px] font-mono font-bold text-slate-300">
            <ShieldCheck size={12} style={{ color: activeColor }} />
            <span>{model}</span>
          </div>
        </div>

        {/* Panel Form Inputs */}
        <div className="p-4 space-y-4 flex-1">
          {/* Quick Preset Chips */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Quick Inspiration
            </span>
            <div className="flex flex-wrap gap-1">
              {inspoTags.map(tag => (
                <button
                  key={tag.label}
                  onClick={() => setPrompt(tag.text)}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-slate-300 transition-colors hover:text-white"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Mode Inputs */}
          {mode === 'simple' ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Music size={13} style={{ color: activeColor }} />
                Song Description
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe style, genre, mood, instruments, tempo..."
                rows={4}
                className="w-full bg-black/80 border border-white/15 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 resize-none font-sans leading-relaxed"
              />
            </div>
          ) : (
            /* Custom (Advanced) Mode Inputs */
            <div className="space-y-4">
              {/* Lyrics Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Wand2 size={13} style={{ color: activeColor }} />
                    Lyrics
                  </label>
                  <button
                    onClick={generateRandomLyrics}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30"
                  >
                    <Sparkles size={11} /> Auto-Generate
                  </button>
                </div>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder="Enter custom lyrics with structure like [Verse], [Chorus]..."
                  rows={5}
                  className="w-full bg-black/80 border border-white/15 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Style Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} style={{ color: activeColor }} />
                  Style of Music
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., K-pop synthwave, female vocals, 128 bpm"
                  className="w-full bg-black/80 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Instrumental Toggle */}
              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/10">
                <span className="text-xs font-bold text-slate-300">Instrumental Only</span>
                <button
                  onClick={() => setIsInstrumental(!isInstrumental)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-1 ${
                    isInstrumental ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isInstrumental ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Song Duration
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[15, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="py-1.5 rounded-md border text-xs font-bold transition-all text-center"
                  style={
                    duration === d
                      ? { backgroundColor: activeColor, borderColor: activeColor, color: '#000' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }
                  }
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Create Action Footer */}
        <div className="p-4 border-t border-white/10 bg-black/60 space-y-3">
          {/* Status / Error Notifications */}
          {isGenerating && (
            <div className="space-y-1">
              <div className="w-full bg-black/80 h-1.5 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full transition-all duration-300 animate-pulse"
                  style={{ width: `${progress}%`, backgroundColor: activeColor }}
                />
              </div>
              <p className="text-[10px] font-mono text-center text-emerald-400 font-bold">
                {statusText} ({progress}%)
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Suno-Style Large Create Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3.5 rounded-xl text-black font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            style={{ 
              backgroundColor: activeColor,
              boxShadow: `0 0 25px ${activeColor}50` 
            }}
          >
            <Sparkles size={18} />
            {isGenerating ? statusText : '✨ CREATE SONG'}
          </button>

          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1">
            <span>⚡ ACE-Step v1.5 DiT Engine</span>
            <span>Unlimited Generations</span>
          </div>
        </div>
      </div>

      {/* RIGHT WORKSPACE AREA (Suno Library & Song Feed) */}
      <div className="flex-1 flex flex-col h-full bg-[#050507] overflow-hidden">
        {/* Workspace Top Bar */}
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#08080c]">
          {/* Breadcrumb Header */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400">Workspaces &gt;</span>
            <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Disc size={16} style={{ color: activeColor }} />
              My Generated Songs
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono font-bold text-emerald-400">
              {filteredTracks.length} Tracks
            </span>
          </div>

          {/* Search, Filters, View Modes */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tracks or prompt..."
                className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
              {(['all', 'vocal', 'instrumental', 'liked'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    activeFilter === f ? 'bg-white/20 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                  style={activeFilter === f ? { color: activeColor } : {}}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-white/20 text-white' : 'text-slate-500'}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-slate-500'}`}
              >
                <Grid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tracks List / Grid Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredTracks.length === 0 ? (
            /* Empty State Hero */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div 
                className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 bg-black/40 shadow-2xl"
                style={{ borderColor: `${activeColor}50` }}
              >
                <Music size={32} style={{ color: activeColor }} />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">
                No Songs Generated Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                Enter a song description on the left panel or click one of the inspiration presets to craft your first AI music track using ACE-Step v1.5!
              </p>
              <button
                onClick={() => setPrompt('Upbeat electronic synthwave pop track with heavy bass drop')}
                className="px-5 py-2.5 rounded-xl text-black font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2"
                style={{ backgroundColor: activeColor }}
              >
                <Sparkles size={14} />
                Generate Sample Track
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW (Matching Suno's track rows) */
            <div className="space-y-2">
              {filteredTracks.map(track => {
                const isCurrentlyPlaying = activeAudioUrl === track.audioUrl && isPlaying;
                const isLyricsExpanded = !!showLyricsMap[track.id];

                return (
                  <div
                    key={track.id}
                    className="p-3.5 rounded-xl border border-white/10 bg-[#0d0e14] hover:border-white/20 transition-all flex flex-col gap-3 group relative"
                  >
                    {/* Main Row */}
                    <div className="flex items-center gap-3">
                      {/* Cover Art with Play & Change Cover Overlay */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10 group-hover:border-white/30">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleSetMainAudio(track)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white"
                        >
                          {isCurrentlyPlaying ? (
                            <Pause size={20} style={{ color: activeColor }} />
                          ) : (
                            <Play size={20} className="ml-0.5" style={{ color: activeColor }} />
                          )}
                        </button>
                        <label
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/80 hover:bg-black text-slate-300 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Change Track Cover"
                        >
                          <Disc size={11} />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  if (evt.target?.result) {
                                    updateGeneratedTrackCover(track.id, evt.target.result as string);
                                    showNotification(`Updated cover for "${track.title}"!`);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 rounded text-[9px] font-mono text-white">
                          0:{track.duration < 10 ? `0${track.duration}` : track.duration}
                        </span>
                      </div>

                      {/* Song Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-white truncate">{track.title}</h4>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-slate-300">
                            {track.model}
                          </span>
                          {track.tags.map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              {t}
                            </span>
                          ))}
                        </div>

                        <p className="text-xs text-slate-400 truncate mt-1 leading-relaxed">
                          {track.prompt}
                        </p>

                        {/* Expand Lyrics Toggle */}
                        {track.lyrics && (
                          <button
                            onClick={() => setShowLyricsMap(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
                            className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 mt-1"
                          >
                            <span>Lyrics</span>
                            {isLyricsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Play Now / Set Main */}
                        <button
                          onClick={() => handleSetMainAudio(track)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all bg-white/5 border-white/15 hover:bg-white/15"
                          style={isCurrentlyPlaying ? { color: activeColor, borderColor: activeColor } : {}}
                        >
                          {isCurrentlyPlaying ? <Pause size={13} /> : <Play size={13} />}
                          <span>{isCurrentlyPlaying ? 'Playing' : 'Play'}</span>
                        </button>

                        {/* Load to Timeline AUD Track Button */}
                        <button
                          onClick={() => handleAddToTimeline(track)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <Layers size={13} />
                          <span>+ Timeline</span>
                        </button>

                        {/* Like Toggle */}
                        <button
                          onClick={() => toggleLikeTrack(track.id)}
                          className={`p-2 rounded-lg border transition-colors ${
                            track.isLiked
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Heart size={14} className={track.isLiked ? 'fill-current' : ''} />
                        </button>

                        {/* Download MP3 */}
                        <a
                          href={track.audioUrl}
                          download={`${track.title}.mp3`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Download MP3"
                        >
                          <Download size={14} />
                        </a>

                        {/* Delete Track */}
                        <button
                          onClick={() => deleteTrack(track.id)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Track"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Lyrics Block */}
                    {isLyricsExpanded && track.lyrics && (
                      <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {track.lyrics}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* GRID VIEW (Card Grid) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTracks.map(track => {
                const isCurrentlyPlaying = activeAudioUrl === track.audioUrl && isPlaying;

                return (
                  <div
                    key={track.id}
                    className="p-4 rounded-xl border border-white/10 bg-[#0d0e14] hover:border-white/20 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      {/* Card Cover */}
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 mb-3">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleSetMainAudio(track)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          {isCurrentlyPlaying ? (
                            <Pause size={28} style={{ color: activeColor }} />
                          ) : (
                            <Play size={28} className="ml-1" style={{ color: activeColor }} />
                          )}
                        </button>
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs font-mono text-white">
                          0:{track.duration < 10 ? `0${track.duration}` : track.duration}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-white truncate">{track.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{track.prompt}</p>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleAddToTimeline(track)}
                        className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        <Layers size={11} /> + Timeline
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleLikeTrack(track.id)}
                          className={`p-1.5 rounded border ${
                            track.isLiked ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-white/5 border-white/10 text-slate-400'
                          }`}
                        >
                          <Heart size={13} className={track.isLiked ? 'fill-current' : ''} />
                        </button>
                        <a
                          href={track.audioUrl}
                          download={`${track.title}.mp3`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-400"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
