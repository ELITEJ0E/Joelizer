import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { Play, Monitor, Smartphone, Square, Film } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVPreview() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const currentTime = useStore(s => s.currentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const audioDuration = useStore(s => s.audioDuration);

  const videoAssets = useMVStore(s => s.videoAssets);

  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Asset element caches to avoid re-creating elements and avoid black frames on transitions
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Keep asset caches updated with crossOrigin = 'anonymous' for clean canvas rendering
  useEffect(() => {
    videoAssets.forEach((asset) => {
      if (!asset.url) return;
      
      if (asset.mediaType === 'video' && !videoElementsRef.current.has(asset.url)) {
        const v = document.createElement('video');
        v.src = asset.url;
        v.muted = true;
        v.playsInline = true;
        v.crossOrigin = 'anonymous';
        v.preload = 'auto';
        videoElementsRef.current.set(asset.url, v);
      } else if (asset.mediaType === 'image' && !imageElementsRef.current.has(asset.url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.url || asset.thumbnail || '';
        imageElementsRef.current.set(asset.url, img);
      }
    });
  }, [videoAssets]);

  const aspectRatioVal = aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9';

  // Continuous Canvas Renderer Loop (Serves both live preview and high-quality ExportModal recording)
  useEffect(() => {
    let animFrameId: number;

    const render = () => {
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

      const curTime = storeState.currentTime;
      const playing = storeState.isPlaying;
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

      // Clear Canvas Background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, W, H);

      // 2. Find Active Timeline Clip at current time
      const clips = mvState.timelineClips;
      const assets = mvState.videoAssets;
      const activeClip = clips.find(c => curTime >= c.startTime && curTime <= c.endTime);

      if (activeClip) {
        const asset = assets.find(a => a.id === activeClip.assetId);
        if (asset && asset.url) {
          const clipDuration = activeClip.endTime - activeClip.startTime || 1;
          const clipProgress = Math.max(0, Math.min(1, (curTime - activeClip.startTime) / clipDuration));

          if (asset.mediaType === 'video') {
            let videoEl = videoElementsRef.current.get(asset.url);
            if (!videoEl) {
              videoEl = document.createElement('video');
              videoEl.src = asset.url;
              videoEl.muted = true;
              videoEl.playsInline = true;
              videoEl.crossOrigin = 'anonymous';
              videoElementsRef.current.set(asset.url, videoEl);
            }

            const targetVideoTime = activeClip.trimStart + (curTime - activeClip.startTime);
            
            // Sync video playback
            if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.2) {
              try { videoEl.currentTime = targetVideoTime; } catch (_) {}
            }

            if (playing && videoEl.paused) {
              videoEl.play().catch(() => {});
            } else if (!playing && !videoEl.paused) {
              videoEl.pause();
            }

            // Draw video if current frame is ready
            if (videoEl.readyState >= 2) {
              const vW = videoEl.videoWidth || 1920;
              const vH = videoEl.videoHeight || 1080;
              const scale = Math.max(W / vW, H / vH);
              const drawW = vW * scale;
              const drawH = vH * scale;
              const cx = (W - drawW) / 2;
              const cy = (H - drawH) / 2;

              try {
                ctx.drawImage(videoEl, cx, cy, drawW, drawH);
              } catch (e) {
                // Ignore transient draw errors during video buffer switches
              }
            } else {
              // Subtle background pulse while video buffers
              ctx.fillStyle = '#0d0e15';
              ctx.fillRect(0, 0, W, H);
            }
          } else if (asset.mediaType === 'image') {
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
        // Fallback placeholder stage if no timeline clip at currentTime
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

      // 3. Render Synchronized Word-by-Word Lyric Captions
      const timings = mvState.wordTimings;
      const lines = storeState.lyricsSettings?.lines || [];

      // Find active line from wordTimings first, or fallback to lyricsSettings
      let activeLine = timings.find(t => curTime >= t.startTime && curTime <= t.endTime);
      if (!activeLine && lines.length > 0) {
        const found = lines.find(l => curTime >= l.startTime && curTime <= l.endTime);
        if (found) {
          activeLine = {
            id: found.id,
            text: found.text,
            startTime: found.startTime,
            endTime: found.endTime
          };
        }
      }

      if (activeLine && activeLine.text) {
        const fontSize = Math.round(H * 0.045);
        ctx.font = `bold ${fontSize}px sans-serif`;

        const hasWords = activeLine.words && activeLine.words.length > 0;
        const lineY = H - Math.round(H * 0.12);

        if (hasWords) {
          // Compute total text width for exact centering
          let totalW = 0;
          const wordWidths = activeLine.words!.map(w => {
            const wWidth = ctx.measureText(w.word + ' ').width;
            totalW += wWidth;
            return wWidth;
          });

          const padX = 20;
          const boxW = Math.min(W * 0.92, totalW + padX * 2);
          const boxH = fontSize * 1.8;
          const boxX = (W - boxW) / 2;
          const boxY = lineY - boxH / 1.5;

          // Draw backdrop pill container
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 12);
            ctx.fill();
          } else {
            ctx.fillRect(boxX, boxY, boxW, boxH);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          // Render individual words with highlight
          let currentX = (W - totalW) / 2;

          activeLine.words!.forEach((w, idx) => {
            const isWordActive = curTime >= w.start && curTime <= w.end;
            ctx.save();

            if (isWordActive) {
              ctx.fillStyle = '#fde047'; // Bright Yellow Gold
              ctx.font = `extrabold ${Math.round(fontSize * 1.1)}px sans-serif`;
              ctx.shadowColor = 'rgba(253, 224, 71, 0.9)';
              ctx.shadowBlur = 12;
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${fontSize}px sans-serif`;
            }

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(w.word + ' ', currentX, lineY);
            ctx.restore();

            currentX += wordWidths[idx];
          });
        } else {
          // Render plain centered text
          const textMetrics = ctx.measureText(activeLine.text);
          const padX = 24;
          const boxW = Math.min(W * 0.92, textMetrics.width + padX * 2);
          const boxH = fontSize * 1.8;
          const boxX = (W - boxW) / 2;
          const boxY = lineY - boxH / 1.5;

          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 12);
            ctx.fill();
          } else {
            ctx.fillRect(boxX, boxY, boxW, boxH);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.fillText(activeLine.text, W / 2, lineY);
          ctx.restore();
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [aspectRatio]);

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-1.5 sm:p-2 overflow-hidden gap-1.5 sm:gap-2">
      {/* Top Header Controls: Aspect Ratio */}
      <div className="flex items-center justify-center w-full shrink-0 px-2.5 py-1 bg-black/60 border border-white/10 rounded-full text-[10px] text-slate-400 backdrop-blur-md max-w-[280px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAspectRatio('16:9')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '16:9' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Monitor size={11} />
            <span>16:9</span>
          </button>
          <button
            onClick={() => setAspectRatio('9:16')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '9:16' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Smartphone size={11} />
            <span>9:16</span>
          </button>
          <button
            onClick={() => setAspectRatio('1:1')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '1:1' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Square size={11} />
            <span>1:1</span>
          </button>
        </div>
      </div>

      {/* Main Stage Canvas Area - Perfectly Proportional & 1:1 Match for Preview & Export */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden p-1">
        <div 
          className="bg-black rounded-xl overflow-hidden relative shadow-2xl ring-1 ring-white/20 flex items-center justify-center transition-all duration-300"
          style={{
            aspectRatio: aspectRatioVal,
            maxHeight: '100%',
            maxWidth: '100%',
            height: '100%',
            width: 'auto',
          }}
        >
          {/* Main Canvas Element - Used by ExportModal via id="visualizer-canvas" */}
          <canvas
            id="visualizer-canvas"
            ref={canvasRef}
            className="w-full h-full object-contain block"
          />

          {/* Play/Pause Overlay Toggle on Click */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute inset-0 bg-transparent flex items-center justify-center group cursor-pointer"
          >
            {!isPlaying && (
              <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Play size={20} className="ml-1" />
              </div>
            )}
          </button>

          {/* Timecode & Studio Badge Overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-white font-mono text-[9px] font-bold shadow-md border border-white/10">
              {formatTime(currentTime)} / {formatTime(audioDuration || 0)}
            </div>
            <div className="bg-purple-900/80 backdrop-blur-md px-2 py-0.5 rounded text-purple-200 font-mono text-[8px] font-extrabold shadow-md border border-purple-500/40 uppercase tracking-wider flex items-center gap-1">
              <Film size={10} />
              <span>MV Studio Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
