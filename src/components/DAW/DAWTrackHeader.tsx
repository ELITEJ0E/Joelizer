import React, { useState } from 'react';
import { 
  Mic, Music, Sliders, Volume2, VolumeX, Radio, Circle, 
  Trash2, Copy, Plus, MoreVertical, Disc, Zap, Activity, AudioLines
} from 'lucide-react';
import { DAWTrack, TrackType } from '../../types/daw';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';

interface DAWTrackHeaderProps {
  key?: React.Key;
  track: DAWTrack;
  isSelected: boolean;
}

export function DAWTrackHeader({ track, isSelected }: DAWTrackHeaderProps) {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const setSelectedTrackId = useDAWStore(s => s.setSelectedTrackId);
  const updateTrack = useDAWStore(s => s.updateTrack);
  const removeTrack = useDAWStore(s => s.removeTrack);
  const toggleTrackMute = useDAWStore(s => s.toggleTrackMute);
  const toggleTrackSolo = useDAWStore(s => s.toggleTrackSolo);
  const toggleTrackArmed = useDAWStore(s => s.toggleTrackArmed);
  const setTrackVolume = useDAWStore(s => s.setTrackVolume);
  const setTrackPan = useDAWStore(s => s.setTrackPan);
  const addClip = useDAWStore(s => s.addClip);

  const [isEditingName, setIsEditingName] = useState(false);
  const [trackName, setTrackName] = useState(track.name);
  const [showMenu, setShowMenu] = useState(false);

  const getTrackIcon = (type: TrackType) => {
    switch (type) {
      case 'VOCAL': return <Mic size={13} style={{ color: track.color }} />;
      case 'GUITAR': return <Activity size={13} style={{ color: track.color }} />;
      case 'DRUMS': return <Disc size={13} style={{ color: track.color }} />;
      case 'SYNTH': case 'KEYS': return <Sliders size={13} style={{ color: track.color }} />;
      case 'AI': return <Zap size={13} style={{ color: track.color }} />;
      default: return <AudioLines size={13} style={{ color: track.color }} />;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        addClip(track.id, {
          name: file.name.replace(/\.[^/.]+$/, ''),
          audioUrl: url,
          startTime: 0,
          duration: audio.duration || 10,
          sourceStart: 0,
          sourceEnd: audio.duration || 10,
          volume: 1.0,
          fadeIn: 0,
          fadeOut: 0
        });
      };
    }
  };

  return (
    <div
      onClick={() => setSelectedTrackId(track.id)}
      className={`h-24 w-52 sm:w-60 border-r border-b border-white/10 bg-[#0d0e14] p-2.5 flex flex-col justify-between select-none transition-colors relative group shrink-0 ${
        isSelected ? 'bg-[#141520] border-l-2' : 'hover:bg-[#101118]'
      }`}
      style={isSelected ? { borderLeftColor: track.color } : {}}
    >
      {/* Top Row: Track Icon, Name, Type, Track Menu */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="p-1 rounded bg-white/5 shrink-0">
            {getTrackIcon(track.type)}
          </div>

          {isEditingName ? (
            <input
              type="text"
              value={trackName}
              onChange={e => setTrackName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                updateTrack(track.id, { name: trackName });
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                  updateTrack(track.id, { name: trackName });
                }
              }}
              autoFocus
              className="bg-black/60 text-xs font-black text-white px-1 py-0.5 rounded border border-white/20 focus:outline-none w-full"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingName(true)}
              className="text-xs font-bold text-slate-200 truncate cursor-pointer hover:text-white"
              title="Double click to rename"
            >
              {track.name}
            </span>
          )}
        </div>

        {/* Action Button & File Import */}
        <div className="flex items-center gap-0.5">
          <label className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer" title="Import Audio File to Track">
            <Plus size={12} />
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <button
            onClick={e => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete Track"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Middle Row: Mute (M), Solo (S), Arm (R) Buttons */}
      <div className="flex items-center gap-1">
        {/* Mute Button */}
        <button
          onClick={e => {
            e.stopPropagation();
            toggleTrackMute(track.id);
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black transition-all ${
            track.muted
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Mute Track (M)"
        >
          M
        </button>

        {/* Solo Button */}
        <button
          onClick={e => {
            e.stopPropagation();
            toggleTrackSolo(track.id);
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black transition-all ${
            track.solo
              ? 'bg-cyan-400 text-black shadow-md'
              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Solo Track (S)"
        >
          S
        </button>

        {/* Arm for Record Button */}
        <button
          onClick={e => {
            e.stopPropagation();
            toggleTrackArmed(track.id);
          }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black flex items-center gap-1 transition-all ${
            track.armed
              ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/50'
              : 'bg-white/5 text-slate-400 hover:text-rose-400 hover:bg-white/10'
          }`}
          title="Arm Track for Microphone / Guitar Recording (R)"
        >
          <Circle size={8} className={track.armed ? 'fill-white' : 'fill-current'} />
          <span>REC</span>
        </button>

        {/* Clip Count Badge */}
        <span className="ml-auto text-[9px] font-mono text-slate-500 font-bold">
          {track.clips.length} {track.clips.length === 1 ? 'clip' : 'clips'}
        </span>
      </div>

      {/* Bottom Row: Volume Fader & Pan Slider */}
      <div className="flex items-center gap-2">
        {/* Volume Fader */}
        <div className="flex-1 flex items-center gap-1">
          <Volume2 size={11} className="text-slate-500 shrink-0" />
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.01"
            value={track.volume}
            onChange={e => setTrackVolume(track.id, parseFloat(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            title={`Track Volume: ${Math.round(track.volume * 100)}%`}
          />
          <span className="text-[9px] font-mono text-slate-400 w-6 text-right shrink-0">
            {Math.round(track.volume * 100)}%
          </span>
        </div>

        {/* Pan Knob Slider */}
        <div className="w-12 flex items-center gap-0.5">
          <input
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={track.pan}
            onChange={e => setTrackPan(track.id, parseFloat(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            title={`Track Pan: ${track.pan === 0 ? 'C' : track.pan < 0 ? `${Math.round(Math.abs(track.pan) * 100)}L` : `${Math.round(track.pan * 100)}R`}`}
          />
        </div>
      </div>
    </div>
  );
}
