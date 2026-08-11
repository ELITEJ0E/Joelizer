import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, MediaAsset, TimelineClip } from '../../store/useMVStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { Cpu, Upload, Film, Image as ImageIcon, Sparkles, CheckCircle2, Layers, Sliders, Play } from 'lucide-react';
import { generateAutoEdit } from '../../lib/mvAutoEdit';

const MOTION_EFFECTS = [
  'ken-burns-in',
  'ken-burns-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down'
] as const;

export function MVStudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const audioDuration = useStore(s => s.audioDuration) || 120;
  const lyrics = useStore(s => s.lyricsSettings.lines);

  const [engineStatus, setEngineStatus] = useState<'offline' | 'checking' | 'online'>('checking');
  const setLocalEngineConnected = useMVStore(s => s.setLocalEngineConnected);
  
  const videoAssets = useMVStore(s => s.videoAssets);
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const timelineClips = useMVStore(s => s.timelineClips);
  const setTimelineClips = useMVStore(s => s.setTimelineClips);
  const style = useMVStore(s => s.style);
  const pacing = useMVStore(s => s.pacing);
  const beatSync = useMVStore(s => s.beatSync);
  const editSeed = useMVStore(s => s.editSeed);

  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    const checkEngine = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/mv/health');
        if (res.ok) {
          if (mounted) {
            setEngineStatus('online');
            setLocalEngineConnected(true);
          }
        } else {
          throw new Error('Not OK');
        }
      } catch {
        if (mounted) {
          setEngineStatus('offline');
          setLocalEngineConnected(false);
        }
      }
    };
    
    checkEngine();
    const interval = setInterval(checkEngine, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setLocalEngineConnected]);

  // Process video or image file, applying Ken Burns/Pan/Zoom effects to images
  const processAndAddMediaFile = async (file: File): Promise<{ asset: MediaAsset; clip: TimelineClip } | null> => {
    const isVideo = file.type.startsWith('video/') || !!file.name.match(/\.(mp4|mov|webm|m4v)$/i);
    const isImage = file.type.startsWith('image/') || !!file.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);

    if (!isVideo && !isImage) return null;

    const url = URL.createObjectURL(file);
    const id = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (isVideo) {
      return new Promise((resolve) => {
        const videoEl = document.createElement('video');
        videoEl.src = url;
        videoEl.muted = true;
        
        videoEl.onloadedmetadata = () => {
          videoEl.currentTime = Math.min(1, (videoEl.duration || 2) / 2);
        };

        videoEl.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = (videoEl.videoHeight / (videoEl.videoWidth || 1)) * 160 || 90;
          const ctx = canvas.getContext('2d');
          let thumb = '';
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            thumb = canvas.toDataURL('image/jpeg', 0.7);
          }

          const asset: MediaAsset = {
            id,
            file,
            url,
            name: file.name,
            mediaType: 'video',
            duration: videoEl.duration || 8,
            thumbnail: thumb,
            sourceType: 'local',
            status: 'ready'
          };

          const clip: TimelineClip = {
            id: `clip-${id}`,
            assetId: id,
            startTime: 0,
            endTime: Math.min(videoEl.duration || 8, 8),
            trimStart: 0,
            trimEnd: Math.min(videoEl.duration || 8, 8),
            mediaType: 'video',
            effect: 'none',
            transition: 'cut'
          };

          resolve({ asset, clip });
        };

        videoEl.onerror = () => {
          // Fallback if video metadata fails to seek
          const asset: MediaAsset = {
            id,
            file,
            url,
            name: file.name,
            mediaType: 'video',
            duration: 8,
            thumbnail: '',
            sourceType: 'local',
            status: 'ready'
          };
          const clip: TimelineClip = {
            id: `clip-${id}`,
            assetId: id,
            startTime: 0,
            endTime: 8,
            trimStart: 0,
            trimEnd: 8,
            mediaType: 'video',
            effect: 'none',
            transition: 'cut'
          };
          resolve({ asset, clip });
        };
      });
    } else {
      // Process Image and apply random Ken Burns / Pan / Zoom effect converting to valid video shot clip
      return new Promise((resolve) => {
        const img = new Image();
        img.src = url;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = (img.height / (img.width || 1)) * 160 || 90;
          const ctx = canvas.getContext('2d');
          let thumb = url;
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            thumb = canvas.toDataURL('image/jpeg', 0.8);
          }

          // Pick random Ken Burns / Pan / Zoom motion effect
          const randomEffect = MOTION_EFFECTS[Math.floor(Math.random() * MOTION_EFFECTS.length)];

          const asset: MediaAsset = {
            id,
            file,
            url,
            name: file.name,
            mediaType: 'image',
            duration: 8, // Standard 8s video shot duration for images
            thumbnail: thumb,
            sourceType: 'local',
            status: 'ready'
          };

          // Convert image asset into a valid motion 'video' clip in timeline state
          const clip: TimelineClip = {
            id: `clip-${id}`,
            assetId: id,
            startTime: 0,
            endTime: 8,
            trimStart: 0,
            trimEnd: 8,
            mediaType: 'image',
            effect: randomEffect, // Ken Burns / Pan / Zoom effect applied
            transition: 'fade'
          };

          resolve({ asset, clip });
        };

        img.onerror = () => {
          const randomEffect = MOTION_EFFECTS[Math.floor(Math.random() * MOTION_EFFECTS.length)];
          const asset: MediaAsset = {
            id,
            file,
            url,
            name: file.name,
            mediaType: 'image',
            duration: 8,
            thumbnail: url,
            sourceType: 'local',
            status: 'ready'
          };
          const clip: TimelineClip = {
            id: `clip-${id}`,
            assetId: id,
            startTime: 0,
            endTime: 8,
            trimStart: 0,
            trimEnd: 8,
            mediaType: 'image',
            effect: randomEffect,
            transition: 'fade'
          };
          resolve({ asset, clip });
        };
      });
    }
  };

  const handleFiles = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList);
    if (files.length === 0) return;

    setProcessingStatus(`Processing ${files.length} media file(s)...`);

    const newAssets: MediaAsset[] = [];
    const newClips: TimelineClip[] = [];

    for (const file of files) {
      const result = await processAndAddMediaFile(file);
      if (result) {
        newAssets.push(result.asset);
        newClips.push(result.clip);
        addVideoAsset(result.asset);
      }
    }

    if (newAssets.length > 0) {
      // Re-run auto edit to lay out all assets smoothly across the song timeline
      const currentAssets = [...useMVStore.getState().videoAssets];
      const autoEditResult = generateAutoEdit({
        songDuration: audioDuration,
        lyricsLines: lyrics,
        mediaAssets: currentAssets,
        style,
        pacing,
        beatSync,
        seed: editSeed
      });

      setTimelineClips(autoEditResult.timelineClips);
      useMVStore.getState().setSongAnalysis(autoEditResult.songAnalysis);
      useMVStore.getState().setWordTimings(autoEditResult.wordTimings);

      setProcessingStatus(`Added ${newAssets.length} asset(s) with dynamic Ken Burns motion!`);
      setTimeout(() => setProcessingStatus(null), 3500);
    } else {
      setProcessingStatus('No valid video or image files detected.');
      setTimeout(() => setProcessingStatus(null), 3000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[#030304] text-slate-300 font-sans select-none overflow-hidden">
      {/* Informational Engine Status Banner */}
      <div 
        className="border-b text-xs px-3 sm:px-4 py-1.5 flex items-center justify-between z-40 transition-colors shrink-0 bg-black/80 backdrop-blur-md"
        style={{ borderColor: `${activeColor}30` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span 
            className="w-2 h-2 rounded-full animate-pulse shrink-0" 
            style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} 
          />
          <span className="font-extrabold tracking-wider uppercase flex items-center gap-1.5 text-white text-[11px] sm:text-xs shrink-0">
            <Cpu size={13} style={{ color: activeColor }} />
            {engineStatus === 'online' ? 'LOCAL ENGINE ONLINE' : 'WEB & VERCEL ENGINE ACTIVE'}
          </span>
          <span className="opacity-80 hidden md:inline text-[11px] truncate">
            {engineStatus === 'online' 
              ? 'Local WhisperX alignment & FFmpeg export active on port 4000.' 
              : 'Client-side auto-editing & Ken Burns motion effects active.'}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono font-bold shrink-0">
          {/* Panel Toggle Shortcuts */}
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className={`px-2 py-0.5 rounded text-[10px] border transition-colors hidden sm:flex items-center gap-1 ${
              showLeftPanel ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-slate-500 border-white/10 hover:text-white'
            }`}
            title="Toggle Media Library"
          >
            <Layers size={11} />
            <span>Library</span>
          </button>

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`px-2 py-0.5 rounded text-[10px] border transition-colors hidden sm:flex items-center gap-1 ${
              showRightPanel ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-slate-500 border-white/10 hover:text-white'
            }`}
            title="Toggle Auto Edit Controls"
          >
            <Sliders size={11} />
            <span>Controls</span>
          </button>

          <span className="opacity-90 hidden lg:inline">Engine: <strong style={{ color: activeColor }}>READY</strong></span>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Media & Asset Library */}
        {showLeftPanel && (
          <div className="w-56 sm:w-64 lg:w-72 border-r border-white/10 flex flex-col bg-[#060608] shrink-0 transition-all">
            <MVAssetLibrary />
          </div>
        )}

        {/* Center: Main Drag & Drop Zone + Preview + Multitrack Timeline */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-[#020202]">
          
          {/* Compact Drag and Drop Media Header Zone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mx-2.5 mt-2 px-3 py-2 rounded-lg border border-dashed transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md shrink-0 relative overflow-hidden group ${
              isDragging 
                ? 'bg-black/90 scale-[1.005]' 
                : 'bg-black/50 hover:bg-black/75 border-white/20'
            }`}
            style={{
              borderColor: isDragging ? activeColor : undefined,
              boxShadow: isDragging ? `0 0 20px ${activeColor}30` : undefined
            }}
          >
            {/* Ambient background glow */}
            <div 
              className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
              style={{ background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)` }}
            />

            <input 
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />

            <div className="flex items-center gap-2.5 z-10 min-w-0">
              <div 
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105"
                style={{ 
                  backgroundColor: `${activeColor}15`, 
                  borderColor: `${activeColor}40`,
                  color: activeColor
                }}
              >
                <Upload size={14} />
              </div>
              
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1 shrink-0">
                  Media Drop
                  <Sparkles size={11} style={{ color: activeColor }} />
                </span>
                <span className="text-[9px] text-slate-400 font-mono truncate hidden md:inline">
                  Accepts <strong className="text-slate-200">MP4, MOV, WebM, PNG, JPG, WebP</strong>
                </span>
              </div>
            </div>

            {/* Badges & Format Pills */}
            <div className="flex items-center gap-2 z-10 shrink-0">
              <div className="hidden xl:flex gap-1">
                {['MP4', 'MOV', 'WEBM', 'PNG', 'JPG', 'WEBP'].map(fmt => (
                  <span 
                    key={fmt}
                    className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
              <span 
                className="text-[9px] font-extrabold px-2 py-0.5 rounded text-black uppercase tracking-wider shadow shrink-0"
                style={{ backgroundColor: activeColor }}
              >
                Upload
              </span>
            </div>

            {processingStatus && (
              <div 
                className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center text-[11px] font-bold font-mono px-4 z-20"
                style={{ color: activeColor }}
              >
                <Sparkles size={13} className="mr-2 animate-spin" />
                {processingStatus}
              </div>
            )}
          </div>

          {/* Video Preview Canvas Stage */}
          <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden">
            <MVPreview />
          </div>

          {/* Timeline Viewport */}
          <div className="h-48 sm:h-52 border-t border-white/10 shrink-0 bg-[#060608]">
            <MVTimeline />
          </div>
        </div>

        {/* Right: Auto Edit & Workflow Controls */}
        {showRightPanel && (
          <div className="w-64 sm:w-72 lg:w-80 border-l border-white/10 flex flex-col bg-[#060608] shrink-0 overflow-y-auto transition-all">
            <MVWorkflow />
          </div>
        )}
      </div>
    </div>
  );
}
