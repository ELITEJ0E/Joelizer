import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { renderVisualizer } from '../../lib/renderers';

const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1 / 1,
  '4:5': 4 / 5,
};

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Calculate canvas size based on container and aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const ratio = ASPECT_RATIOS[aspectRatio];
      
      let w = clientWidth - 32; // padding
      let h = w / ratio;
      
      if (h > clientHeight - 32) {
        h = clientHeight - 32;
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

    // Pre-load background image if any
    let bgImage: HTMLImageElement | null = null;
    if (backgroundSettings.type === 'image' && backgroundSettings.value) {
      bgImage = new Image();
      bgImage.src = backgroundSettings.value;
    } else if (backgroundSettings.blurAlbumArt && albumArt) {
      bgImage = new Image();
      bgImage.src = albumArt;
    }

    // Pre-load logo image if any
    let logoImage: HTMLImageElement | null = null;
    if (logoSettings.image) {
      logoImage = new Image();
      logoImage.src = logoSettings.image;
    }

    const draw = () => {
      reqRef.current = requestAnimationFrame(draw);
      
      const w = canvas.width;
      const h = canvas.height;
      
      // Clear
      ctx.clearRect(0, 0, w, h);
      
      // 1. Draw Background
      const bgLayer = layers.find(l => l.id === 'bg');
      if (bgLayer?.visible) {
        if (bgImage && bgImage.complete) {
          ctx.save();
          if (backgroundSettings.blurAlbumArt) {
            ctx.filter = 'blur(20px) brightness(0.5)';
            // cover draw
            const scale = Math.max(w / bgImage.width, h / bgImage.height);
            const x = (w / 2) - (bgImage.width / 2) * scale;
            const y = (h / 2) - (bgImage.height / 2) * scale;
            ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
          } else {
             // cover draw
            const scale = Math.max(w / bgImage.width, h / bgImage.height);
            const x = (w / 2) - (bgImage.width / 2) * scale;
            const y = (h / 2) - (bgImage.height / 2) * scale;
            ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
          }
          ctx.restore();
        } else if (backgroundSettings.type === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, w, h);
          // simple parsed gradient (assuming value is like "#ff0000,#0000ff")
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

  return (
    <div ref={containerRef} className="flex-1 w-full h-full flex items-center justify-center p-8 bg-[#050505] overflow-hidden relative">
      <div 
        className="relative bg-black rounded overflow-hidden shadow-[0_0_80px_rgba(0,230,118,0.05)] border border-white/5"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <canvas 
          ref={canvasRef}
          width={dimensions.width * 2} // Retina display scaling
          height={dimensions.height * 2}
          style={{ width: '100%', height: '100%' }}
        />
        <div className="absolute bottom-10 left-10 text-white font-black italic tracking-tighter pointer-events-none">
          <p className="text-2xl leading-tight uppercase">{useStore(s => s.name)}</p>
          <p className="text-[#00e676] text-[10px] font-mono tracking-widest mt-1">JOELIZER / MK-II</p>
        </div>
      </div>
    </div>
  );
}
