import React, { useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { DAWTopBar } from './DAWTopBar';
import { DAWTimeline } from './DAWTimeline';
import { DAWMixerPanel } from './DAWMixerPanel';
import { Circle, Mic, Volume2, Sparkles, Plus, Layers, Zap } from 'lucide-react';
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

  const [inputLevel, setInputLevel] = useState(0);

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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, play, pause, startRecording, stopRecording, selectedClipId, currentTime, splitClip, removeClip, undo, redo]);

  const armedTrack = tracks.find(t => t.id === armedTrackId);
  const recordingDuration = Math.max(0, currentTime - recordingStartTime);

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] overflow-hidden select-none font-sans relative">
      {/* Top Workstation Bar */}
      <DAWTopBar />

      {/* Main Multitrack Timeline Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        <DAWTimeline />
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
