import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { formatTime } from '../../lib/utils';
import { syncAllLyrics } from '../../lib/timelineLyricsSync';
import { AudioSourceModal } from './AudioSourceModal';
import {
  ListMusic, Plus, Trash2, Play, Pause,
  Search, X, Check, ChevronDown, Music2
} from 'lucide-react';

interface SongListPopoverProps {
  align?: 'left' | 'right' | 'center';
  compact?: boolean;
}

export function SongListPopover({ align = 'left', compact = false }: SongListPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const isPlaying = useStore(s => s.isPlaying);
  const selectTrack = useStore(s => s.selectTrack);
  const removeTrack = useStore(s => s.removeTrack);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const currentTrack = tracks[currentTrackIndex] || (tracks.length > 0 ? tracks[0] : null);

  // Close popover on outside click or escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTrackClick = (index: number) => {
    audioManager.resume().catch(() => {});

    if (index === currentTrackIndex) {
      setIsPlaying(!isPlaying);
    } else {
      selectTrack(index);
      setIsPlaying(true);

      // Auto-load lyrics if track has embedded lyrics and current editor has no lyrics
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

  const filteredTracks = tracks.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q));
  });

  const getAlignClass = () => {
    if (align === 'right') return 'right-0';
    if (align === 'center') return 'left-1/2 -translate-x-1/2';
    return 'left-0';
  };

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      {/* Popover Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={
          isOpen
            ? {
                borderColor: `${activeColor}80`,
                boxShadow: `0 0 15px ${activeColor}30`,
                backgroundColor: 'rgba(24, 24, 27, 0.95)'
              }
            : undefined
        }
        className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-left ${
          isOpen
            ? 'text-white ring-1'
            : 'bg-zinc-900/80 hover:bg-zinc-800/80 border-white/10 hover:border-white/20 text-zinc-300 hover:text-white'
        }`}
        title="Open Playlist & Queue"
      >
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          <ListMusic
            size={16}
            style={{ color: isOpen ? activeColor : undefined }}
            className={isOpen ? "" : "text-zinc-400 group-hover:text-white transition-colors"}
          />
          {isPlaying && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: activeColor }}
            />
          )}
        </div>

        {!compact && (
          <div className="flex flex-col text-left max-w-[110px] sm:max-w-[150px] min-w-0">
            <span className="text-[11px] font-bold text-white truncate leading-tight">
              {currentTrack?.name || 'No Track'}
            </span>
            <span className="text-[9px] text-zinc-400 truncate leading-tight">
              {currentTrack?.artist || (tracks.length === 0 ? 'Click to import' : `${tracks.length} tracks`)}
            </span>
          </div>
        )}

        <span
          className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-medium shrink-0 border"
          style={
            tracks.length > 0
              ? {
                  backgroundColor: `${activeColor}15`,
                  borderColor: `${activeColor}30`,
                  color: activeColor
                }
              : {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#a1a1aa'
                }
          }
        >
          {tracks.length}
        </span>

        <ChevronDown
          size={13}
          style={{ color: isOpen ? activeColor : undefined }}
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'group-hover:text-zinc-300'}`}
        />
      </button>

      {/* Popover Dropdown Window */}
      {isOpen && (
        <div
          className={`absolute bottom-full mb-2.5 w-80 sm:w-88 max-w-[92vw] bg-[#0e0e13]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${getAlignClass()}`}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">Playlist</span>
              <span
                className="px-1.5 py-0.5 rounded-md font-mono text-[10px] border"
                style={{
                  backgroundColor: `${activeColor}15`,
                  borderColor: `${activeColor}30`,
                  color: activeColor
                }}
              >
                {tracks.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Import Button */}
              <button
                onClick={() => {
                  audioManager.resume().catch(() => {});
                  setIsAudioModalOpen(true);
                }}
                style={{
                  backgroundColor: `${activeColor}18`,
                  borderColor: `${activeColor}40`,
                  color: activeColor
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-sm hover:brightness-125"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Import</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Search Filter if multiple tracks */}
          {tracks.length > 2 && (
            <div className="px-3 pt-2 pb-1 border-b border-white/5">
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter playlist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-7 py-1 text-xs text-white placeholder-zinc-500 outline-none transition-colors focus:border-white/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-zinc-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Playlist Content */}
          <div className="p-1.5 space-y-1 max-h-[280px] overflow-y-auto no-scrollbar">
            {tracks.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Music2 size={24} className="mx-auto text-zinc-600 mb-2 opacity-80" />
                <p className="text-xs font-medium text-zinc-300">No tracks in playlist</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">Import a song or audio file to start</p>
                <button
                  onClick={() => {
                    audioManager.resume().catch(() => {});
                    setIsAudioModalOpen(true);
                  }}
                  style={{
                    backgroundColor: activeColor,
                    color: '#000000',
                    boxShadow: `0 0 20px ${activeColor}40`
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer hover:brightness-110 active:scale-95"
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Import Audio</span>
                </button>
              </div>
            ) : filteredTracks.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 text-xs">
                No songs match "{searchQuery}"
              </div>
            ) : (
              filteredTracks.map((track, idx) => {
                const actualIndex = tracks.findIndex(t => t.id === track.id || t.url === track.url);
                const isSelected = actualIndex === currentTrackIndex;
                const isThisPlaying = isSelected && isPlaying;
                const cover = track.albumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&auto=format&fit=crop&q=80';

                return (
                  <div
                    key={track.id || `track-${idx}`}
                    onClick={() => handleTrackClick(actualIndex)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${activeColor}15`,
                            borderColor: `${activeColor}40`,
                            boxShadow: `0 0 15px ${activeColor}15`
                          }
                        : undefined
                    }
                    className={`group relative flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'text-white'
                        : 'bg-transparent hover:bg-white/[0.04] border-transparent text-zinc-300 hover:text-white'
                    }`}
                  >
                    {/* Cover / Icon */}
                    <div className="relative w-9 h-9 rounded-md overflow-hidden border border-white/10 shrink-0 bg-black/60">
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isThisPlaying ? (
                          <div className="flex items-end gap-[2px] h-3">
                            <span
                              className="w-0.5 animate-[bounce_0.6s_ease-in-out_infinite] h-full"
                              style={{ backgroundColor: activeColor }}
                            />
                            <span
                              className="w-0.5 animate-[bounce_0.8s_ease-in-out_infinite_0.2s] h-2.5"
                              style={{ backgroundColor: activeColor }}
                            />
                            <span
                              className="w-0.5 animate-[bounce_0.5s_ease-in-out_infinite_0.4s] h-1.5"
                              style={{ backgroundColor: activeColor }}
                            />
                          </div>
                        ) : (
                          <Play size={13} className="text-white fill-white ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold truncate ${isSelected ? 'font-bold' : 'text-zinc-200 group-hover:text-white'}`}
                          style={isSelected ? { color: activeColor } : undefined}
                        >
                          {track.name || 'Untitled Track'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate mt-0.5">
                        <span className="truncate">{track.artist || 'Unknown Artist'}</span>
                        <span>•</span>
                        <span className="font-mono text-zinc-500">{formatTime(track.duration || 0)}</span>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && (
                        <div className="p-1 rounded-full" style={{ color: activeColor }}>
                          <Check size={13} strokeWidth={2.5} />
                        </div>
                      )}

                      {/* Delete Track */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(actualIndex);
                        }}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Remove from playlist"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          {tracks.length > 0 && (
            <div className="px-3 py-1.5 border-t border-white/10 bg-black/30 flex items-center justify-between text-[10px] text-zinc-500">
              <span>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</span>
              <span className="font-mono">
                {formatTime(tracks.reduce((acc, t) => acc + (t.duration || 0), 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Audio Source Modal */}
      <AudioSourceModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </div>
  );
}
