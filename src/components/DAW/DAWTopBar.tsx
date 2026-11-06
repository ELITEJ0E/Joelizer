import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Square, Circle, Repeat, Scissors, MousePointer, 
  Trash2, ZoomIn, ZoomOut, Undo2, Redo2, Plus, Download, 
  Sparkles, Layers, Volume2, Mic, Settings, Sliders, ChevronDown, Check
} from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';
import { exportMusicSession, importMusicSession } from '../../lib/musicStudioArchive';
import { dawProjectAudioEnd } from '../../lib/dawMixing';
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
  const sessionInputRef = useRef<HTMLInputElement>(null);

  // Format time MM:SS:ms
  const formatTransportTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const millis = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  const mixDuration = () => {
    const audioEnd = dawProjectAudioEnd(tracks);
    if (audioEnd <= 0) throw new Error('Add or import an audio clip before exporting.');
    // Pad only a short safety tail, not the entire empty editing canvas.
    return Math.max(.2, Math.min(projectDuration, audioEnd + .1));
  };

  const handleExportWav = async () => {
    try {
      setIsExporting(true);
      setExportNotice('Rendering 24-bit stereo master with clip fades and -1 dBFS sample-peak safety...');
      const wavBlob = await dawAudioEngine.bounceProjectToWav(tracks, mixDuration(), 44100, masterVolume, 24);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_Master.wav`;
      a.click();
      setExportNotice('WAV Render downloaded!');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      setExportNotice(`WAV Render Failed: ${err?.message || err}`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleSendToMVStudio = async () => {
    try {
      setIsExporting(true);
      setExportNotice('Bouncing multitrack mix for Music Video Studio...');
      const wavBlob = await dawAudioEngine.bounceProjectToWav(tracks, mixDuration(), 44100, masterVolume, 24);
      const audioUrl = URL.createObjectURL(wavBlob);
      const renderedDuration = mixDuration();

      // Load into primary project store
      const primaryStore = useStore.getState();
      primaryStore.setAudio(wavBlob, audioUrl, renderedDuration, undefined);
      primaryStore.setName(projectName);

      // Add to MV studio timeline
      const mvStore = useMVStore.getState();
      mvStore.setTimelineClips([
        {
          id: `mv-clip-master-${Date.now()}`,
          assetId: `asset-master-${Date.now()}`,
          startTime: 0,
          endTime: renderedDuration,
          trimStart: 0,
          trimEnd: renderedDuration,
          locked: false
        }
      ]);

      setExportNotice('Loaded into MV Studio!');
      setTimeout(() => {
        setExportNotice(null);
        setActiveTab('mv-studio');
      }, 1000);
    } catch (err: any) {
      setExportNotice(`Export to MV failed: ${err?.message || err}`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleSaveSession = async () => {
    try {
      setIsExporting(true);
      setExportNotice('Packaging DAW project and original audio files...');
      const zip = await exportMusicSession(getCanonicalProjectJson());
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = projectName.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) + '.joelizer-session.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setExportNotice('Portable project archive downloaded.');
    } catch (e) {
      setExportNotice('Session save failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleOpenSession = async (file: File) => {
    try {
      setIsExporting(true);
      setExportNotice('Restoring portable project and audio assets...');
      const { project, fileCount } = await importMusicSession(file);
      useDAWStore.getState().loadCanonicalProjectJson(project);
      setExportNotice('Restored "' + project.name + '" with ' + fileCount + ' audio assets.');
    } catch (e) {
      setExportNotice('Session restore failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setIsExporting(false); }
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
    <header aria-label="Music Studio transport and project controls"
      className="relative z-40 shrink-0 border-b border-white/10 bg-[#0a101a] text-slate-200 shadow-[0_6px_24px_rgba(0,0,0,.28)]">
      {exportNotice && <div role="status" className="absolute left-1/2 top-full z-50 max-w-[90vw] -translate-x-1/2 rounded-b-lg border border-cyan-400/25 bg-[#132231] px-4 py-2 text-xs font-semibold text-cyan-100 shadow-xl">
        {exportNotice}
      </div>}
      <div className="flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-300/10 sm:flex">
            <Sparkles size={19} className="text-cyan-300"/>
          </div>
          <div className="min-w-0">
            <input aria-label="DAW project name" value={projectName}
              onChange={e=>setProjectName(e.target.value)}
              spellCheck={false}
              className="block w-full max-w-[240px] truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[14px] font-semibold tracking-tight text-white hover:border-white/15 focus:border-cyan-400/50 focus:outline-none"/>
            <span className="block px-1 text-[10px] font-medium text-slate-500">JOELIZER MUSIC STUDIO · MULTITRACK</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101927] p-1.5 shadow-inner">
          <button type="button" onClick={stop} aria-label="Stop" title="Stop"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><Square size={15} fill="currentColor"/></button>
          <button type="button" onClick={isPlaying?pause:play} aria-label={isPlaying?'Pause':'Play'} title="Play / pause (Space)"
            className="flex h-10 w-12 items-center justify-center rounded-lg bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.2)] hover:bg-cyan-300">
            {isPlaying?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}
          </button>
          <button type="button" onClick={isRecording?stopRecording:()=>void startRecording()}
            aria-label={isRecording?'Stop recording':'Record'} title={armedTrackId?'Record armed track (R)':'Arm a track then record (R)'}
            className={isRecording?'rounded-lg bg-rose-500/25 p-2 text-rose-300 animate-pulse':'rounded-lg p-2 text-rose-400 hover:bg-rose-500/10'}>
            <Circle size={18} fill={isRecording?'currentColor':'none'}/>
          </button>
          <button type="button" onClick={toggleLoop} aria-pressed={isLooping} aria-label="Loop playback"
            title="Loop playback" className={isLooping?'rounded-lg bg-cyan-400/15 p-2 text-cyan-300':'rounded-lg p-2 text-slate-400 hover:bg-white/10'}>
            <Repeat size={16}/>
          </button>
          <div className="min-w-[96px] border-l border-white/10 px-3 text-center font-mono text-[15px] font-semibold tabular-nums tracking-wider text-cyan-200 sm:min-w-[116px] sm:text-lg">
            {formatTransportTime(currentTime)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <input ref={sessionInputRef} aria-label="Open Music Studio session ZIP" type="file" accept=".zip,application/zip"
            className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void handleOpenSession(file);e.target.value='';}}/>
          <button type="button" disabled={isExporting} onClick={()=>sessionInputRef.current?.click()}
            className="hidden rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 sm:block">
            Open project
          </button>
          <button type="button" disabled={isExporting} onClick={()=>void handleSaveSession()}
            className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-40">
            Save session
          </button>
        <div className="relative shrink-0">
          <button type="button" aria-expanded={showAddTrackMenu} onClick={()=>setShowAddTrackMenu(!showAddTrackMenu)}
            className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-400/20">
            <Plus size={13}/> Add track <ChevronDown size={12}/>
          </button>
          {showAddTrackMenu && <div className="absolute left-0 top-full z-[90] mt-2 max-h-80 w-44 overflow-y-auto rounded-xl border border-white/15 bg-[#172333] p-1.5 shadow-2xl">
            {(['VOCAL','GUITAR','DRUMS','SYNTH','KEYS','BASS','AUDIO','AI'] as TrackType[]).map(type=>
              <button type="button" key={type}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10"
                onClick={()=>{addTrack(type);setShowAddTrackMenu(false);}}>+ {type.charAt(0)+type.slice(1).toLowerCase()}</button>)}
          </div>}
        </div>
          <div className="relative">
            <button type="button" aria-expanded={showExportMenu} disabled={isExporting}
              onClick={()=>setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-[#06151d] hover:bg-cyan-300 disabled:opacity-50">
              <Download size={14}/> Export <ChevronDown size={12}/>
            </button>
            {showExportMenu && <div className="absolute right-0 top-full z-[90] mt-2 w-60 rounded-xl border border-white/15 bg-[#162232] p-1.5 shadow-2xl">
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-white/10"
                onClick={()=>void handleExportWav()}><Download size={14} className="text-cyan-300"/> Export 24-bit WAV</button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-white/10"
                onClick={()=>void handleSendToMVStudio()}><Layers size={14} className="text-sky-300"/> Send mix to MV Studio</button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-white/10"
                onClick={()=>void handleSaveSession()}><Settings size={14} className="text-emerald-300"/> Save session with audio</button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-400 hover:bg-white/10"
                onClick={handleExportProjectJson}><Settings size={14}/> Export reference-only JSON</button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-white/10 sm:hidden"
                onClick={()=>{setShowExportMenu(false);sessionInputRef.current?.click();}}>Open project ZIP</button>
            </div>}
          </div>
        </div>
      </div>

      <div className="flex min-h-[48px] items-center gap-2 overflow-x-auto px-3 py-1.5 text-[11px] sm:px-4">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-3">
          <label className="flex items-center gap-1.5 text-slate-400">BPM
            <input aria-label="Tempo BPM" type="number" min={40} max={280} value={bpm}
              onChange={e=>setBpm(Number(e.target.value)||120)}
              className="w-[53px] rounded border border-white/10 bg-white/5 px-1.5 py-1 text-center font-mono font-bold text-cyan-300 outline-none focus:border-cyan-400/50"/>
          </label>
          <select aria-label="Song key" value={key} onChange={e=>setKey(e.target.value)}
            className="max-w-[100px] rounded border border-white/10 bg-[#172333] px-1.5 py-1 text-[11px] text-slate-200">
            {KEYS.map(item=><option key={item}>{item}</option>)}
          </select>
          <select aria-label="Time signature" value={timeSignature} onChange={e=>setTimeSignature(e.target.value)}
            className="rounded border border-white/10 bg-[#172333] px-1.5 py-1 text-[11px] text-slate-200">
            {['4/4','3/4','6/8'].map(item=><option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-r border-white/10 pr-2">
          {([
            ['select','Select clip','Pointer / select (V)',MousePointer],
            ['split','Split clip','Split (S)',Scissors],
            ['erase','Erase clip','Erase (E)',Trash2]
          ] as const).map(([tool, aria, title, Icon])=>
            <button type="button" key={tool} aria-label={aria} aria-pressed={activeTool===tool}
              title={title} onClick={()=>setActiveTool(tool)}
              className={activeTool===tool?'rounded-lg bg-cyan-400/15 p-2 text-cyan-200':'rounded-lg p-2 text-slate-400 hover:bg-white/10'}>
              <Icon size={15}/>
            </button>)}
        </div>
        <div className="flex shrink-0 items-center gap-1 border-r border-white/10 pr-3">
          <button type="button" aria-label="Toggle snap" aria-pressed={snapToGrid}
            onClick={()=>setSnapToGrid(!snapToGrid)}
            className={snapToGrid?'rounded-md bg-cyan-400/15 px-2 py-1.5 font-semibold text-cyan-200':'rounded-md bg-white/5 px-2 py-1.5 text-slate-400'}>
            Snap {snapToGrid?'On':'Off'}
          </button>
          <select aria-label="Snap grid" value={gridDivision}
            onChange={e=>setGridDivision(e.target.value as typeof gridDivision)}
            className="rounded border border-white/10 bg-[#172333] px-1.5 py-1.5 text-[11px]">
            {['1/1','1/2','1/4','1/8','1/16','1/32','off'].map(item=><option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-r border-white/10 pr-3">
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>setTimelineZoom(v=>v-15)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10"><ZoomOut size={16}/></button>
          <span className="w-11 text-center font-mono text-slate-400">{Math.round(timelineZoom)}px</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>setTimelineZoom(v=>v+15)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10"><ZoomIn size={16}/></button>
          <button type="button" aria-label="Fit song to timeline" title="Fit song to timeline"
            onClick={()=>{
              const length=Math.max(15,dawProjectAudioEnd(tracks)||projectDuration);
              const visible=Math.max(360,Math.min(1400,window.innerWidth*.58));
              setTimelineZoom(Math.max(4,Math.min(300,visible/length)));
            }}
            className="rounded border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/10">Fit</button>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-r border-white/10 pr-3">
          <button type="button" aria-label="Undo" disabled={historyIndex===0} title="Undo" onClick={undo}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-25"><Undo2 size={15}/></button>
          <button type="button" aria-label="Redo" disabled={historyIndex>=history.length-1} title="Redo" onClick={redo}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-25"><Redo2 size={15}/></button>
        </div>
        <label className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-[10px] text-slate-500">
          <Volume2 size={14} className="text-cyan-300"/> Master
          <input aria-label="Master level" type="range" min="0" max="1.5" step=".01" value={masterVolume}
            className="w-20 accent-cyan-400" onChange={e=>setMasterVolume(Number(e.target.value))}/>
          <span className="w-8 font-mono tabular-nums text-slate-300">{Math.round(masterVolume*100)}%</span>
        </label>
      </div>
    </header>
  );
}
