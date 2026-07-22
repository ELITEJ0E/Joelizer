import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { renderVisualizer } from '../../lib/renderers';
import { Upload } from 'lucide-react';
import { parseLRC } from '../../lib/utils';

const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1 / 1,
  '4:5': 4 / 5,
};

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reqRef = useRef<number>(0);
  
  const aspectRatio = useStore(s => s.aspectRatio);
  const layers = useStore(s => s.layers);
  const visualizerSettings = useStore(s => s.visualizerSettings);
  const backgroundSettings = useStore(s => s.backgroundSettings);
  const lyricsSettings = useStore(s => s.lyricsSettings);
  const logoSettings = useStore(s => s.logoSettings);
  const audioUrl = useStore(s => s.audioUrl);
  const albumArt = useStore(s => s.albumArt);
  const currentTime = useStore(s => s.currentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const projectName = useStore(s => s.name);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const nameLower = file.name.toLowerCase();
      
      // 1. Audio Files
      if (file.type.startsWith('audio/') || nameLower.endsWith('.mp3') || nameLower.endsWith('.wav') || nameLower.endsWith('.m4a') || nameLower.endsWith('.ogg') || nameLower.endsWith('.flac')) {
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          useStore.getState().setAudio(file, url, audio.duration, null);
        };
      }
      // 2. Video Files (Background)
      else if (file.type.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.webm') || nameLower.endsWith('.mov')) {
        const url = URL.createObjectURL(file);
        useStore.getState().updateBackgroundSettings({ type: 'video', value: url });
      }
      // 3. Image Files (Background or Logo)
      else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const activeId = useStore.getState().selectedLayerId;
        if (activeId === 'logo') {
          useStore.getState().updateLogoSettings({ image: url });
        } else {
          useStore.getState().updateBackgroundSettings({ type: 'image', value: url });
        }
      }
      // 4. Lyrics Files
      else if (nameLower.endsWith('.lrc') || file.type === 'text/plain' || nameLower.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) {
            if (nameLower.endsWith('.lrc') || text.includes('[')) {
              const parsed = parseLRC(text);
              useStore.getState().updateLyricsSettings({ lines: parsed });
            } else {
              const lines = text.split('\n').filter(l => l.trim().length > 0);
              const newLines = lines.map((t, i) => ({
                id: `l_${i}_${Math.random().toString(36).substring(2, 6)}`,
                text: t,
                startTime: 0,
                endTime: 0
              }));
              useStore.getState().updateLyricsSettings({ lines: newLines });
            }
          }
        };
        reader.readAsText(file);
      }
    }
  };

  // Pre-load background image
  useEffect(() => {
    let active = true;
    const url = backgroundSettings.type === 'image' ? backgroundSettings.value : (backgroundSettings.blurAlbumArt ? albumArt : null);
    if (url) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (active) setBgImage(img);
      };
    } else {
      setBgImage(null);
    }
    return () => {
      active = false;
    };
  }, [backgroundSettings.type, backgroundSettings.value, backgroundSettings.blurAlbumArt, albumArt]);

  // Pre-load logo image
  useEffect(() => {
    let active = true;
    if (logoSettings.image) {
      const img = new Image();
      img.src = logoSettings.image;
      img.onload = () => {
        if (active) setLogoImage(img);
      };
    } else {
      setLogoImage(null);
    }
    return () => {
      active = false;
    };
  }, [logoSettings.image]);

  // Sync background video element source & play state
  useEffect(() => {
    if (backgroundSettings.type === 'video' && backgroundSettings.value) {
      let isNew = false;
      if (!videoRef.current) {
        const video = document.createElement('video');
        if (!backgroundSettings.value.startsWith('blob:')) {
          video.crossOrigin = 'anonymous';
        }
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.src = backgroundSettings.value;
        videoRef.current = video;
        isNew = true;
      } else if (videoRef.current.src !== backgroundSettings.value) {
        if (!backgroundSettings.value.startsWith('blob:')) {
          videoRef.current.crossOrigin = 'anonymous';
        } else {
          videoRef.current.removeAttribute('crossorigin');
        }
        videoRef.current.src = backgroundSettings.value;
        videoRef.current.load();
        isNew = true;
      }
      
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.play().catch(e => console.error("Video background play failed", e));
        } else {
          videoRef.current.pause();
          if (isNew) {
            const dur = videoRef.current.duration;
            if (dur && isFinite(dur)) {
              videoRef.current.currentTime = currentTime % dur;
            }
          }
        }
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
    }
  }, [backgroundSettings.type, backgroundSettings.value, isPlaying]);

  // Sync video current time when not playing (scrubbing)
  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      const dur = videoRef.current.duration;
      if (dur && isFinite(dur)) {
        videoRef.current.currentTime = currentTime % dur;
      }
    }
  }, [currentTime, isPlaying]);

  // Calculate canvas size based on container and aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const ratio = ASPECT_RATIOS[aspectRatio];
      
      let w = clientWidth - 64; // generous padding
      let h = w / ratio;
      
      if (h > clientHeight - 64) {
        h = clientHeight - 64;
        w = h * ratio;
      }
      
      setDimensions({ width: w, height: h });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [aspectRatio]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update smoothing whenever settings change
    audioManager.setSmoothing(visualizerSettings.smoothing);

    const draw = () => {
      reqRef.current = requestAnimationFrame(draw);
      
      const w = canvas.width;
      const h = canvas.height;
      
      // Clear
      ctx.clearRect(0, 0, w, h);
      
      // 1. Draw Background
      const bgLayer = layers.find(l => l.id === 'bg');
      if (bgLayer?.visible) {
        if (backgroundSettings.type === 'video' && videoRef.current) {
          const video = videoRef.current;
          ctx.save();
          const fit = backgroundSettings.fit || 'cover';
          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 360;
          
          let scale = 1;
          if (fit === 'cover') {
            scale = Math.max(w / videoW, h / videoH);
          } else {
            scale = Math.min(w / videoW, h / videoH);
          }
          
          const x = (w / 2) - (videoW / 2) * scale;
          const y = (h / 2) - (videoH / 2) * scale;
          
          // Clear with black for contain empty margins
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);

          if (backgroundSettings.blurAlbumArt) {
            ctx.filter = 'blur(20px) brightness(0.5)';
          }
          
          // Render current video frame
          try {
            ctx.drawImage(video, x, y, videoW * scale, videoH * scale);
          } catch (e) {
            // Draw fallback dark state if frame not ready
            ctx.fillStyle = '#111111';
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();
        } else if (bgImage && bgImage.complete) {
          ctx.save();
          const scale = Math.max(w / bgImage.width, h / bgImage.height);
          const x = (w / 2) - (bgImage.width / 2) * scale;
          const y = (h / 2) - (bgImage.height / 2) * scale;
          
          if (backgroundSettings.blurAlbumArt) {
            ctx.filter = 'blur(20px) brightness(0.5)';
          }
          ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
          ctx.restore();
        } else if (backgroundSettings.type === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, w, h);
          const colors = backgroundSettings.value.split(',').map(s => s.trim());
          grad.addColorStop(0, colors[0] || '#111');
          grad.addColorStop(1, colors[1] || colors[0] || '#111');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = backgroundSettings.value || '#111111';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
      }
      
      // 2. Draw Visualizer
      const visLayer = layers.find(l => l.id === 'vis');
      if (visLayer?.visible && audioUrl) {
        const freqData = audioManager.getFrequencyData();
        const timeData = audioManager.getTimeDomainData();
        if (freqData.length > 0) {
          renderVisualizer(ctx, freqData, timeData, visualizerSettings, w, h);
        }
      }
      
      // 3. Draw Lyrics
      const lyrLayer = layers.find(l => l.id === 'lyr');
      if (lyrLayer?.visible && lyricsSettings.lines.length > 0) {
        const currentLine = lyricsSettings.lines.find(
          l => currentTime >= l.startTime && currentTime <= l.endTime
        );
        
        if (currentLine) {
          ctx.save();
          ctx.font = `bold ${Math.min(w, h) * 0.08}px ${lyricsSettings.font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          if (lyricsSettings.animationStyle === 'karaoke') {
            const progress = (currentTime - currentLine.startTime) / (currentLine.endTime - currentLine.startTime);
            
            // Draw unhighlighted text (semi-transparent)
            ctx.fillStyle = `${lyricsSettings.color}80`; 
            ctx.fillText(currentLine.text, w / 2, h / 2);
            
            // Draw highlighted text clipped
            ctx.save();
            const textWidth = ctx.measureText(currentLine.text).width;
            const startX = (w / 2) - (textWidth / 2);
            ctx.beginPath();
            ctx.rect(startX, 0, textWidth * progress, h);
            ctx.clip();
            ctx.fillStyle = lyricsSettings.color;
            ctx.fillText(currentLine.text, w / 2, h / 2);
            ctx.restore();
            
          } else {
            // Fade
            let alpha = 1;
            const fadeTime = 0.3;
            if (currentTime - currentLine.startTime < fadeTime) {
              alpha = (currentTime - currentLine.startTime) / fadeTime;
            } else if (currentLine.endTime - currentTime < fadeTime) {
              alpha = (currentLine.endTime - currentTime) / fadeTime;
            }
            
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.fillStyle = lyricsSettings.color;
            ctx.fillText(currentLine.text, w / 2, h / 2);
            ctx.globalAlpha = 1;
          }
          
          ctx.restore();
        }
      }
      
      // 4. Draw Logo
      const logoLayer = layers.find(l => l.id === 'logo');
      if (logoLayer?.visible && logoImage && logoImage.complete) {
        ctx.save();
        ctx.globalAlpha = logoSettings.opacity;
        
        const logoSize = Math.min(w, h) * logoSettings.size;
        const aspect = logoImage.width / logoImage.height;
        const lw = logoSize * aspect;
        const lh = logoSize;
        
        const margin = Math.min(w, h) * 0.05;
        let lx = margin;
        let ly = margin;
        
        if (logoSettings.position.includes('right')) lx = w - lw - margin;
        if (logoSettings.position.includes('bottom')) ly = h - lh - margin;
        
        ctx.drawImage(logoImage, lx, ly, lw, lh);
        ctx.restore();
      }
    };
    
    reqRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(reqRef.current);
  }, [
    dimensions, layers, visualizerSettings, backgroundSettings, 
    lyricsSettings, logoSettings, audioUrl, albumArt, currentTime
  ]);

  const activeColor = visualizerSettings.color || '#00e676';
  const shadowStyle = isPlaying 
    ? { 
        boxShadow: `0 0 80px ${activeColor}1e`, 
        borderColor: `${activeColor}33`,
        transition: 'all 0.5s ease'
      }
    : { 
        boxShadow: `0 0 40px rgba(0,0,0,0.6)`, 
        borderColor: 'rgba(255,255,255,0.06)',
        transition: 'all 0.5s ease'
      };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 w-full h-full flex items-center justify-center p-8 bg-[#030303] overflow-hidden relative select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Background ambient mesh */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.03] pointer-events-none" 
        style={{
          background: `radial-gradient(circle, ${activeColor} 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div 
        className="relative bg-[#000000] rounded-lg overflow-hidden border"
        style={{ 
          width: dimensions.width, 
          height: dimensions.height,
          ...shadowStyle
        }}
      >
        <canvas 
          ref={canvasRef}
          width={dimensions.width * 2} // Retina scaling
          height={dimensions.height * 2}
          style={{ width: '100%', height: '100%' }}
        />
        <div className="absolute bottom-8 left-8 text-white font-black italic tracking-tighter pointer-events-none select-none">
          {projectName && (
            <p className="text-xl sm:text-2xl leading-none uppercase tracking-tight text-white drop-shadow-md">{projectName}</p>
          )}
        </div>
      </div>

      {isDragging && (
        <div 
          className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 border-2 border-dashed transition-all duration-300"
          style={{ borderColor: activeColor }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/10 mb-5 animate-bounce"
            style={{ color: activeColor }}
          >
            <Upload size={24} />
          </div>
          
          <h3 className="text-sm font-black uppercase tracking-[2px] text-white mb-1.5">Drop Media to Load</h3>
          <p className="text-slate-400 text-[10px] tracking-wider mb-6 uppercase text-center max-w-xs leading-relaxed">
            Quickly load audio, video assets, lyrics, or watermarks
          </p>
          
          <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col items-center text-center">
              <span className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={{ color: activeColor }}>🎵 Audio</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">MP3, WAV, M4A, FLAC</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col items-center text-center">
              <span className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={{ color: activeColor }}>🎥 Video</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">MP4, WEBM (BG)</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col items-center text-center">
              <span className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={{ color: activeColor }}>🖼️ Image</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">PNG, JPG (BG/LOGO)</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col items-center text-center">
              <span className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={{ color: activeColor }}>📝 Lyrics</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase">LRC FILE, TXT SCRIPT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
