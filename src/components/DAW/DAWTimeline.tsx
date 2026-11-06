import React, { useRef, useEffect } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { DAWTrackHeader } from './DAWTrackHeader';
import { DAWClipItem } from './DAWClipItem';
import { Music, FileText, ChevronRight } from 'lucide-react';

export function DAWTimeline() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const lyricsLines = useStore(s => s.lyricsSettings.lines) || [];
  const setActiveTab = useStore(s => s.setActiveTab);

  const tracks = useDAWStore(s => s.tracks);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const selectedClipId = useDAWStore(s => s.selectedClipId);
  const setSelectedClipId = useDAWStore(s => s.setSelectedClipId);

  const currentTime = useDAWStore(s => s.currentTime);
  const isPlaying = useDAWStore(s => s.isPlaying);
  const seek = useDAWStore(s => s.seek);

  const bpm = useDAWStore(s => s.bpm);
  const projectDuration = useDAWStore(s => s.projectDuration);
  const timelineZoom = useDAWStore(s => s.timelineZoom); // Pixels per second
  const showLyricsRuler = useDAWStore(s => s.showLyricsRuler);
  const setShowLyricsRuler = useDAWStore(s => s.setShowLyricsRuler);

  const isLooping = useDAWStore(s => s.isLooping);
  const loopStart = useDAWStore(s => s.loopStart);
  const loopEnd = useDAWStore(s => s.loopEnd);
  const setLoopRegion = useDAWStore(s => s.setLoopRegion);

  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const trackHeaderScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const totalWidth = Math.max(1200, (projectDuration + 10) * timelineZoom);

  // A viewport-sized time ruler avoids enormous 12k+ pixel canvases.
  useEffect(() => {
    const canvas=rulerCanvasRef.current;
    const viewport=timelineContainerRef.current;
    if(!canvas||!viewport)return;
    let frame=0;
    const draw=()=>{
      frame=0;
      const scale=Math.min(2,window.devicePixelRatio||1);
      const width=Math.max(1,viewport.clientWidth);
      const scroll=viewport.scrollLeft;
      canvas.style.width=width+'px';
      canvas.style.transform='translate3d('+scroll+'px,0,0)';
      const pw=Math.ceil(width*scale);
      if(canvas.width!==pw)canvas.width=pw;
      if(canvas.height!==Math.ceil(32*scale))canvas.height=Math.ceil(32*scale);
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.fillStyle='#0b1220';ctx.fillRect(0,0,width,32);
      const beat=60/bpm,bar=beat*4;
      const first=Math.max(0,Math.floor(scroll/(bar*timelineZoom))-1);
      const last=Math.ceil((scroll+width)/(bar*timelineZoom))+1;
      ctx.font='600 10px monospace';
      for(let i=first;i<=last;i++){
        const x=i*bar*timelineZoom-scroll;
        ctx.strokeStyle='rgba(148,163,184,.35)';
        ctx.beginPath();ctx.moveTo(Math.round(x)+.5,14);ctx.lineTo(Math.round(x)+.5,32);ctx.stroke();
        const time=i*bar;
        ctx.fillStyle='rgba(203,213,225,.85)';
        ctx.fillText((i+1)+' · '+Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0'),x+5,11);
        for(let j=1;j<4;j++){
          const bx=x+j*beat*timelineZoom;
          ctx.strokeStyle='rgba(148,163,184,.12)';
          ctx.beginPath();ctx.moveTo(Math.round(bx)+.5,22);ctx.lineTo(Math.round(bx)+.5,32);ctx.stroke();
        }
      }
      if(isLooping&&loopEnd>loopStart){
        const left=loopStart*timelineZoom-scroll,right=loopEnd*timelineZoom-scroll;
        ctx.fillStyle='rgba(34,211,238,.14)';ctx.fillRect(left,0,right-left,32);
        ctx.strokeStyle='#22d3ee';ctx.strokeRect(left,0,right-left,32);
      }
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
    const resize=new ResizeObserver(schedule);
    resize.observe(viewport);
    viewport.addEventListener('scroll',schedule,{passive:true});
    schedule();
    return()=>{resize.disconnect();viewport.removeEventListener('scroll',schedule);if(frame)cancelAnimationFrame(frame);};
  },[timelineZoom,bpm,isLooping,loopStart,loopEnd]);

  // Handle click / drag on Ruler to seek playhead
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    const rect = timelineContainerRef.current?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
    const scrollLeft = timelineContainerRef.current?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    const targetTime = Math.max(0, clickX / timelineZoom);
    seek(targetTime);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newClickX = moveEvent.clientX - rect.left + (timelineContainerRef.current?.scrollLeft || 0);
      const newTime = Math.max(0, newClickX / timelineZoom);
      seek(newTime);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Playhead position in pixels
  const playheadX = currentTime * timelineZoom;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] overflow-hidden select-none relative">
      {/* Multitrack Layout Split: Left Track Headers & Right Scrolling Timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Track Headers Stack */}
        <div className="w-52 sm:w-60 shrink-0 border-r border-white/10 flex flex-col bg-[#0b0c10] z-20 shadow-xl">
          {/* Top Left Corner Box (Aligns with Ruler) */}
          <div className="h-8 border-b border-white/10 px-3 bg-black/60 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
            <span>TRACKS ({tracks.length})</span>
            <button
              onClick={() => setShowLyricsRuler(!showLyricsRuler)}
              className={`flex items-center gap-1 transition-colors ${showLyricsRuler ? 'text-emerald-400' : 'text-slate-500'}`}
              title="Toggle Lyrics Alignment Ruler"
            >
              <FileText size={11} />
              <span>LYRICS</span>
            </button>
          </div>

          {/* Optional Lyrics Header space */}
          {showLyricsRuler && (
            <div className="h-7 border-b border-white/10 px-3 bg-[#0d0e14] flex items-center justify-between text-[9px] font-mono font-bold text-emerald-400">
              <span className="flex items-center gap-1">
                <Music size={10} />
                LRC SYNC RULER
              </span>
              <button
                onClick={() => setActiveTab('lyrics')}
                className="text-[9px] text-slate-400 hover:text-white flex items-center gap-0.5"
              >
                Edit <ChevronRight size={10} />
              </button>
            </div>
          )}

          {/* Track Headers List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {tracks.map(track => (
              <DAWTrackHeader
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Scrolling Timeline Canvas & Lanes */}
        <div 
          ref={timelineContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#050507]"
        >
          {/* Internal Canvas Content Wrapper */}
          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {/* 1. Time / Beat Ruler */}
            <div 
              onMouseDown={handleRulerMouseDown}
              className="h-8 border-b border-white/10 bg-[#08080c] sticky top-0 z-30 cursor-pointer"
            >
              <canvas ref={rulerCanvasRef} className="w-full h-full block" />
            </div>

            {/* 2. Synchronized Lyrics Ruler Track */}
            {showLyricsRuler && (
              <div className="h-7 border-b border-white/10 bg-[#0a0b10] relative flex items-center overflow-hidden z-10">
                {lyricsLines.map((line, idx) => {
                  const lineX = line.startTime * timelineZoom;
                  const lineW = Math.max(40, ((line.endTime || line.startTime + 3) - line.startTime) * timelineZoom);
                  const isCurrent = currentTime >= line.startTime && currentTime <= (line.endTime || line.startTime + 3);

                  return (
                    <div
                      key={line.id || idx}
                      onClick={() => seek(line.startTime)}
                      className={`absolute top-1 bottom-1 rounded px-1.5 flex items-center truncate text-[9px] font-mono cursor-pointer transition-colors border ${
                        isCurrent
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                      style={{ left: `${lineX}px`, width: `${lineW}px` }}
                      title={`[${line.startTime.toFixed(1)}s] ${line.text}`}
                    >
                      <span className="truncate">{line.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Multitrack Lanes */}
            <div className="relative">
              {tracks.map(track => (
                <div
                  key={track.id}
                  onClick={() => setSelectedClipId(null)}
                  className={`h-24 border-b border-white/5 relative group transition-colors ${
                    selectedTrackId === track.id ? 'bg-white/[0.02]' : 'bg-transparent'
                  }`}
                >
                  {/* Subtle Background Beat Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px)] bg-[size:50px_100%]" />

                  {/* Render Audio Clips */}
                  {track.clips.map(clip => (
                    <DAWClipItem
                      key={clip.id}
                      clip={clip}
                      track={track}
                      isSelected={selectedClipId === clip.id}
                      zoom={timelineZoom}
                      onSelect={(id) => setSelectedClipId(id)}
                    />
                  ))}
                </div>
              ))}

              {/* 4. Draggable Playhead Line */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-40 transition-none"
                style={{ transform: `translateX(${playheadX}px)` }}
              >
                {/* Glowing Vertical Line */}
                <div 
                  className="w-0.5 h-full"
                  style={{ 
                    backgroundColor: activeColor,
                    boxShadow: `0 0 10px ${activeColor}`
                  }}
                />

                {/* Top Playhead Scrub Handle */}
                <div
                  className="absolute -top-8 -left-2.5 w-5 h-5 cursor-ew-resize pointer-events-auto flex items-center justify-center"
                  onMouseDown={handleRulerMouseDown}
                >
                  <div
                    className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px]"
                    style={{ borderTopColor: activeColor }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
