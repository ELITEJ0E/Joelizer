import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, Square, Circle, Repeat, Scissors, MousePointer, 
  Trash2, ZoomIn, ZoomOut, Undo2, Redo2, Plus, Download, 
  Sparkles, Layers, Volume2, Mic, Settings, Sliders, ChevronDown, Check
} from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';
import { TrackType, TimelineTool } from '../../types/daw';

const KEYS = [
  'C Major', 'C Minor', 'C# Major', 'C# Minor',
  'D Major', 'D Minor', 'Eb Major', 'Eb Minor',
  'E Major', 'E Minor', 'F Major', 'F Minor',
  'F# Major', 'F# Minor', 'G Major', 'G Minor',
  'Ab Major', 'Ab Minor', 'A Major', 'A Minor',
  'Bb Major', 'Bb Minor', 'B Major', 'B Minor'
];

export function DAWTopBar() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setActiveTab = useStore(s => s.setActiveTab);

  const projectName = useDAWStore(s => s.projectName);
  const setProjectName = useDAWStore(s => s.setProjectName);
  const bpm = useDAWStore(s => s.bpm);
  const setBpm = useDAWStore(s => s.setBpm);
  const key = useDAWStore(s => s.key);
  const setKey = useDAWStore(s => s.setKey);
  const timeSignature = useDAWStore(s => s.timeSignature);
  const setTimeSignature = useDAWStore(s => s.setTimeSignature);
  
  const isPlaying = useDAWStore(s => s.isPlaying);
  const play = useDAWStore(s => s.play);
  const pause = useDAWStore(s => s.pause);
  const stop = useDAWStore(s => s.stop);
  const currentTime = useDAWStore(s => s.currentTime);

  const isRecording = useDAWStore(s => s.isRecording);
  const startRecording = useDAWStore(s => s.startRecording);
  const stopRecording = useDAWStore(s => s.stopRecording);
  const armedTrackId = useDAWStore(s => s.armedTrackId);

  const isLooping = useDAWStore(s => s.isLooping);
  const toggleLoop = useDAWStore(s => s.toggleLoop);

  const activeTool = useDAWStore(s => s.activeTool);
  const setActiveTool = useDAWStore(s => s.setActiveTool);

  const snapToGrid = useDAWStore(s => s.snapToGrid);
  const setSnapToGrid = useDAWStore(s => s.setSnapToGrid);
  const gridDivision = useDAWStore(s => s.gridDivision);
  const setGridDivision = useDAWStore(s => s.setGridDivision);

  const timelineZoom = useDAWStore(s => s.timelineZoom);
  const setTimelineZoom = useDAWStore(s => s.setTimelineZoom);

  const masterVolume = useDAWStore(s => s.masterVolume);
  const setMasterVolume = useDAWStore(s => s.setMasterVolume);

  const undo = useDAWStore(s => s.undo);
  const redo = useDAWStore(s => s.redo);
  const historyIndex = useDAWStore(s => s.historyIndex);
  const history = useDAWStore(s => s.history);

  const addTrack = useDAWStore(s => s.addTrack);
  const tracks = useDAWStore(s => s.tracks);
  const projectDuration = useDAWStore(s => s.projectDuration);
  const getCanonicalProjectJson = useDAWStore(s => s.getCanonicalProjectJson);

  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Format time MM:SS:ms
  const formatTransportTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const millis = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  const handleExportWav = async () => {
    try {
      setIsExporting(true);
      setExportNotice('Rendering multitrack master mix to WAV...');
      const wavBlob = await dawAudioEngine.bounceProjectToWav(tracks, projectDuration);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_Master.wav`;
      a.click();
      setExportNotice('WAV Render downloaded!');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      alert(`WAV Render Failed: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleSendToMVStudio = async () => {
    try {
      setIsExporting(true);
      setExportNotice('Bouncing multitrack mix for Music Video Studio...');
      const wavBlob = await dawAudioEngine.bounceProjectToWav(tracks, projectDuration);
      const audioUrl = URL.createObjectURL(wavBlob);

      // Load into primary project store
      const primaryStore = useStore.getState();
      primaryStore.setAudio(wavBlob, audioUrl, projectDuration, undefined);
      primaryStore.setName(projectName);

      // Add to MV studio timeline
      const mvStore = useMVStore.getState();
      mvStore.setTimelineClips([
        {
          id: `mv-clip-master-${Date.now()}`,
          assetId: `asset-master-${Date.now()}`,
          startTime: 0,
          endTime: projectDuration,
          trimStart: 0,
          trimEnd: projectDuration,
          locked: false
        }
      ]);

      setExportNotice('Loaded into MV Studio!');
      setTimeout(() => {
        setExportNotice(null);
        setActiveTab('mv-studio');
      }, 1000);
    } catch (err: any) {
      alert(`Export to MV failed: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportProjectJson = () => {
    const projectJson = getCanonicalProjectJson();
    const blob = new Blob([JSON.stringify(projectJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.joelizer.json`;
    a.click();
    setShowExportMenu(false);
  };

  return (
    <div className="h-14 bg-[#0c0d12] border-b border-white/10 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 select-none text-slate-200 z-30">
      {/* Toast Notice */}
      {exportNotice && (
        <div 
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider text-black shadow-2xl flex items-center gap-2 animate-bounce"
          style={{ backgroundColor: activeColor, borderColor: '#ffffff', boxShadow: `0 0 20px ${activeColor}` }}
        >
          <Sparkles size={14} />
          {exportNotice}
        </div>
      )}

      {/* LEFT: Project Title & Global Musical Specs */}
      <div className="flex items-center gap-3 min-w-0">
        <input
          type="text"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          className="bg-transparent text-sm font-black text-white hover:bg-white/5 focus:bg-black/60 px-2 py-1 rounded border border-transparent focus:border-white/20 focus:outline-none max-w-[140px] sm:max-w-[200px] truncate"
          title="Click to rename project"
        />

        {/* BPM Input */}
        <div className="hidden sm:flex items-center gap-1 bg-black/60 border border-white/10 px-2 py-1 rounded-md text-xs font-mono">
          <span className="text-[10px] text-slate-500 font-bold uppercase">BPM</span>
          <input
            type="number"
            min={40}
            max={280}
            value={bpm}
            onChange={e => setBpm(parseInt(e.target.value) || 120)}
            className="w-11 bg-transparent text-center font-black text-emerald-400 focus:outline-none"
          />
        </div>

        {/* Key Selector */}
        <div className="hidden md:flex items-center gap-1 bg-black/60 border border-white/10 px-2 py-1 rounded-md text-xs font-mono">
          <span className="text-[10px] text-slate-500 font-bold uppercase">KEY</span>
          <select
            value={key}
            onChange={e => setKey(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
          >
            {KEYS.map(k => (
              <option key={k} value={k} className="bg-[#0c0d12] text-white">{k}</option>
            ))}
          </select>
        </div>

        {/* Time Signature */}
        <div className="hidden lg:flex items-center gap-1 bg-black/60 border border-white/10 px-2 py-1 rounded-md text-xs font-mono">
          <select
            value={timeSignature}
            onChange={e => setTimeSignature(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="4/4" className="bg-[#0c0d12]">4/4</option>
            <option value="3/4" className="bg-[#0c0d12]">3/4</option>
            <option value="6/8" className="bg-[#0c0d12]">6/8</option>
          </select>
        </div>
      </div>

      {/* CENTER: Transport Controls (Play, Pause, Stop, Record, Display) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Time Display */}
        <div className="bg-black border border-white/15 px-3 py-1 rounded-lg text-xs font-mono font-black text-emerald-400 tracking-wider shadow-inner hidden sm:block">
          {formatTransportTime(currentTime)}
        </div>

        {/* Stop Button */}
        <button
          onClick={stop}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
          title="Stop & Reset to 0:00 (Space)"
        >
          <Square size={14} className="fill-current" />
        </button>

        {/* Play / Pause Toggle */}
        <button
          onClick={isPlaying ? pause : play}
          className="p-2.5 rounded-xl border text-black font-black transition-all shadow-lg active:scale-95"
          style={{ 
            backgroundColor: activeColor, 
            borderColor: '#ffffff',
            boxShadow: `0 0 15px ${activeColor}60`
          }}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause size={16} className="fill-black" />
          ) : (
            <Play size={16} className="fill-black ml-0.5" />
          )}
        </button>

        {/* Record Take Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2.5 rounded-xl border font-bold transition-all ${
            isRecording
              ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-lg shadow-rose-600/50'
              : armedTrackId
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-rose-400'
          }`}
          title={isRecording ? 'Stop Recording Take' : 'Record Audio Take (R)'}
        >
          <Circle size={15} className={isRecording ? 'fill-white' : 'fill-current'} />
        </button>

        {/* Loop Toggle */}
        <button
          onClick={toggleLoop}
          className={`p-2 rounded-lg border transition-colors ${
            isLooping
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
          }`}
          title="Toggle Loop Cycle"
        >
          <Repeat size={14} />
        </button>
      </div>

      {/* RIGHT: Tools, Zoom, Add Track, Mix & Export */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Tool Switcher */}
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded transition-all ${activeTool === 'select' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Pointer / Select Tool (V)"
          >
            <MousePointer size={13} />
          </button>
          <button
            onClick={() => setActiveTool('split')}
            className={`p-1.5 rounded transition-all ${activeTool === 'split' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Razor / Split Tool (S)"
          >
            <Scissors size={13} />
          </button>
          <button
            onClick={() => setActiveTool('erase')}
            className={`p-1.5 rounded transition-all ${activeTool === 'erase' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Eraser Tool (E)"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Snap to Grid */}
        <div className="hidden xl:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs">
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`text-[10px] font-mono font-bold uppercase transition-colors ${snapToGrid ? 'text-emerald-400' : 'text-slate-500'}`}
          >
            Snap: {snapToGrid ? 'ON' : 'OFF'}
          </button>
          <select
            value={gridDivision}
            onChange={e => setGridDivision(e.target.value as any)}
            className="bg-transparent text-[10px] font-mono font-bold text-slate-300 focus:outline-none"
          >
            <option value="1/1" className="bg-[#0c0d12]">1/1 Bar</option>
            <option value="1/2" className="bg-[#0c0d12]">1/2</option>
            <option value="1/4" className="bg-[#0c0d12]">1/4 Beat</option>
            <option value="1/8" className="bg-[#0c0d12]">1/8</option>
            <option value="1/16" className="bg-[#0c0d12]">1/16</option>
          </select>
        </div>

        {/* Zoom */}
        <div className="hidden lg:flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            onClick={() => setTimelineZoom(z => z - 15)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[9px] font-mono px-1 text-slate-400">{Math.round(timelineZoom)}px</span>
          <button
            onClick={() => setTimelineZoom(z => z + 15)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Add Track Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAddTrackMenu(!showAddTrackMenu)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Track</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {showAddTrackMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#12131a] border border-white/15 rounded-xl shadow-2xl py-1 z-50 text-xs">
              {(['VOCAL', 'GUITAR', 'DRUMS', 'SYNTH', 'KEYS', 'BASS', 'AUDIO', 'AI'] as TrackType[]).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    addTrack(type);
                    setShowAddTrackMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between text-slate-200 font-bold transition-colors"
                >
                  <span>+ {type} Track</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: useDAWStore.getState().tracks[0]?.color }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export / Mix Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: activeColor }}
          >
            <Download size={13} />
            <span>Mix</span>
            <ChevronDown size={11} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#12131a] border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
              <button
                onClick={handleExportWav}
                className="w-full px-3 py-2 text-left hover:bg-white/10 rounded-lg flex items-center gap-2 text-white font-bold"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Bounce Master WAV</span>
              </button>
              <button
                onClick={handleSendToMVStudio}
                className="w-full px-3 py-2 text-left hover:bg-white/10 rounded-lg flex items-center gap-2 text-white font-bold"
              >
                <Layers size={13} className="text-cyan-400" />
                <span>Send Mix to MV Studio</span>
              </button>
              <button
                onClick={handleExportProjectJson}
                className="w-full px-3 py-2 text-left hover:bg-white/10 rounded-lg flex items-center gap-2 text-slate-300 font-bold"
              >
                <Settings size={13} className="text-purple-400" />
                <span>Export Project JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
