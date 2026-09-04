import React, { useState, useRef, useEffect } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { GlobalSettingsPanel } from '../MVStudio/GlobalSettingsPanel';
import { ExportModal } from '../Editor/ExportModal';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { formatTime } from '../../lib/utils';
import { SongListSection } from './SongListSection';
import { Play, Pause, Check, Upload, Sparkles, Type, Film, Image as ImageIcon, Music, Download } from 'lucide-react';

export function LyricsVideoLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setVisualizerColor = (color: string) => useStore.getState().updateVisualizerSettings({ color });
  const [sidebarTab, setSidebarTab] = useState<'design'|'settings'>('design');
  const videoMode = useLyricsVideoStore(s => s.videoMode);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);
  const selectedTemplateId = useLyricsVideoStore(s => s.selectedTemplateId);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);
  const selectedBackgroundPresetId = useLyricsVideoStore(s => s.selectedBackgroundPresetId);
  const setSelectedBackgroundPresetId = useLyricsVideoStore(s => s.setSelectedBackgroundPresetId);
  const customBackground = useLyricsVideoStore(s => s.customBackground);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);
  const typographyOverride = useLyricsVideoStore(s => s.typographyOverride);
  const updateTypographyOverride = useLyricsVideoStore(s => s.updateTypographyOverride);
  const animationOverride = useLyricsVideoStore(s => s.animationOverride);
  const updateAnimationOverride = useLyricsVideoStore(s => s.updateAnimationOverride);
  const visibleLineCount = useLyricsVideoStore(s => s.visibleLineCount);
  const setVisibleLineCount = useLyricsVideoStore(s => s.setVisibleLineCount);
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);
  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const audioDuration = useStore(s => s.audioDuration) || 180;
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex] || s.tracks[0]);
  const albumArt = currentTrack?.albumArt || useStore(s => s.albumArt) || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
  const [showExportModal, setShowExportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVideoMode('lyrics-video'); }, [setVideoMode]);
  const LAYOUT_PRESETS: Array<{id:LyricTemplateId}> = [{id:'full'},{id:'square'},{id:'circle'},{id:'vinyl'},{id:'cd'},{id:'vinyl-needle'},{id:'cd-needle'}];
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file=e.target.files?.[0]; if(!file)return; const url=URL.createObjectURL(file); setCustomBackground(file.type.startsWith('video/')?{type:'video',value:url,videoUrl:url}:{type:'image',value:url}); };
  const handleWaveformScrub = (e: React.MouseEvent<HTMLDivElement>) => { const r=e.currentTarget.getBoundingClientRect(); setCurrentTime(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*audioDuration); };
  const playbackProgress=Math.max(0,Math.min(1,currentTime/(audioDuration||1)));
  const WAVEFORM_BARS=[0.25,0.4,0.65,0.85,0.45,0.3,0.55,0.75,0.9,0.6,0.35,0.5,0.7,0.95,0.8,0.4,0.25,0.6,0.85,0.5,0.3,0.45,0.75,0.9,0.65,0.35,0.5,0.8,1,0.7,0.4,0.25,0.6,0.85,0.55,0.35,0.5,0.75,0.9,0.6,0.3,0.45,0.7,0.95,0.8,0.4,0.25,0.55,0.85,0.5,0.3,0.5,0.75,0.9,0.65,0.35,0.45,0.8,0.95,0.7,0.4,0.25,0.55,0.85,0.5,0.3,0.45,0.75,0.6,0.35];

  return <div className="flex flex-col h-full bg-[#050508] text-slate-200 font-sans select-none overflow-hidden relative">
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
      <div className="w-full md:w-80 lg:w-96 bg-[#09090e] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto no-scrollbar p-4 gap-5 z-20">
        <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5"><button onClick={()=>setSidebarTab('design')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${sidebarTab==='design'?'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30':'text-slate-400'}`}>Quick Design</button><button onClick={()=>setSidebarTab('settings')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${sidebarTab==='settings'?'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30':'text-slate-400'}`}>Advanced Settings</button></div>
        {sidebarTab==='settings'?<div className="flex-1 -mx-4 -my-4 h-full"><GlobalSettingsPanel/></div>:<>
          <div className="pb-3 border-b border-white/10"><SongListSection/></div>
          <div className="space-y-3"><label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5"><Sparkles size={14} className="text-cyan-400"/>Layout</label><div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">{LAYOUT_PRESETS.map(layout=><button key={layout.id} onClick={()=>setSelectedTemplateId(layout.id)} className={`relative shrink-0 w-[72px] h-[96px] rounded-xl overflow-hidden border ${selectedTemplateId===layout.id?'border-cyan-400 ring-1 ring-cyan-400':'border-transparent'}`}><img src={albumArt} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm brightness-50"/><div className="absolute inset-0 flex items-center justify-center"><div className="w-11 h-11 rounded-full bg-black/70 border border-white/20"/></div>{selectedTemplateId===layout.id&&<div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center"><Check size={10}/></div>}</button>)}</div></div>
          <div className="space-y-3"><div className="flex items-center justify-between"><label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5"><ImageIcon size={14} className="text-cyan-400"/>Background</label><span className="text-[10px] text-slate-500">{BACKGROUND_PRESETS.length+1} styles</span></div><div className="grid grid-rows-3 grid-flow-col auto-cols-[104px] gap-2 overflow-x-auto pb-2 no-scrollbar h-[220px]"><button onClick={()=>fileInputRef.current?.click()} className="rounded-xl border border-dashed border-white/20 p-2 flex flex-col items-center justify-center gap-1 text-slate-400 bg-white/5"><Upload size={14} className="text-cyan-400"/><span className="text-[10px] font-extrabold uppercase text-white">Upload</span></button><input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleCustomFileUpload} className="hidden"/>{BACKGROUND_PRESETS.map(bg=><button key={bg.id} onClick={()=>{setSelectedBackgroundPresetId(bg.id);setCustomBackground({type:bg.type as any,value:bg.value})}} className={`relative rounded-xl overflow-hidden border p-1.5 text-left ${selectedBackgroundPresetId===bg.id?'border-cyan-400 ring-1 ring-cyan-400':'border-white/10'}`} style={{background:bg.previewGradient||bg.value||'#0a0a0e'}}><span className="absolute bottom-1 left-1 text-[7px] font-bold text-white bg-black/60 px-1 rounded">{bg.name}</span></button>)}</div></div>
          <div className="space-y-2.5"><label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5"><Film size={14} className="text-cyan-400"/>Aspect Ratio</label><div className="grid grid-cols-4 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">{(['16:9','9:16','1:1','4:3'] as AspectRatio[]).map(ar=><button key={ar} onClick={()=>{setAspectRatio(ar);resetElementPositions(ar)}} className={`py-2 rounded-lg text-xs font-bold ${aspectRatio===ar?'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40':'text-slate-400 hover:text-white'}`}>{ar}</button>)}</div></div>
          <div className="space-y-3 pt-2 border-t border-white/10"><label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5"><Type size={14} className="text-cyan-400"/>Style & Typography</label><div className="space-y-1.5"><span className="text-[11px] font-semibold text-slate-400">Font Family</span><select value={typographyOverride.fontFamily} onChange={e=>updateTypographyOverride({fontFamily:e.target.value})} className="w-full bg-black/70 border border-white/15 rounded-xl px-3 py-2 text-xs"><option>Outfit</option><option>Inter</option><option>Playfair Display</option><option>Space Grotesk</option><option>Plus Jakarta Sans</option><option>Cinzel</option></select></div><div className="space-y-1.5"><span className="text-[11px] font-semibold text-slate-400">Lyrics Animation</span><div className="grid grid-cols-2 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10"><button onClick={()=>updateAnimationOverride({wordAnimation:'karaoke'})} className={`py-2 rounded-lg text-xs font-bold ${animationOverride.wordAnimation==='karaoke'?'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40':'text-slate-400'}`}>Karaoke</button><button onClick={()=>updateAnimationOverride({wordAnimation:'word-fade'})} className={`py-2 rounded-lg text-xs font-bold ${animationOverride.wordAnimation==='word-fade'?'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40':'text-slate-400'}`}>Fade In / Out</button></div></div><div className="space-y-1.5"><span className="text-[11px] font-semibold text-slate-400">Lyrics Display Lines</span><div className="grid grid-cols-3 gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">{[1,2,5].map(n=><button key={n} onClick={()=>setVisibleLineCount(n)} className={`py-1.5 rounded-lg text-xs font-bold ${visibleLineCount===n?'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40':'text-slate-400'}`}>{n} {n===1?'Line':'Lines'}</button>)}</div></div><div className="space-y-1.5"><span className="text-[11px] font-semibold text-slate-400">Accent Color</span><div className="flex gap-2 flex-wrap bg-black/60 p-2 rounded-xl border border-white/10">{['#00e676','#38bdf8','#06b6d4','#c084fc','#f472b6','#fef08a','#fff'].map(c=><button key={c} onClick={()=>setVisualizerColor(c)} className="w-7 h-7 rounded-full border border-white/20" style={{background:c}}/></div></div></div>
        </>}
      </div>
      <div className="flex-1 min-w-0 bg-[#020204] flex flex-col relative overflow-hidden"><div className="flex-1 min-h-[320px] relative flex items-center justify-center p-2 sm:p-4 overflow-hidden"><MVPreview mode="lyrics-video"/></div><div className="bg-[#08080c] border-t border-white/10 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 shrink-0 z-30"><button onClick={()=>setIsPlaying(!isPlaying)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0">{isPlaying?<Pause size={20} fill="black"/>:<Play size={20} fill="black"/>}</button><div onClick={handleWaveformScrub} className="flex-1 h-12 bg-black/80 rounded-xl border border-white/10 px-3 flex items-center gap-3 cursor-pointer overflow-hidden"><div className="flex items-center gap-1 font-mono text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/40"><Music size={11}/><span>AUD</span></div><div className="flex-1 h-8 flex items-center gap-[2px]">{WAVEFORM_BARS.map((h,i)=><div key={i} className="flex-1 rounded-sm" style={{height:`${h*100}%`,backgroundColor:i/WAVEFORM_BARS.length<=playbackProgress?activeColor:'rgba(255,255,255,.15)'}}/>)}</div><div className="text-[11px] font-mono font-bold text-slate-300">{formatTime(currentTime)} / {formatTime(audioDuration)}</div></div><button onClick={()=>setShowExportModal(true)} className="px-4 py-2.5 rounded-full bg-white text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shrink-0" title="Export video"><Download size={16}/><span className="hidden sm:inline">Export</span></button></div></div>
    </div>{showExportModal&&<ExportModal onClose={()=>setShowExportModal(false)}/>}</div>;
}
