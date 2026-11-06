import React, { useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { DAWTopBar } from './DAWTopBar';
import { DAWTimeline } from './DAWTimeline';
import { DAWMixerPanel } from './DAWMixerPanel';
import { MusicStudioBrowser } from './MusicStudioBrowser';
import { DAWInspector } from './DAWInspector';
import { Circle, Mic, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, SlidersHorizontal, Keyboard, Waves } from 'lucide-react';
import { dawAudioEngine } from '../../lib/dawAudioEngine';

export function DAWLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const isPlaying = useDAWStore(s => s.isPlaying);
  const play = useDAWStore(s => s.play);
  const pause = useDAWStore(s => s.pause);
  const isRecording = useDAWStore(s => s.isRecording);
  const stopRecording = useDAWStore(s => s.stopRecording);
  const startRecording = useDAWStore(s => s.startRecording);
  const recordingStartTime = useDAWStore(s => s.recordingStartTime);
  const currentTime = useDAWStore(s => s.currentTime);
  const armedTrackId = useDAWStore(s => s.armedTrackId);
  const tracks = useDAWStore(s => s.tracks);
  const undo = useDAWStore(s => s.undo);
  const redo = useDAWStore(s => s.redo);
  const splitClip = useDAWStore(s => s.splitClip);
  const selectedClipId = useDAWStore(s => s.selectedClipId);
  const removeClip = useDAWStore(s => s.removeClip);
  const setLoopRegion = useDAWStore(s => s.setLoopRegion);
  const loopStart = useDAWStore(s => s.loopStart);
  const loopEnd = useDAWStore(s => s.loopEnd);

  const [inputLevel, setInputLevel] = useState(0);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [browserWidth, setBrowserWidth] = useState(312);
  const [helpOpen, setHelpOpen] = useState(false);

  // Monitor live input level during recording
  useEffect(() => {
    if (!isRecording) {
      setInputLevel(0);
      return;
    }

    const interval = setInterval(() => {
      setInputLevel(dawAudioEngine.getInputLevel());
    }, 60);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Install one stable keyboard handler. Reading the current Zustand snapshot
  // avoids removing/reinstalling listeners 30 times per second as time advances.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.isContentEditable ||
          ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName) ||
          e.altKey) return;
      const state = useDAWStore.getState();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault(); state.redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'd' && state.selectedClipId) {
        e.preventDefault(); state.duplicateClip(state.selectedClipId); return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.isPlaying) state.pause(); else state.play();
      } else if (key === 'r') {
        e.preventDefault();
        if (state.isRecording) void state.stopRecording();
        else void state.startRecording();
      } else if (key === 'v') {
        state.setActiveTool('select');
      } else if (key === 'e') {
        state.setActiveTool('erase');
      } else if (key === 's') {
        if (state.selectedClipId) {
          e.preventDefault();
          state.splitClip(state.selectedClipId,state.currentTime);
        } else state.setActiveTool('split');
      } else if ((key === 'delete' || key === 'backspace') && state.selectedClipId) {
        e.preventDefault();
        state.removeClip(state.selectedClipId);
      } else if (key === 'b') {
        setBrowserOpen(open=>!open);
      } else if (key === 'i') {
        setInspectorOpen(open=>!open);
      } else if (key === 'm') {
        setMixerOpen(open=>!open);
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        state.setLoopRegion(state.currentTime,Math.max(state.currentTime+.5,state.loopEnd));
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        state.setLoopRegion(Math.min(state.loopStart,Math.max(0,state.currentTime-.5)),state.currentTime);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const beat=60/state.bpm;
        state.seek(Math.max(0,state.currentTime+(e.code==='ArrowLeft'?-beat:beat)));
      }
    };
    window.addEventListener('keydown',handleKeyDown);
    return () => window.removeEventListener('keydown',handleKeyDown);
  },[]);

  const armedTrack = tracks.find(t => t.id === armedTrackId);
  const clipCount = tracks.reduce((count, track) => count + track.clips.length, 0);
  const selectedClip = tracks.flatMap(track => track.clips).find(c => c.id === selectedClipId);
  const recordingDuration = Math.max(0, currentTime - recordingStartTime);

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] overflow-hidden select-none font-sans relative">
      {/* Top Workstation Bar */}
      <DAWTopBar />

      <div role="toolbar" aria-label="Music Studio workspace controls"
        className="flex h-10 shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-white/10 bg-[#0c121d] px-3 text-[11px]">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-slate-100">ARRANGEMENT</span>
          <span className="rounded bg-white/5 px-2 py-1 font-mono text-slate-400">{tracks.length} tracks · {clipCount} clips</span>
          {selectedClip && <span className="max-w-40 truncate text-cyan-300" title={selectedClip.name}>Selected: {selectedClip.name}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-pressed={browserOpen} onClick={() => setBrowserOpen(v=>!v)}
            className={browserOpen ? 'rounded-md bg-cyan-400/15 px-2.5 py-1.5 text-cyan-200' : 'rounded-md bg-white/5 px-2.5 py-1.5 text-slate-300'}
            title="Toggle sample browser">
            <PanelLeftOpen size={14} className="mr-1 inline"/> Browser
          </button>
          <button type="button" aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(v=>!v)}
            className={inspectorOpen ? 'rounded-md bg-cyan-400/15 px-2.5 py-1.5 text-cyan-200' : 'rounded-md bg-white/5 px-2.5 py-1.5 text-slate-300'}>
            <PanelRightOpen size={14} className="mr-1 inline"/> Inspector
          </button>
          <button type="button" aria-pressed={mixerOpen} onClick={()=>setMixerOpen(v=>!v)}
            className={mixerOpen ? 'rounded-md bg-cyan-400/15 px-2.5 py-1.5 text-cyan-200' : 'rounded-md bg-white/5 px-2.5 py-1.5 text-slate-300'}>
            <SlidersHorizontal size={14} className="mr-1 inline"/> Mixer
          </button>
          <button type="button" aria-pressed={helpOpen} onClick={()=>setHelpOpen(v=>!v)}
            className="rounded-md bg-white/5 px-2.5 py-1.5 text-slate-300" title="Keyboard shortcuts">
            <Keyboard size={14} className="mr-1 inline"/> Help
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div className={browserOpen
          ? "relative h-52 w-full shrink-0 border-b border-white/10 md:h-full md:w-[var(--browser-width)] md:border-b-0"
          : "hidden"}
          style={{'--browser-width': browserWidth + 'px'} as React.CSSProperties}>
          <MusicStudioBrowser />
          <div role="separator" aria-orientation="vertical" aria-label="Resize sample browser"
            className="absolute right-0 top-0 z-40 hidden h-full w-1.5 cursor-col-resize hover:bg-cyan-300/50 md:block"
            onPointerDown={event=>{
              const startX=event.clientX;
              const startWidth=browserWidth;
              const onMove=(move:PointerEvent)=>setBrowserWidth(Math.max(260,Math.min(520,startWidth+move.clientX-startX)));
              const onUp=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
              window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
            }} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {helpOpen && <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 border-b border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-[11px] text-slate-300">
            <span><strong className="text-cyan-200">Space</strong> Play / pause</span>
            <span><strong className="text-cyan-200">R</strong> Record</span>
            <span><strong className="text-cyan-200">S</strong> Split at playhead</span>
            <span><strong className="text-cyan-200">Delete</strong> Remove selected clip</span>
            <span><strong className="text-cyan-200">Ctrl/Cmd+Z</strong> Undo</span>
            <span><strong className="text-cyan-200">V / E</strong> Select / Erase</span>
            <span><strong className="text-cyan-200">B / I / M</strong> Browser / Inspector / Mixer</span>
            <span><strong className="text-cyan-200">Ctrl/Cmd+D</strong> Duplicate clip</span>
            <span><strong className="text-cyan-200">← / →</strong> Seek one beat</span>
            <span><strong className="text-cyan-200">[ / ]</strong> Loop points</span>
          </div>}
          <DAWTimeline />
        </div>
        {inspectorOpen && <div className="absolute bottom-0 right-0 top-0 z-30 w-[min(320px,90vw)] shadow-2xl lg:relative lg:w-[278px] lg:shadow-none">
          <DAWInspector onClose={()=>setInspectorOpen(false)} />
        </div>}
      </div>
      <div className={mixerOpen ? 'shrink-0' : 'hidden'}>
        <DAWMixerPanel expanded={mixerOpen} onExpandedChange={setMixerOpen}/>
      </div>

      {/* Active Recording HUD Overlay */}
      {isRecording && (
        <div className="fixed bottom-12 right-6 z-50 bg-[#160c10] border-2 border-rose-500/80 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-10 h-10 rounded-full bg-rose-600/30 flex items-center justify-center border border-rose-500 animate-pulse">
            <Mic size={20} className="text-rose-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                RECORDING ON: {armedTrack?.name || 'Vocal'}
              </span>
            </div>
            <div className="text-sm font-mono font-black text-white mt-0.5">
              0:{Math.floor(recordingDuration).toString().padStart(2, '0')}.{Math.floor((recordingDuration % 1) * 10)}s
            </div>
          </div>

          {/* Live Mic Input Level Meter */}
          <div className="w-2.5 h-12 bg-black rounded overflow-hidden border border-white/20 flex flex-col justify-end p-0.5">
            <div 
              className="w-full rounded transition-all duration-75"
              style={{
                height: `${Math.min(100, inputLevel * 180)}%`,
                backgroundColor: inputLevel > 0.85 ? '#f43f5e' : '#10b981'
              }}
            />
          </div>

          <button
            onClick={stopRecording}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
          >
            STOP (R)
          </button>
        </div>
      )}
    </div>
  );
}
