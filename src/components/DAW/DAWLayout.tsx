import React, { useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { DAWTopBar } from './DAWTopBar';
import { DAWTimeline } from './DAWTimeline';
import { DAWMixerPanel } from './DAWMixerPanel';
import { MusicStudioBrowser } from './MusicStudioBrowser';
import { DAWInspector } from './DAWInspector';
import { ArrangementMarkers } from './ArrangementMarkers';
import './studio.css';
import { Circle, Mic, Volume2, Sparkles, Plus, Layers, Zap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  const [browserOpen, setBrowserOpen] = useState(() => window.innerWidth >= 900);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth >= 1280);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => () => {
    const state = useDAWStore.getState();
    if (state.isPlaying) state.pause();
    if (state.isRecording) void state.stopRecording();
  }, []);

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input/textarea
      if (e.defaultPrevented || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],[role=dialog]')) {
        return;
      }
      if (e.code === 'Space' && (e.target as HTMLElement)?.closest('button')) return;

      const state = useDAWStore.getState();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'm') { e.preventDefault(); state.addMarker(); }
        if (e.key.toLowerCase() === 'l') { e.preventDefault(); state.loopSelectedClip(); }
        if (e.key.toLowerCase() === 'v') state.setActiveTool('select');
        if (e.key.toLowerCase() === 'e') state.setActiveTool('erase');
        if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); state.navigateMarker(-1); }
        if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); state.navigateMarker(1); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && state.selectedClipId) {
        e.preventDefault(); state.duplicateClip(state.selectedClipId);
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) pause();
        else play();
      }

      // R: Record
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (isRecording) stopRecording();
        else startRecording();
      }

      // S: Split selected clip at playhead
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        if (selectedClipId) {
          e.preventDefault();
          splitClip(selectedClipId, currentTime);
        }
      }

      // Delete / Backspace: Remove selected clip
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedClipId) {
          e.preventDefault();
          removeClip(selectedClipId);
        }
      }

      // Cmd+Z / Ctrl+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Cmd+Shift+Z / Ctrl+Y: Redo
      if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }

      // [ : Set Loop Region Start
      if ((e.key === '[' || (!e.shiftKey && e.code === 'BracketLeft')) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setLoopRegion(currentTime, Math.max(currentTime + 0.5, loopEnd));
      }

      // ] : Set Loop Region End
      if ((e.key === ']' || (!e.shiftKey && e.code === 'BracketRight')) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setLoopRegion(Math.min(loopStart, Math.max(0, currentTime - 0.5)), currentTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, play, pause, startRecording, stopRecording, selectedClipId, currentTime, splitClip, removeClip, undo, redo, setLoopRegion, loopStart, loopEnd]);

  const armedTrack = tracks.find(t => t.id === armedTrackId);
  const recordingDuration = Math.max(0, currentTime - recordingStartTime);

  return (
    <div className="music-workstation flex flex-col h-full w-full bg-[#080c14] overflow-hidden select-none font-sans relative">
      {/* Top Workstation Bar */}
      <DAWTopBar />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#0c111b] shrink-0 text-slate-300">
        <button className="studio-action" aria-expanded={browserOpen} aria-label={browserOpen ? 'Collapse instrument browser' : 'Expand instrument browser'} onClick={() => { setBrowserOpen(v => !v); if (window.innerWidth < 900) setInspectorOpen(false); }}><PanelLeftOpen size={13}/>Library</button>
        <span className="flex-1 text-[10px] uppercase tracking-[.15em] text-slate-500 truncate">{tracks.length} tracks · {tracks.reduce((n,t) => n + t.clips.length,0)} clips</span>
        <button className="studio-action" aria-pressed={helpOpen} onClick={() => setHelpOpen(v => !v)}>Shortcuts</button>
        <button className="studio-action" aria-expanded={inspectorOpen} onClick={() => { setInspectorOpen(v => !v); if (window.innerWidth < 900) setBrowserOpen(false); }}>Inspector</button>
      </div>
      {helpOpen && <div className="px-3 py-2 text-[11px] text-slate-300 bg-violet-400/10 border-b border-violet-400/20 shrink-0 leading-6">Space: play / pause · R: record · S: split · M: add marker · L: loop clip · Shift + arrows: markers · Ctrl / Cmd + D: duplicate · Ctrl / Cmd + Z: undo · Delete: remove clip</div>}
      <ArrangementMarkers />

      {/* Dedicated DAW — arrange clips against the transport alongside the sample library. */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className={browserOpen
          ? 'absolute inset-0 z-40 md:relative md:inset-auto w-full md:w-[300px] lg:w-[320px] min-w-0 shrink-0 overflow-hidden border-r border-white/10'
          : 'hidden'}>
          <MusicStudioBrowser />
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <DAWTimeline />
        </div>
        {inspectorOpen && <div className="absolute inset-0 z-40 md:left-auto md:w-[280px] xl:static xl:shrink-0 border-l border-white/10"><DAWInspector /></div>}
      </div>

      {/* Console Mixer Strip */}
      <DAWMixerPanel />

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
