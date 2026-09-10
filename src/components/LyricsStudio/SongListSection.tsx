import React, { useState, useRef } from 'react';
import { useStore, Track } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { getStreamableAudioUrl } from '../../lib/utils';
import { syncAllLyrics } from '../../lib/timelineLyricsSync';
import { AudioSourceModal } from '../Audio/AudioSourceModal';
import { 
  Play, Pause, Plus, Music2, Trash2, Upload, 
  Disc3, Check, ExternalLink, Volume2
} from 'lucide-react';

export function SongListSection() {
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const isPlaying = useStore(s => s.isPlaying);
  const selectTrack = useStore(s => s.selectTrack);
  const removeTrack = useStore(s => s.removeTrack);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setAudio = useStore(s => s.setAudio);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
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
          <Music2 size={14} className="text-[#00e676]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6]">Song List</span>
          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-[#181d26] text-[#00e676] border border-[#2b3442]">
            {tracks.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Audio File (MP3, M4A, WAV)"
            className="p-1.5 rounded bg-[#181d26] hover:bg-[#222935] text-[#9aa2ae] hover:text-[#f0f3f6] border border-[#232933] transition-colors cursor-pointer"
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

          {/* Import Modal Trigger */}
          <button
            type="button"
            onClick={() => {
              audioManager.resume().catch(() => {});
              setIsAudioModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#00e676] hover:bg-[#00c853] text-[#0a0c0f] text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Main Track List */}
      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5 no-scrollbar">
        {tracks.length === 0 ? (
          <div className="py-6 px-3 text-center rounded border border-dashed border-[#232933] bg-[#0e1115]">
            <Music2 size={20} className="mx-auto text-[#5e6877] mb-1.5" />
            <p className="text-xs font-semibold text-[#9aa2ae]">No tracks in playlist</p>
            <p className="text-[10px] text-[#5e6877] mt-0.5">Click "Import" to add an audio track</p>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isSelected = idx === currentTrackIndex;
            const isThisPlaying = isSelected && isPlaying;
            const cover = track.albumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80';

            return (
              <div
                key={track.id || `track-${idx}`}
                onClick={() => handleTrackClick(idx)}
                className={`group relative flex items-center gap-2 p-1.5 rounded border transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#181d26] border-[#00e676]/60 text-[#f0f3f6]'
                    : 'bg-[#0e1115] hover:bg-[#181d26]/70 border-[#232933] text-[#c4cad4]'
                }`}
              >
                {/* Thumbnail with Play/Pause Badge */}
                <div className="relative w-8 h-8 rounded overflow-hidden shrink-0 border border-[#232933] bg-black">
                  <img 
                    src={cover} 
                    alt={track.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80';
                    }}
                  />
                  
                  {/* Play/Pause Overlay */}
                  <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    {isThisPlaying ? (
                      <div className="w-5 h-5 rounded-full bg-[#00e676] text-[#0a0c0f] flex items-center justify-center">
                        <Pause size={10} fill="currentColor" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center">
                        <Play size={10} fill="currentColor" className="ml-0.5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Title & Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold truncate leading-tight ${isSelected ? 'text-[#00e676]' : 'text-[#f0f3f6]'}`}>
                      {track.name}
                    </p>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#7e8999]">
                    <span className="truncate max-w-[120px]">
                      {track.artist || (track.isUserUploaded ? 'Uploaded' : 'Studio Track')}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[9.5px]">
                      {formatSecs(track.duration)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(idx);
                    }}
                    title="Remove Track"
                    className="p-1 text-[#5e6877] hover:text-[#ff5252] hover:bg-[#ff5252]/10 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
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
            const track = tracks[currentTrackIndex];
            const dur = track?.duration || 180;
            const lineDur = Math.min(4.5, dur / rawLines.length);
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
