import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Sliders, Radio, Activity, Disc, Zap, Mic, ChevronUp, ChevronDown } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';

export function DAWMixerPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const tracks = useDAWStore(s => s.tracks);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const setSelectedTrackId = useDAWStore(s => s.setSelectedTrackId);
  const setTrackVolume = useDAWStore(s => s.setTrackVolume);
  const setTrackPan = useDAWStore(s => s.setTrackPan);
  const toggleTrackMute = useDAWStore(s => s.toggleTrackMute);
  const toggleTrackSolo = useDAWStore(s => s.toggleTrackSolo);
  const toggleTrackArmed = useDAWStore(s => s.toggleTrackArmed);

  const masterVolume = useDAWStore(s => s.masterVolume);
  const setMasterVolume = useDAWStore(s => s.setMasterVolume);
  const isPlaying = useDAWStore(s => s.isPlaying);

  const [isExpanded, setIsExpanded] = useState(false);
  const [masterLevel, setMasterLevel] = useState(0);

  // Poll master audio level when playing
  useEffect(() => {
    if (!isPlaying) {
      setMasterLevel(0);
      return;
    }

    const interval = setInterval(() => {
      setMasterLevel(dawAudioEngine.getMasterLevel());
    }, 60);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="border-t border-white/10 bg-[#0a0b0f] text-slate-200 shrink-0 z-20 select-none">
      {/* Collapsible Bar Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-7 px-4 bg-black/60 flex items-center justify-between cursor-pointer hover:bg-black/80 transition-colors text-[10px] font-mono font-bold"
      >
        <div className="flex items-center gap-2">
          <Sliders size={12} style={{ color: activeColor }} />
          <span className="uppercase tracking-wider">Console Mixer ({tracks.length} Channels + Master Bus)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mini Master VU Meter Indicator */}
          <div className="w-20 h-2 bg-black rounded-full overflow-hidden border border-white/10 flex">
            <div 
              className="h-full transition-all duration-75"
              style={{ 
                width: `${Math.min(100, masterLevel * 140)}%`,
                backgroundColor: masterLevel > 0.85 ? '#f43f5e' : activeColor
              }}
            />
          </div>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      {/* Expanded Mixer Channels */}
      {isExpanded && (
        <div className="h-44 p-3 flex gap-2 overflow-x-auto bg-[#07080c]">
          {/* Individual Track Channel Strips */}
          {tracks.map(track => {
            const isSelected = selectedTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`w-28 shrink-0 rounded-xl p-2.5 flex flex-col justify-between border transition-all ${
                  isSelected 
                    ? 'bg-[#12131c] border-white/30 shadow-lg' 
                    : 'bg-[#0d0e14] border-white/10 hover:border-white/20'
                }`}
                style={isSelected ? { borderTop: `3px solid ${track.color}` } : {}}
              >
                {/* Track Name */}
                <div className="text-center truncate">
                  <span className="text-[10px] font-black text-white truncate block">{track.name}</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">{track.type}</span>
                </div>

                {/* Mute, Solo, Rec Buttons */}
                <div className="flex items-center justify-center gap-1 my-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleTrackMute(track.id);
                    }}
                    className={`w-6 h-5 rounded text-[9px] font-mono font-bold ${
                      track.muted ? 'bg-amber-500 text-black font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleTrackSolo(track.id);
                    }}
                    className={`w-6 h-5 rounded text-[9px] font-mono font-bold ${
                      track.solo ? 'bg-cyan-400 text-black font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    S
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleTrackArmed(track.id);
                    }}
                    className={`w-6 h-5 rounded text-[9px] font-mono font-bold ${
                      track.armed ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    R
                  </button>
                </div>

                {/* Vertical Fader & Level Readout */}
                <div className="flex items-center justify-center gap-2 h-16">
                  <input
                    type="range"
                    min="0"
                    max="1.2"
                    step="0.01"
                    value={track.volume}
                    onChange={e => setTrackVolume(track.id, parseFloat(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    className="h-16 w-3 bg-black/60 rounded appearance-none cursor-pointer accent-emerald-400 [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                  />
                  <span className="text-[9px] font-mono text-slate-400 w-6">
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>

                {/* Pan Slider */}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] font-mono text-slate-500">P</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={track.pan}
                    onChange={e => setTrackPan(track.id, parseFloat(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            );
          })}

          {/* Master Bus Channel Strip */}
          <div className="w-32 shrink-0 rounded-xl p-2.5 flex flex-col justify-between border border-emerald-500/30 bg-[#0e1713] ml-auto">
            <div className="text-center">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">MASTER</span>
              <span className="text-[8px] font-mono text-slate-400">STEREO OUT</span>
            </div>

            {/* Master Fader + Dual VU Meter */}
            <div className="flex items-center justify-center gap-3 h-20 my-1">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={masterVolume}
                onChange={e => setMasterVolume(parseFloat(e.target.value))}
                className="h-20 w-4 bg-black rounded appearance-none cursor-pointer accent-emerald-400 [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
              />
              
              {/* Stereo VU Meter Bar */}
              <div className="w-3 h-20 bg-black rounded overflow-hidden border border-white/20 flex flex-col justify-end p-0.5">
                <div 
                  className="w-full rounded transition-all duration-75"
                  style={{ 
                    height: `${Math.min(100, masterLevel * 140)}%`,
                    backgroundColor: masterLevel > 0.85 ? '#f43f5e' : activeColor
                  }}
                />
              </div>
            </div>

            <div className="text-center text-[10px] font-mono font-black text-emerald-400">
              {Math.round(masterVolume * 100)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
