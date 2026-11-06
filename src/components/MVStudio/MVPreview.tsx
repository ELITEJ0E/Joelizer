import { getVideoSyncDecision } from '../../lib/videoPlaybackSync';
import { layoutMVCaption, drawMVCaption, MVCaptionLayout } from '../../lib/mvCaptionLayout';
import { getBrowserExportTime, sampleBrowserExportVideo } from '../../lib/browserExportClock';
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { renderLyricsVideoFrame, renderLyricsOverlayFrame, syncLyricsBackgroundVideo, pauseInactiveLyricsBackgroundVideos } from '../../lib/lyricsEngine';
import { audioManager } from '../../lib/audio';
import { renderVisualizer } from '../../lib/renderers';
import { drawFramedMedia } from '../../lib/lyricsBackgrounds';
import { drawPositionedLyricsVisualizer } from '../../lib/positionedLyricsVisualizer';
import { getDefaultPositions } from '../../lib/lyricsLayout';
import { InteractiveStageOverlay } from '../LyricsStudio/InteractiveStageOverlay';
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVPreview({ mode }: { mode?: 'lyrics-video' | 'music-video' }) {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const currentTime = useStore(s => s.currentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const audioDuration = useStore(s => s.audioDuration);
  const aspectRatio = useStore(s => s.aspectRatio);

  const videoAssets = useMVStore(s => s.videoAssets);
  const updateTimelineClip = useMVStore(s => s.updateTimelineClip);
  const customBackground = useLyricsVideoStore(s => s.customBackground);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);
  const [adjustVideo, setAdjustVideo] = useState(false);
  const adjustmentGesture = useRef<{ x: number; y: number; startX: number; startY: number; zoom: number; height: number; operation: 'move' | 'resize' } | null>(null);
  const timelineClips = useMVStore(s => s.timelineClips);
  const storeVideoMode = useLyricsVideoStore(s => s.videoMode);
  const videoMode = mode || storeVideoMode;
  
  const activeClip = timelineClips.find(c => currentTime >= c.startTime && currentTime <= c.endTime);
  const isVinylScene = activeClip && (activeClip.type === 'vinyl-lyrics' || activeClip.assetId === 'vinyl-lyrics');
  const isVisualizerScene = activeClip && (activeClip.type === 'visualizer' || activeClip.assetId === 'visualizer');
  const activeAssetType = videoAssets.find(a => a.id === activeClip?.assetId)?.type;
  const editableClip = videoMode === 'music-video' && activeClip &&
    (activeClip.type === 'video' || (!activeClip.type && activeAssetType === 'video'));
  const editableVideo = videoMode === 'lyrics-video' ? customBackground.type === 'video' : !!editableClip;
  const frameSettings = videoMode === 'lyrics-video' ? customBackground : activeClip;
  const updateFrameSettings = (settings: { offsetX?: number; offsetY?: number; zoom?: number; heightScale?: number; fit?: 'contain' | 'cover' }) => {
    if (videoMode === 'lyrics-video') setCustomBackground(settings);
    else if (editableClip && !editableClip.locked) updateTimelineClip(editableClip.id, settings);
  };
  const startAdjustment = (e: React.PointerEvent, operation: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    if (!editableVideo || (editableClip && editableClip.locked)) return;
    adjustmentGesture.current = {
      x: e.clientX, y: e.clientY,
      startX: frameSettings?.offsetX ?? 0,
      startY: frameSettings?.offsetY ?? 0,
      zoom: frameSettings?.zoom ?? 1,
      height: frameSettings?.heightScale ?? 1,
      operation
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveAdjustment = (e: React.PointerEvent) => {
    const gesture = adjustmentGesture.current;
    if (!gesture) return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (gesture.operation === 'move') {
      updateFrameSettings({
        offsetX: Math.max(-1, Math.min(1, gesture.startX + 2 * dx / rect.width)),
        offsetY: Math.max(-1, Math.min(1, gesture.startY + 2 * dy / rect.height))
      });
    } else {
      updateFrameSettings({
        zoom: Math.max(0.25, Math.min(4, gesture.zoom * (1 + dx / rect.width * 2))),
        heightScale: Math.max(0.25, Math.min(3, gesture.height * (1 + dy / rect.height * 2)))
      });
    }
  };

  // Interactive drag, resize, and alignment overlay in both Lyrics mode and compatible MV Studio scenes
  const showOverlay = videoMode === 'lyrics-video' ||
    (videoMode === 'music-video' && (!!isVinylScene || !!isVisualizerScene || timelineClips.length === 0));

  const mvFilterKeys = isVinylScene
    ? undefined
    : isVisualizerScene
      ? (['visualizer'] as any)
      : undefined;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageDimensions, setStageDimensions] = useState({ width: 640, height: 360 });
  const [availableStage, setAvailableStage] = useState({ width: 0, height: 0 });
  const [stageHovered, setStageHovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Portaled dialogs are outside the preview's DOM tree. They suppress the
  // central play button even if a pointer previously hovered over the stage.
  useEffect(() => {
    const sync = () => {
      const open = !!document.querySelector('[data-mv-dialog]');
      setDialogOpen(open);
      if (open) setStageHovered(false);
    };
    window.addEventListener('mv-dialog-state', sync);
    sync();
    return () => window.removeEventListener('mv-dialog-state', sync);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setAvailableStage({ width: node.clientWidth, height: node.clientHeight });
    });
    observer.observe(node);
    setAvailableStage({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Sync canvas container dimensions for accurate interactive stage drag overlay
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setStageDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [aspectRatio]);

  // Sync fullscreen state with document
  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Asset element caches to avoid re-creating elements and avoid black frames on transitions
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const lastActiveVideoClipRef = useRef<string | null>(null);
  const pausedClipTimelineRef = useRef<Map<string, number>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Keep asset caches updated with crossOrigin = 'anonymous' for clean canvas rendering
  useEffect(() => {
    videoAssets.forEach((asset) => {
      if (!asset.url) return;
      
      if (asset.type === 'video' && !videoElementsRef.current.has(asset.url)) {
        const v = document.createElement('video');
        v.src = asset.url;
        v.muted = true;
        v.playsInline = true;
        v.crossOrigin = 'anonymous';
        v.preload = 'auto';
        videoElementsRef.current.set(asset.url, v);
      } else if (asset.type === 'image' && !imageElementsRef.current.has(asset.url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.url || asset.thumbnail || '';
        imageElementsRef.current.set(asset.url, img);
      }
    });
  }, [videoAssets]);

  const aspectValues: Record<string, [number, number]> = {
    '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1],
    '4:5': [4, 5], '3:4': [3, 4], '4:3': [4, 3]
  };
  const [ratioWidth, ratioHeight] = aspectValues[aspectRatio] || aspectValues['16:9'];
  // Pixel-sized contain calculation avoids clipping and distorted aspect
  // ratios when the preview pane is shorter or narrower than the video.
  const stageScale = Math.max(0.1, Math.min(
    Math.max(1, availableStage.width - 16) / ratioWidth,
    Math.max(1, availableStage.height - 16) / ratioHeight
  ));
  const displayWidth = Math.floor(ratioWidth * stageScale);
  const displayHeight = Math.floor(ratioHeight * stageScale);

  // Continuous Canvas Renderer Loop (Serves both live preview and high-quality ExportModal recording)
  useEffect(() => {
    let animFrameId: number;
    let captionCache: { line: object; width: number; height: number; layout: MVCaptionLayout } | null = null;

    const render = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          animFrameId = requestAnimationFrame(render);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          animFrameId = requestAnimationFrame(render);
          return;
        }

        // Read real-time state safely from stores
        const storeState = useStore.getState();
        const mvState = useMVStore.getState();
        const lyricsVideoState = useLyricsVideoStore.getState();

        // Determine active video mode: prop takes priority over store
        const activeVideoMode = mode || lyricsVideoState.videoMode;

        // Use a monotonic export clock when audio is missing, ends early or stalls.
        const exportTime = getBrowserExportTime();
        const playing = storeState.isPlaying || exportTime !== null;
        const curTime = exportTime ?? (playing ? audioManager.getPreciseCurrentTime() : storeState.currentTime);
        const resOverride = storeState.exportResolutionOverride;

        // 1. Calculate Target Canvas Resolution
        let baseRes = 1080;
        if (resOverride === '720p') baseRes = 720;
        if (resOverride === '360p') baseRes = 360;

        let targetW = baseRes * (16 / 9);
        let targetH = baseRes;
        if (aspectRatio === '9:16') {
          targetW = baseRes * (9 / 16);
          targetH = baseRes;
        } else if (aspectRatio === '1:1') {
          targetW = baseRes;
          targetH = baseRes;
        } else if (aspectRatio === '4:5') {
          targetW = baseRes * (4 / 5);
          targetH = baseRes;
        } else if (aspectRatio === '3:4') {
          targetW = baseRes * (3 / 4);
          targetH = baseRes;
        } else if (aspectRatio === '4:3') {
          targetW = baseRes * (4 / 3);
          targetH = baseRes;
        }

        targetW = Math.round(targetW);
        targetH = Math.round(targetH);

        // Only resize canvas buffer if dimensions actually changed (prevents flicker & state resets)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const W = canvas.width;
        const H = canvas.height;

        // Clear Canvas Background for MUSIC VIDEO Mode
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, W, H);

        // 2. Find Active Timeline Clip at current time
        const clips = mvState.timelineClips;
        const assets = mvState.videoAssets;
        const activeClip = clips.find(c => curTime >= c.startTime && curTime < c.endTime);
        // Inactive HTML video sources must not keep decoding in the background.
        // Otherwise each transition consumes an additional decoder and the
        // canvas recording drops frames progressively as the edit gets longer.
        const activeAsset = activeClip ? assets.find(a => a.id === activeClip.assetId) : null;
        const activeVideoUrl = activeClip?.type === 'video' || activeAsset?.type === 'video'
          ? activeAsset?.url
          : null;
        for (const [url, video] of videoElementsRef.current) {
          if (url !== activeVideoUrl && !video.paused) {
            video.pause();
            video.playbackRate = 1;
          }
        }
        if (!activeVideoUrl) lastActiveVideoClipRef.current = null;

        const isVinylScene = activeClip && (activeClip.type === 'vinyl-lyrics' || activeClip.assetId === 'vinyl-lyrics');
        const isVisualizerScene = activeClip && (activeClip.type === 'visualizer' || activeClip.assetId === 'visualizer');

        const showingLyricsScene = activeVideoMode === 'lyrics-video' ||
          (activeVideoMode === 'music-video' && !!isVinylScene);
        const activeBackground = lyricsVideoState.customBackground;
        const activeBackgroundUrl = showingLyricsScene && activeBackground.type === 'video'
          ? (activeBackground.videoUrl || activeBackground.value)
          : undefined;
        pauseInactiveLyricsBackgroundVideos(activeBackgroundUrl);

        if (activeVideoMode === 'lyrics-video' || (activeVideoMode === 'music-video' && isVinylScene)) {
          // Only the live preview owns playback/pausing of this background.
          // Export uses its own decoded video element and timeline clock.
          const bg = lyricsVideoState.customBackground;
          syncLyricsBackgroundVideo(
            bg.type === 'video' ? (bg.videoUrl || bg.value) : undefined,
            curTime, playing
          );
          // Render Vinyl Lyrics Scene
          const currentTrack = storeState.tracks[storeState.currentTrackIndex];
          const templateId = lyricsVideoState.selectedTemplateId || 'vinyl';
          const tmpl = LYRIC_VIDEO_TEMPLATES[templateId] || LYRIC_VIDEO_TEMPLATES['vinyl'];

          // Fetch real-time audio frequency data to power the visualizer combined with the lyrics video
          const freqData = audioManager.getFrequencyData();
          const timeData = audioManager.getTimeDomainData();

          renderLyricsVideoFrame(
            ctx,
            W,
            H,
            curTime,
            storeState.lyricsSettings?.lines || [],
            {
              title: currentTrack?.name || 'Untitled Track',
              artist: currentTrack?.artist || 'Joelizer Studio',
              albumArtUrl: currentTrack?.albumArt || storeState.albumArt
            },
            {
              template: tmpl,
              aspectRatio: storeState.aspectRatio,
              animationStyle: lyricsVideoState.animationStyle,
              visibleLineCount: lyricsVideoState.visibleLineCount,
              customBackground: lyricsVideoState.customBackground,
              typographyOverride: lyricsVideoState.typographyOverride,
              artworkOverride: lyricsVideoState.artworkOverride,
              animationOverride: lyricsVideoState.animationOverride,
              elementPositions: lyricsVideoState.elementPositions,
              preferElementPosition: true,
              watermarkText: 'Made with Joelizer',
              showSafeArea: lyricsVideoState.showSafeArea,
              showArtwork: lyricsVideoState.showArtwork !== false,
              // The positioned visualizer is composited explicitly below.
              showVisualizer: false,
              showLyrics: lyricsVideoState.showLyrics !== false,
              showMeta: lyricsVideoState.showMeta !== false,
              visualizerSettingsOverride: storeState.visualizerSettings,
              showBackgroundVisualizer: activeVideoMode === 'music-video' && !!isVisualizerScene
            },
            freqData,
            timeData
          );

          if (lyricsVideoState.showVisualizer !== false) {
            const visualizerPos = lyricsVideoState.elementPositions?.visualizer ??
              getDefaultPositions(storeState.aspectRatio, tmpl.id).visualizer;
            drawPositionedLyricsVisualizer(
              ctx, W, H, visualizerPos,
              { ...storeState.visualizerSettings, enabled: true },
              freqData, timeData
            );
          }

          animFrameId = requestAnimationFrame(render);
          return;
        }

        if (isVisualizerScene) {
          // Render Audio-Reactive Visualizer Scene
          const freqData = audioManager.getFrequencyData();
          const timeData = audioManager.getTimeDomainData();

          renderVisualizer(
            ctx,
            freqData,
            timeData,
            storeState.visualizerSettings,
            W,
            H
          );
        } else if (activeClip) {
          const asset = assets.find(a => a.id === activeClip.assetId);
          if (asset && asset.url) {
            const clipDuration = activeClip.endTime - activeClip.startTime || 1;
            const clipProgress = Math.max(0, Math.min(1, (curTime - activeClip.startTime) / clipDuration));

            if (asset.type === 'video') {
              let videoEl = videoElementsRef.current.get(asset.url);
              if (!videoEl) {
                videoEl = document.createElement('video');
                videoEl.src = asset.url;
                videoEl.muted = true;
                videoEl.playsInline = true;
                videoEl.crossOrigin = 'anonymous';

                // If direct URL fails, auto-retry via CORS media proxy
                videoEl.onerror = () => {
                  if (videoEl && !videoEl.src.includes('/api/proxy-media')) {
                    videoEl.src = `/api/proxy-media?url=${encodeURIComponent(asset.url)}`;
                  }
                };

                videoElementsRef.current.set(asset.url, videoEl);
              }

              const targetVideoTime = activeClip.trimStart + (curTime - activeClip.startTime);
              const clipChanged = lastActiveVideoClipRef.current !== activeClip.id;
              // A pending seek can overlap a cut. Keep clipChanged pending
              // until the decoder accepts its new trim offset.
              if (!videoEl.seeking) lastActiveVideoClipRef.current = activeClip.id;
              const sync = getVideoSyncDecision({
                targetTime: targetVideoTime,
                actualTime: videoEl.currentTime,
                clipChanged,
                playing,
                seeking: videoEl.seeking
              });
              // Avoid repeatedly seeking for ~200ms audio/video clock jitter.
              // Seek on timeline cuts and large desync only; small drift is
              // absorbed by slightly altering source playback speed.
              // When paused, seek only when the timeline is explicitly
              // scrubbed or a new clip is selected. Holding a still frame
              // must not issue repeated video seeks and produce jitter.
              const lastPausedPosition = pausedClipTimelineRef.current.get(activeClip.id);
              const pausedScrubbed = !playing &&
                (lastPausedPosition === undefined || Math.abs(lastPausedPosition - curTime) > 0.04);
              if (!playing) pausedClipTimelineRef.current.set(activeClip.id, curTime);
              if (sync.seekTo !== null && !videoEl.seeking &&
                  (playing || clipChanged || pausedScrubbed)) {
                try { videoEl.currentTime = sync.seekTo; } catch (_) {}
              }
              if (Math.abs(videoEl.playbackRate - sync.playbackRate) > 0.005) {
                videoEl.playbackRate = sync.playbackRate;
              }
              if (playing && videoEl.paused) {
                videoEl.play().catch(() => {});
              } else if (!playing && !videoEl.paused) {
                videoEl.pause();
              }

              let drewFrame = false;

              // Draw video if current frame is ready
              if (videoEl.readyState >= 2) {
                const vW = videoEl.videoWidth || 1920;
                const vH = videoEl.videoHeight || 1080;
                try {
                  drawFramedMedia(ctx, videoEl, W, H, vW, vH, activeClip);
                  drewFrame = true;
                  sampleBrowserExportVideo(activeClip.id, videoEl.currentTime);
                } catch (e) {
                  drewFrame = false;
                }
              }

              // Fallback: if video frame isn't ready or drawImage threw, draw thumbnail image instead of pitch black
              if (!drewFrame && asset.thumbnail) {
                let thumbImg = imageElementsRef.current.get(asset.thumbnail);
                if (!thumbImg) {
                  thumbImg = new Image();
                  thumbImg.crossOrigin = 'anonymous';
                  thumbImg.src = asset.thumbnail;
                  imageElementsRef.current.set(asset.thumbnail, thumbImg);
                }
                if (thumbImg.complete && thumbImg.naturalWidth > 0) {
                  drawFramedMedia(ctx, thumbImg, W, H, thumbImg.naturalWidth, thumbImg.naturalHeight, activeClip);
                } else {
                  ctx.fillStyle = '#0d0e15';
                  ctx.fillRect(0, 0, W, H);
                }
              }
            } else if (asset.type === 'image') {
              let imgEl = imageElementsRef.current.get(asset.url);
              if (!imgEl) {
                imgEl = new Image();
                imgEl.crossOrigin = 'anonymous';
                imgEl.src = asset.url || asset.thumbnail || '';
                imageElementsRef.current.set(asset.url, imgEl);
              }

              if (imgEl.complete && imgEl.naturalWidth > 0) {
                ctx.save();

                // Calculate Ken Burns Pan/Zoom transform
                let scale = 1.05;
                let translateX = 0;
                let translateY = 0;
                const effect = activeClip.effect || 'ken-burns-in';

                if (effect === 'ken-burns-in') {
                  scale = 1 + clipProgress * 0.18;
                } else if (effect === 'ken-burns-out') {
                  scale = 1.18 - clipProgress * 0.18;
                } else if (effect === 'pan-left') {
                  scale = 1.12;
                  translateX = -clipProgress * (W * 0.08);
                } else if (effect === 'pan-right') {
                  scale = 1.12;
                  translateX = clipProgress * (W * 0.08);
                } else if (effect === 'pan-up') {
                  scale = 1.12;
                  translateY = -clipProgress * (H * 0.08);
                } else if (effect === 'pan-down') {
                  scale = 1.12;
                  translateY = clipProgress * (H * 0.08);
                }

                ctx.translate(W / 2 + translateX, H / 2 + translateY);
                ctx.scale(scale, scale);

                const imgW = imgEl.naturalWidth;
                const imgH = imgEl.naturalHeight;
                const iScale = Math.max(W / imgW, H / imgH);
                const drawW = imgW * iScale;
                const drawH = imgH * iScale;

                try {
                  ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
                } catch (e) {}

                ctx.restore();
              }
            }
          }
        } else {
          // Fallback placeholder stage if gap in timeline
          const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W / 1.2);
          grad.addColorStop(0, '#131622');
          grad.addColorStop(1, '#050508');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.font = `bold ${Math.round(H * 0.035)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('NO ACTIVE TIMELINE CLIP', W / 2, H / 2);
        }

        // 3. Render unified lyrics overlay over MV timeline clips (eliminates old duplicate bottom caption box)
        if (storeState.lyricsSettings?.lines && storeState.lyricsSettings.lines.length > 0) {
          const templateId = lyricsVideoState.selectedTemplateId || 'vinyl';
          const tmpl = LYRIC_VIDEO_TEMPLATES[templateId] || LYRIC_VIDEO_TEMPLATES['vinyl'];
          const lyricPosSetting = storeState.lyricsSettings?.position || lyricsVideoState.typographyOverride?.position || 'bottom';
          const effectiveShowBox = storeState.lyricsSettings?.showBackgroundBox ?? lyricsVideoState.typographyOverride?.showContainerPill ?? true;

          // Composite lyrics only: never re-render the background or watermark
          // over an imported MV clip. The full lyrics scene renderer is used
          // separately above for dedicated vinyl-lyrics timeline scenes.
          renderLyricsOverlayFrame(ctx, W, H, curTime, storeState.lyricsSettings.lines, {
            template: tmpl,
            aspectRatio: storeState.aspectRatio,
            animationStyle: storeState.lyricsSettings?.animationStyle || lyricsVideoState.animationStyle,
            visibleLineCount: storeState.lyricsSettings?.visibleLineCount ?? 2,
            showLyrics: true,
            bilingualEnabled: storeState.lyricsSettings?.bilingualEnabled ?? lyricsVideoState.bilingualEnabled,
            fadeInDuration: storeState.lyricsSettings?.fadeInDuration ?? lyricsVideoState.fadeInDuration,
            fadeOutDuration: storeState.lyricsSettings?.fadeOutDuration ?? lyricsVideoState.fadeOutDuration,
            fadeEasing: storeState.lyricsSettings?.fadeEasing ?? lyricsVideoState.fadeEasing,
            typographyOverride: {
              ...lyricsVideoState.typographyOverride,
              showContainerPill: effectiveShowBox,
              position: lyricPosSetting
            },
            animationOverride: lyricsVideoState.animationOverride,
            elementPositions: lyricsVideoState.elementPositions,
            showSafeArea: false
          });
        }
      } catch (err) {
        console.error("Renderer Loop Exception:", err);
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animFrameId);
      for (const video of videoElementsRef.current.values()) {
        video.pause();
        video.playbackRate = 1;
      }
      lastActiveVideoClipRef.current = null;
    };
  }, [aspectRatio]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-1.5 sm:p-2 overflow-hidden gap-1.5 sm:gap-2 bg-[#0a0c0f]">
      {/* Main Stage Canvas Area - Perfectly Proportional & 1:1 Match for Preview & Export */}
      <div 
        ref={stageRef}
        className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden p-1 bg-[#0a0c0f]"
      >
        <div
          ref={canvasContainerRef}
          onPointerEnter={() => setStageHovered(true)}
          onPointerLeave={() => setStageHovered(false)}
          className="bg-black rounded-lg border border-[#232933] overflow-hidden relative shadow-[0_10px_36px_rgba(0,0,0,0.55)] flex items-center justify-center group/mvpreview"
          style={availableStage.width > 0 && availableStage.height > 0
            ? { width: displayWidth, height: displayHeight, flexShrink: 0 }
            : { aspectRatio: `${ratioWidth}/${ratioHeight}`, height: '100%', maxWidth: '100%' }}
        >
          {/* Main Canvas Element - Used by ExportModal via id="visualizer-canvas" */}
          <canvas
            id="visualizer-canvas"
            data-joelizer-stage="mv"
            ref={canvasRef}
            className="w-full h-full object-contain block"
          />

          {/* Interactive Drag & Drop Overlay inside exact canvas boundaries */}
          {showOverlay && !adjustVideo && (
            <InteractiveStageOverlay
              stageWidth={stageDimensions.width}
              stageHeight={stageDimensions.height}
              filterKeys={videoMode === 'music-video' ? mvFilterKeys : undefined}
              mode={videoMode}
            />
          )}

          {editableVideo && (
            <div className="absolute top-12 left-2 z-40 flex flex-col items-start gap-1 pointer-events-auto">
              <button type="button" onClick={() => setAdjustVideo(v => !v)}
                className={`rounded border px-2 py-1.5 text-[10px] font-semibold shadow-lg ${adjustVideo ? 'border-accent bg-accent text-black' : 'border-white/30 bg-black/70 text-white'}`}
                title="Select the video to drag, resize, or reframe">
                {adjustVideo ? 'Done adjusting' : 'Adjust video'}
              </button>
              {adjustVideo && (
                <div className="flex gap-1 rounded bg-black/75 p-1">
                  <button type="button" className="text-white text-[10px] px-1.5" onClick={() => updateFrameSettings({ fit: frameSettings?.fit === 'contain' ? 'cover' : 'contain' })}>
                    {frameSettings?.fit === 'contain' ? 'Fit whole' : 'Fill / Crop'}
                  </button>
                  <button type="button" className="text-white text-[10px] px-1.5" onClick={() => updateFrameSettings({ zoom: 1, heightScale: 1, offsetX: 0, offsetY: 0 })}>
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}
          {adjustVideo && editableVideo && (
            <div className="absolute inset-0 z-30 border-2 border-accent/70 cursor-move touch-none"
              aria-label="Drag to reposition video"
              onPointerDown={e => startAdjustment(e, 'move')}
              onPointerMove={moveAdjustment}
              onPointerUp={() => { adjustmentGesture.current = null; }}
              onPointerCancel={() => { adjustmentGesture.current = null; }}>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 text-white text-[10px] px-2 py-1 pointer-events-none">Drag to move video</div>
              <div
                onPointerDown={e => startAdjustment(e, 'resize')}
                onPointerMove={moveAdjustment}
                onPointerUp={e => { e.stopPropagation(); adjustmentGesture.current = null; }}
                onPointerCancel={() => { adjustmentGesture.current = null; }}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-tl border border-accent bg-black/80 text-accent flex items-center justify-center cursor-nwse-resize touch-none"
                title="Drag corner horizontally to zoom, vertically to adjust height">↘</div>
            </div>
          )}

          {/* Transport appears only on the video surface, never under a dialog. */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0e1115]/85 border border-white/20 flex items-center justify-center text-white backdrop-blur-md transition-opacity duration-150 shadow-xl focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent ${
                stageHovered && !dialogOpen
                  ? 'opacity-100 pointer-events-auto hover:scale-105 cursor-pointer'
                  : 'opacity-0 pointer-events-none'
              }`}
              disabled={dialogOpen}
              title={isPlaying ? 'Pause playback' : 'Play video'}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause size={21} /> : <Play size={21} className="ml-0.5 fill-white/20" />}
            </button>
          </div>

          {/* Timecode Overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 pointer-events-none">
            <div className="bg-[#0e1115]/90 backdrop-blur-md px-2 py-0.5 rounded text-[#f0f3f6] font-mono text-[9px] font-semibold shadow-md border border-[#232933]">
              <span className="text-accent mr-1 font-bold">TC</span>
              {formatTime(currentTime)} / {formatTime(audioDuration || 0)}
            </div>
          </div>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`absolute top-2 right-2 z-20 bg-[#0e1115]/85 hover:bg-[#161b22] text-[#c9d1d9] hover:text-white p-2 rounded-lg border border-[#303846] cursor-pointer transition-all focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent ${stageHovered && !dialogOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
