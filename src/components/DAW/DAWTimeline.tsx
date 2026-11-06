import React, { useRef, useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { DAWTrackHeader } from './DAWTrackHeader';
import { DAWClipItem } from './DAWClipItem';
import { Music, FileText, ChevronRight } from 'lucide-react';
import { secondsPerBar, gridSeconds } from '../../lib/dawArrangement';

export function DAWTimeline() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const lyricsLines = useStore(s => s.lyricsSettings.lines) || [];
  const setActiveTab = useStore(s => s.setActiveTab);

  const tracks = useDAWStore(s => s.tracks);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const selectedClipId = useDAWStore(s => s.selectedClipId);
  const setSelectedClipId = useDAWStore(s => s.setSelectedClipId);

  const currentTime = useDAWStore(s => s.currentTime);
  const seek = useDAWStore(s => s.seek);

  const bpm = useDAWStore(s => s.bpm);
  const timeSignature = useDAWStore(s => s.timeSignature);
  const gridDivision = useDAWStore(s => s.gridDivision);
  const snapToGrid = useDAWStore(s => s.snapToGrid);
  const setSelectedTrackId = useDAWStore(s => s.setSelectedTrackId);
  const projectDuration = useDAWStore(s => s.projectDuration);
  const timelineZoom = useDAWStore(s => s.timelineZoom); // Pixels per second
  const showLyricsRuler = useDAWStore(s => s.showLyricsRuler);
  const setShowLyricsRuler = useDAWStore(s => s.setShowLyricsRuler);

  const isLooping = useDAWStore(s => s.isLooping);
  const loopStart = useDAWStore(s => s.loopStart);
  const loopEnd = useDAWStore(s => s.loopEnd);

  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const headersRef = useRef<HTMLDivElement | null>(null);
  const rulerPointerRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ left: 0, width: 1000, scrollbar: 0 });

  const totalWidth = Math.max(1200, (projectDuration + 10) * timelineZoom);
  const barSec = secondsPerBar(bpm, timeSignature);
  const beatSec = barSec / (Number(timeSignature.split('/')[0]) || 4);
  const gridSec = gridSeconds(bpm, gridDivision);
  const rawGridPixels = (gridSec || beatSec) * timelineZoom;
  const visibleGridPixels = rawGridPixels * Math.max(1, 2 ** Math.ceil(Math.log2(8 / rawGridPixels)));

  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) return;
    const resize = new ResizeObserver(() => setViewport({ left: container.scrollLeft, width: container.clientWidth, scrollbar: container.offsetHeight - container.clientHeight }));
    resize.observe(container);
    return () => resize.disconnect();
  }, []);

  // Draw Time & Beat Ruler Canvas
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Allocate only the visible ruler, even when a long project is highly zoomed.
    const w = Math.max(1, viewport.width);
    const h = 32;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, w, h);

    // Grid lines & time markings
    const firstBar = Math.max(0, Math.floor(viewport.left / (barSec * timelineZoom)));
    const lastBar = Math.ceil((viewport.left + w) / (barSec * timelineZoom));
    const labelEvery = Math.max(1, Math.ceil(105 / (barSec * timelineZoom)));

    ctx.font = 'bold 9px monospace';

    for (let bar = firstBar; bar <= lastBar; bar++) {
      const barX = bar * barSec * timelineZoom - viewport.left;
      
      // Bar Mark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX, 14);
      ctx.lineTo(barX, h);
      ctx.stroke();

      // Bar Number & Seconds Label
      const timeStr = `${Math.floor(bar * barSec / 60)}:${Math.floor((bar * barSec) % 60).toString().padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      if (bar % labelEvery === 0) ctx.fillText(`${bar + 1} · ${timeStr}`, barX + 4, 11);

      // 4 Beat Subdivisions inside Bar
      for (let beat = 1; beat < Math.round(barSec / beatSec); beat++) {
        const beatX = barX + beat * beatSec * timelineZoom;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(beatX, 22);
        ctx.lineTo(beatX, h);
        ctx.stroke();
      }
    }

    // Draw Loop Region on Ruler if Active
    if (isLooping && loopEnd > loopStart) {
      const lx1 = loopStart * timelineZoom - viewport.left;
      const lx2 = loopEnd * timelineZoom - viewport.left;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(lx1, 0, lx2 - lx1, h);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx1, 0, lx2 - lx1, h);
    }
  }, [viewport, timelineZoom, barSec, beatSec, isLooping, loopStart, loopEnd]);

  // Handle click / drag on Ruler to seek playhead
  const seekAtPointer = (clientX: number) => {
    const container = timelineContainerRef.current;
    if (!container) return;
    seek(Math.max(0, Math.min(projectDuration, (clientX - container.getBoundingClientRect().left + container.scrollLeft) / timelineZoom)));
  };
  const rulerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    rulerPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekAtPointer(event.clientX);
  };
  const rulerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (rulerPointerRef.current === event.pointerId) seekAtPointer(event.clientX);
  };
  const rulerPointerEnd = () => { rulerPointerRef.current = null; };

  // Playhead position in pixels
  const playheadX = currentTime * timelineZoom;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] overflow-hidden select-none relative">
      {/* Multitrack Layout Split: Left Track Headers & Right Scrolling Timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Track Headers Stack */}
        <div className="w-36 sm:w-52 shrink-0 border-r border-white/10 flex flex-col bg-[#0b0c10] z-20 shadow-xl">
          {/* Top Left Corner Box (Aligns with Ruler) */}
          <div className="h-8 shrink-0 border-b border-white/10 px-2 bg-black/60 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
            <span>TRACKS ({tracks.length})</span>
            <button
              onClick={() => setShowLyricsRuler(!showLyricsRuler)}
              className={`flex items-center gap-1 transition-colors ${showLyricsRuler ? 'text-emerald-400' : 'text-slate-500'}`}
              title="Toggle Lyrics Alignment Ruler"
              aria-label="Toggle lyrics ruler"
              aria-pressed={showLyricsRuler}
            >
              <FileText size={11} />
              <span className="hidden sm:inline">LYRICS</span>
            </button>
          </div>

          {/* Optional Lyrics Header space */}
          {showLyricsRuler && (
            <div className="h-7 shrink-0 border-b border-white/10 px-2 bg-[#0d0e14] flex items-center justify-between text-[9px] font-mono font-bold text-emerald-400">
              <span className="flex items-center gap-1">
                <Music size={10} />
                LYRICS
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
          <div ref={headersRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={event => {
            if (timelineContainerRef.current && timelineContainerRef.current.scrollTop !== event.currentTarget.scrollTop) timelineContainerRef.current.scrollTop = event.currentTarget.scrollTop;
          }}>
            {tracks.map(track => (
              <DAWTrackHeader
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
              />
            ))}
            <div aria-hidden="true" style={{ height: viewport.scrollbar }} />
          </div>
        </div>

        {/* RIGHT COLUMN: Scrolling Timeline Canvas & Lanes */}
        <div 
          ref={timelineContainerRef}
          data-testid="daw-timeline-scroll"
          className="flex-1 min-w-0 overflow-x-auto overflow-y-auto relative bg-[#050507]"
          onScroll={event => {
            const container = event.currentTarget;
            if (headersRef.current && headersRef.current.scrollTop !== container.scrollTop) headersRef.current.scrollTop = container.scrollTop;
            setViewport({ left: container.scrollLeft, width: container.clientWidth, scrollbar: container.offsetHeight - container.clientHeight });
          }}
        >
          {/* Internal Canvas Content Wrapper */}
          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {/* 1. Time / Beat Ruler */}
            <div 
              onPointerDown={rulerPointerDown}
              onPointerMove={rulerPointerMove}
              onPointerUp={rulerPointerEnd}
              onPointerCancel={rulerPointerEnd}
              role="slider" tabIndex={0} aria-label="Timeline playhead" aria-valuemin={0} aria-valuemax={projectDuration} aria-valuenow={Math.min(projectDuration, currentTime)} aria-valuetext={`${currentTime.toFixed(2)} seconds`}
              onKeyDown={event => {
                const step = snapToGrid && gridSec > 0 ? gridSec : 1;
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); seek(Math.max(0, Math.min(projectDuration, currentTime + (event.key === 'ArrowRight' ? step : -step)))); }
                if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); event.stopPropagation(); seek(event.key === 'Home' ? 0 : projectDuration); }
              }}
              className="h-8 border-b border-white/10 bg-[#08080c] sticky top-0 z-30 cursor-pointer touch-none focus-visible:outline focus-visible:outline-emerald-400"
            >
              <canvas ref={rulerCanvasRef} className="absolute top-0 h-full block pointer-events-none" style={{ left: viewport.left, width: viewport.width }} />
            </div>

            {/* 2. Synchronized Lyrics Ruler Track */}
            {showLyricsRuler && (
              <div className="h-7 border-b border-white/10 bg-[#0a0b10] sticky top-8 flex items-center overflow-hidden z-30">
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
                  onClick={() => { setSelectedClipId(null); setSelectedTrackId(track.id); }}
                  className={`h-24 border-b border-white/5 relative group transition-colors ${
                    selectedTrackId === track.id ? 'bg-white/[0.02]' : 'bg-transparent'
                  }`}
                >
                  {/* Subtle Background Beat Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to right,rgba(255,255,255,0.04) 1px,transparent 1px)',
                    backgroundSize: `${barSec * timelineZoom}px 100%,${visibleGridPixels}px 100%`
                  }} />

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
                  className="absolute -left-2.5 w-5 h-5 cursor-ew-resize pointer-events-auto touch-none flex items-center justify-center"
                  style={{ top: showLyricsRuler ? -60 : -32 }}
                  onPointerDown={rulerPointerDown}
                  onPointerMove={rulerPointerMove}
                  onPointerUp={rulerPointerEnd}
                  onPointerCancel={rulerPointerEnd}
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
