import React, { useState, useRef } from 'react';
import { useStore, Track } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { getStreamableAudioUrl } from '../../lib/utils';
import { syncAllLyrics } from '../../lib/timelineLyricsSync';
import { AudioSourceModal } from '../Audio/AudioSourceModal';
import { 
  Play, Pause, Plus, Music2, Trash2, Sparkles, Upload, 
  Disc3, Radio, Check, ExternalLink, Volume2
} from 'lucide-react';

const PRESET_SUNO_SONGS = [
  {
    name: 'Neon Skies',
    artist: 'Suno AI',
    genre: 'Synth-Pop',
    url: '/api/suno-audio/7ee8da7e-0310-4dec-ab00-f8d45f1b2156.m4a',
    duration: 133.6,
    albumArt: 'https://cdn2.suno.ai/image_large_7ee8da7e-0310-4dec-ab00-f8d45f1b2156.jpeg',
    sunoId: '7ee8da7e-0310-4dec-ab00-f8d45f1b2156',
    tags: 'Late-2000s synth-pop, bright electronic plucks, 90 BPM',
    lyrics: `[Verse 1]\nEvery light\nStarts to glow\nWhen the world\nMoves too slow\nLittle sparks\nIn the air\nLike somebody\nLeft them there\n\n[Chorus]\nNeon skies\nTake me home\nWhere the stars\nNever know\nHow to fall\nHow to fade\nThey just shine\nAnyway`
  },
  {
    name: 'Midnight Echoes',
    artist: 'Suno AI',
    genre: 'Lo-Fi Chill',
    url: '/api/suno-audio/b4e6d24f-96a9-4b67-9c98-1e0f06f7df20.m4a',
    duration: 154.2,
    albumArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    sunoId: 'b4e6d24f-96a9-4b67-9c98-1e0f06f7df20',
    tags: 'Lo-fi chill beats, warm Rhodes piano, gentle vinyl crackle',
    lyrics: `[Verse 1]\nRain outside the window pane\nQuiet shadows drift away\nMidnight rhythms ease the strain\nUntil the light of day\n\n[Chorus]\nEchoes in the quiet night\nSoft whispers in the sound\nEverything will be alright\nWhen morning comes around`
  },
  {
    name: 'Cyber Horizon',
    artist: 'Suno AI',
    genre: 'Cyberpunk EDM',
    url: '/api/suno-audio/f3c83407-7d9a-4712-8e10-6cbb607673c2.m4a',
    duration: 142.8,
    albumArt: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    sunoId: 'f3c83407-7d9a-4712-8e10-6cbb607673c2',
    tags: 'Cyberpunk EDM, aggressive basslines, arpeggiated synths',
    lyrics: `[Intro]\nSystem online\nScanning frequency\n\n[Verse 1]\nNeon cables in the rain\nElectricity and pain\nRacing down the digital line\nRunning out of time\n\n[Drop]\nBreak the grid\nFeel the sound\nShake the ground`
  }
];

export function SongListSection() {
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const isPlaying = useStore(s => s.isPlaying);
  const selectTrack = useStore(s => s.selectTrack);
  const removeTrack = useStore(s => s.removeTrack);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setAudio = useStore(s => s.setAudio);
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTrackClick = (index: number) => {
    // Unlock Audio Context immediately on user click
    audioManager.resume().catch(() => {});

    if (index === currentTrackIndex) {
      setIsPlaying(!isPlaying);
    } else {
      selectTrack(index);
      setIsPlaying(true);

      // If selected track has lyrics and current lyrics lines are empty, automatically populate them
      const targetTrack = tracks[index];
      if (targetTrack?.lyrics && lyricsLines.length === 0) {
        const rawLines = targetTrack.lyrics
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && !l.startsWith('[') && !l.endsWith(']'));

        if (rawLines.length > 0) {
          const dur = targetTrack.duration || 180;
          const lineDur = Math.min(4.5, dur / rawLines.length);
          const generatedLines = rawLines.map((text, i) => ({
            id: `l_${i}_${Math.random().toString(36).substring(2, 6)}`,
            text,
            startTime: Number((i * lineDur).toFixed(2)),
            endTime: Number(((i + 1) * lineDur).toFixed(2))
          }));
          syncAllLyrics(generatedLines);
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    audioManager.resume().catch(() => {});
    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);

    const finalize = (duration: number) => {
      const dur = duration && !isNaN(duration) && duration > 0 ? duration : 180;
      setAudio(file, objectUrl, dur, null, {
        name: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Uploaded Audio'
      });
      setIsPlaying(true);
    };

    tempAudio.onloadedmetadata = () => finalize(tempAudio.duration);
    tempAudio.onerror = () => finalize(180);
    setTimeout(() => finalize(180), 1200);

    // Reset input
    e.target.value = '';
  };

  const handleLoadPreset = (preset: typeof PRESET_SUNO_SONGS[0]) => {
    audioManager.resume().catch(() => {});

    // Check if preset is already in tracks
    const existingIndex = tracks.findIndex(t => 
      t.sunoId === preset.sunoId || 
      t.url === preset.url ||
      t.name.toLowerCase() === preset.name.toLowerCase()
    );

    if (existingIndex !== -1) {
      selectTrack(existingIndex);
      setIsPlaying(true);
    } else {
      setAudio(null, preset.url, preset.duration, preset.albumArt, {
        name: preset.name,
        artist: preset.artist,
        lyrics: preset.lyrics,
        tags: preset.tags,
        sunoId: preset.sunoId
      });
      setIsPlaying(true);
    }
  };

  const formatSecs = (sec?: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Header with Title & Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 size={15} className="text-cyan-400" />
          <span className="text-xs font-black uppercase tracking-wider text-white">Song List</span>
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30">
            {tracks.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload Audio File (MP3, M4A, WAV)"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
          >
            <Upload size={13} />
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="audio/*" 
            onChange={handleFileUpload} 
            className="hidden" 
          />

          {/* Import Suno / URL Modal Trigger */}
          <button
            onClick={() => {
              audioManager.resume().catch(() => {});
              setIsAudioModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.15)]"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Preset Suno Quick Audition Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Sparkles size={11} className="text-amber-400" />
          Suno:
        </span>
        {PRESET_SUNO_SONGS.map((preset) => {
          const isCurrent = tracks[currentTrackIndex]?.sunoId === preset.sunoId || tracks[currentTrackIndex]?.name === preset.name;
          return (
            <button
              key={preset.sunoId}
              onClick={() => handleLoadPreset(preset)}
              className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                isCurrent 
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.25)]' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'
              }`}
            >
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Track List */}
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5 no-scrollbar">
        {tracks.map((track, idx) => {
          const isSelected = idx === currentTrackIndex;
          const isThisPlaying = isSelected && isPlaying;
          const cover = track.albumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80';

          return (
            <div
              key={track.id || `track-${idx}`}
              onClick={() => handleTrackClick(idx)}
              className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-black/40 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/30'
                  : 'bg-black/30 hover:bg-white/5 border-white/5 hover:border-white/15'
              }`}
            >
              {/* Thumbnail with Play/Pause Badge */}
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-sm bg-black">
                <img 
                  src={cover} 
                  alt={track.name} 
                  className={`w-full h-full object-cover transition-transform duration-300 ${isThisPlaying ? 'scale-110' : 'group-hover:scale-105'}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80';
                  }}
                />
                
                {/* Play/Pause Overlay */}
                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  {isThisPlaying ? (
                    <div className="w-6 h-6 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-lg">
                      <Pause size={12} fill="currentColor" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                    </div>
                  )}
                </div>

                {/* Animated Equalizer Indicator if playing */}
                {isThisPlaying && (
                  <div className="absolute bottom-1 right-1 flex items-end gap-[1.5px] h-3 px-1 rounded bg-black/60 backdrop-blur-xs">
                    <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.6s_infinite_ease-in-out]" style={{ height: '70%' }} />
                    <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_ease-in-out_0.2s]" style={{ height: '100%' }} />
                    <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.7s_infinite_ease-in-out_0.4s]" style={{ height: '50%' }} />
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold truncate leading-tight ${isSelected ? 'text-cyan-300 font-extrabold' : 'text-white'}`}>
                    {track.name}
                  </p>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span className="truncate max-w-[120px] font-medium">
                    {track.artist || (track.isUserUploaded ? 'Uploaded' : 'Suno AI')}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[9.5px]">
                    {formatSecs(track.duration)}
                  </span>
                  {track.sunoId && (
                    <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono text-[8.5px] uppercase tracking-wide border border-purple-500/30">
                      Suno
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {tracks.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(idx);
                    }}
                    title="Remove Track"
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Audio Source Modal */}
      <AudioSourceModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        onLyricsExtracted={(lyrics) => {
          const rawLines = lyrics
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('[') && !l.endsWith(']'));

          if (rawLines.length > 0) {
            const currentDur = useStore.getState().audioDuration || 180;
            const lineDur = Math.min(4.5, currentDur / rawLines.length);
            const generatedLines = rawLines.map((text, i) => ({
              id: `l_${i}_${Math.random().toString(36).substring(2, 6)}`,
              text,
              startTime: Number((i * lineDur).toFixed(2)),
              endTime: Number(((i + 1) * lineDur).toFixed(2))
            }));
            syncAllLyrics(generatedLines);
          }
        }}
      />
    </div>
  );
}
