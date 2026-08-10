import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { Lock, Unlock, Scissors, Trash2, ZoomIn, ZoomOut, Film, Image as ImageIcon, Music, Type } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTime = useStore(s => s.currentTime);
  const duration = useStore(s => s.audioDuration) || 120;
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const waveformPeaks = useStore(s => s.waveformPeaks);
  
  const timelineClips = useMVStore(s => s.timelineClips);
  const videoAssets = useMVStore(s => s.videoAssets);
  const wordTimings = useMVStore(s => s.wordTimings);
  const selectedClipId = useMVStore(s => s.selectedClipId);
  const setSelectedClipId = useMVStore(s => s.setSelectedClipId);
  const toggleLockClip = useMVStore(s => s.toggleLockClip);
  const removeTimelineClip = useMVStore(s => s.removeTimelineClip);
  const splitTimelineClip = useMVStore(s => s.splitTimelineClip);

  const [zoom, setZoom] = useState(1);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    setCurrentTime(time);
    
    // Seek audio
    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.currentTime = time;
  };

  const selectedClip = timelineClips.find(c => c.id === selectedClipId);

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[#08080c] text-slate-300 select-none">
      {/* Toolbar */}
      <div className="h-8 border-b border-white/10 flex items-center px-3 justify-between bg-black/60 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1">
            <Film size={12} />
            Multitrack Timeline
          </span>

          {selectedClip && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLockClip(selectedClip.id);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  selectedClip.locked ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {selectedClip.locked ? <Lock size={10} /> : <Unlock size={10} />}
                {selectedClip.locked ? 'Locked' : 'Lock'}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  splitTimelineClip(selectedClip.id, currentTime);
                }}
                disabled={currentTime <= selectedClip.startTime || currentTime >= selectedClip.endTime}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-30"
              >
                <Scissors size={10} />
                Split
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTimelineClip(selectedClip.id);
                }}
                className="px-2 py-0.5 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1"
              >
                <Trash2 size={10} />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setZoom(z => Math.max(1, z - 0.5))} 
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[10px] font-mono text-slate-400 w-8 text-center">{zoom}x</span>
          <button 
            onClick={() => setZoom(z => Math.min(5, z + 0.5))} 
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>
      
      {/* Scrollable Timeline Area */}
      <div className="flex-1 relative overflow-x-auto overflow-y-hidden bg-black/40">
        <div 
          ref={containerRef}
          onMouseDown={handleTimelineClick}
          className="h-full relative cursor-text min-w-full"
          style={{ width: `${100 * zoom}%` }}
        >
          {/* Track Headers & Lanes */}
          <div className="absolute inset-0 flex flex-col pt-2 pb-2 pl-12">

            {/* Track 1: VIDEO */}
            <div className="h-16 relative border-b border-white/10 bg-blue-950/20 mb-1">
              <div className="absolute -left-11 top-0 bottom-0 w-10 flex items-center justify-center text-[9px] font-bold font-mono text-blue-400/80 uppercase tracking-tighter">
                <Film size={12} className="mr-0.5 inline" /> VIS
              </div>
              {timelineClips.map(clip => {
                const asset = videoAssets.find(v => v.id === clip.assetId);
                const left = (clip.startTime / duration) * 100;
                const width = Math.max(0.2, ((clip.endTime - clip.startTime) / duration) * 100);
                const isSelected = clip.id === selectedClipId;

                return (
                  <div 
                    key={clip.id} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClipId(clip.id);
                    }}
                    className={`absolute top-1 bottom-1 rounded border flex items-center overflow-hidden transition-all cursor-pointer ${
                      isSelected 
                        ? 'ring-2 ring-yellow-400 border-white bg-purple-600/60 z-20 shadow-lg' 
                        : clip.locked 
                        ? 'bg-amber-900/40 border-amber-500/60' 
                        : 'bg-blue-600/40 border-blue-400/50 hover:bg-blue-600/60'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {asset && asset.thumbnail && (
                      <img src={asset.thumbnail} alt="" className="h-full opacity-60 object-cover pointer-events-none" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none" />

                    <div className="absolute left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono text-white truncate">
                      <span className="truncate flex items-center gap-1">
                        {clip.mediaType === 'image' ? <ImageIcon size={9} className="text-amber-300" /> : <Film size={9} className="text-blue-300" />}
                        {asset ? asset.name : 'Clip'}
                      </span>
                      {clip.locked && <Lock size={10} className="text-amber-400 shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Track 2: LYRICS */}
            <div className="h-8 relative border-b border-white/10 bg-purple-950/20 mb-1">
              <div className="absolute -left-11 top-0 bottom-0 w-10 flex items-center justify-center text-[9px] font-bold font-mono text-purple-400/80 uppercase tracking-tighter">
                <Type size={12} className="mr-0.5 inline" /> LYR
              </div>
              {wordTimings.map(line => {
                const left = (line.startTime / duration) * 100;
                const width = Math.max(0.2, ((line.endTime - line.startTime) / duration) * 100);
                const isActive = currentTime >= line.startTime && currentTime <= line.endTime;

                return (
                  <div 
                    key={line.id} 
                    className={`absolute top-0.5 bottom-0.5 rounded border px-1 flex items-center justify-center overflow-hidden whitespace-nowrap transition-colors ${
                      isActive 
                        ? 'bg-purple-600 border-yellow-300 text-yellow-200 font-bold z-10 shadow-md' 
                        : 'bg-purple-900/30 border-purple-500/30 text-purple-200/80'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="text-[9px] font-mono truncate pointer-events-none">{line.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 3: AUDIO */}
            <div className="h-10 relative bg-emerald-950/20">
              <div className="absolute -left-11 top-0 bottom-0 w-10 flex items-center justify-center text-[9px] font-bold font-mono text-emerald-400/80 uppercase tracking-tighter">
                <Music size={12} className="mr-0.5 inline" /> AUD
              </div>
              <div className="absolute inset-y-1 inset-x-0 flex items-center opacity-60 pointer-events-none">
                {waveformPeaks && waveformPeaks.length > 0 ? (
                  <svg preserveAspectRatio="none" viewBox={`0 0 ${waveformPeaks.length} 100`} className="w-full h-full fill-emerald-400">
                    {waveformPeaks.map((peak, i) => (
                      <rect key={i} x={i} y={50 - peak * 45} width={1.2} height={Math.max(2, peak * 90)} />
                    ))}
                  </svg>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-emerald-600/40 text-[9px] font-mono uppercase tracking-widest">
                    Audio Track Waveform
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Red Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 rotate-45 bg-red-500 shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
