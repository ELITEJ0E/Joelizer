export interface BackgroundPreset {
  id: string;
  name: string;
  category: 'Gradient' | 'Animated' | 'Theme' | 'Abstract' | 'Cinematic';
  type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
  value: string;
  previewGradient: string;
  duration?: string;
  isDefault?: boolean;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'cover',
    name: 'Song Cover',
    category: 'Abstract',
    type: 'blurred-artwork',
    value: '',
    previewGradient: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 50%, #030712 100%)',
    isDefault: true
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #312e81 100%)',
    previewGradient: 'linear-gradient(135deg, #431407, #9a3412, #312e81)',
    duration: '00:05'
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    category: 'Animated',
    type: 'particles',
    value: '#083344',
    previewGradient: 'linear-gradient(135deg, #083344, #0e7490, #083344)',
    duration: '00:03'
  },
  {
    id: 'aurora',
    name: 'Cosmic Aurora',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)',
    previewGradient: 'linear-gradient(135deg, #2e1065, #701a75, #1e1b4b)',
    duration: '00:04'
  },
  {
    id: 'minimal',
    name: 'Deep Onyx',
    category: 'Cinematic',
    type: 'color',
    value: '#09090b',
    previewGradient: 'linear-gradient(180deg, #18181b, #09090b)',
    duration: '00:10'
  },
  {
    id: 'ocean',
    name: 'Ocean Depth',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    previewGradient: 'linear-gradient(135deg, #064e3b, #042f2e, #022c22)',
    duration: '00:06'
  },
  {
    id: 'crimson',
    name: 'Crimson Fall',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #4c0519 0%, #2a0410 100%)',
    previewGradient: 'linear-gradient(135deg, #4c0519, #881337, #18181b)',
    duration: '00:06'
  },
  {
    id: 'gold',
    name: 'Liquid Gold',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
    previewGradient: 'linear-gradient(135deg, #78350f, #b45309, #451a03)',
    duration: '00:08'
  },
  {
    id: 'waveform',
    name: 'Sound Wave',
    category: 'Animated',
    type: 'waveform',
    value: '#171717',
    previewGradient: 'linear-gradient(135deg, #171717, #262626, #0a0a0a)',
    duration: '00:03'
  },
  {
    id: 'synthwave',
    name: 'Synthwave 80s',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #831843 0%, #4c1d95 50%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #831843, #4c1d95, #0f172a)',
    duration: '00:04'
  },
  {
    id: 'tokyo',
    name: 'Tokyo Night',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #831843 60%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #1e1b4b, #831843, #0f172a)',
    duration: '00:05'
  },
  {
    id: 'emerald',
    name: 'Emerald Jade',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #022c22 0%, #065f46 50%, #042f2e 100%)',
    previewGradient: 'linear-gradient(135deg, #022c22, #065f46, #042f2e)',
    duration: '00:06'
  },
  {
    id: 'electric',
    name: 'Electric Violet',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #1e1b4b 100%)',
    previewGradient: 'linear-gradient(135deg, #3b0764, #6b21a8, #1e1b4b)',
    duration: '00:05'
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #431407 100%)',
    previewGradient: 'linear-gradient(135deg, #7c2d12, #ea580c, #431407)',
    duration: '00:06'
  },
  {
    id: 'diamond',
    name: 'Ice Diamond',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #082f49 0%, #0284c7 50%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #082f49, #0284c7, #0f172a)',
    duration: '00:05'
  },
  {
    id: 'matrix',
    name: 'Cyber Matrix',
    category: 'Animated',
    type: 'particles',
    value: '#022c22',
    previewGradient: 'linear-gradient(135deg, #022c22, #059669, #022c22)',
    duration: '00:04'
  },
  {
    id: 'velvet',
    name: 'Royal Velvet',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 50%, #09090b 100%)',
    previewGradient: 'linear-gradient(135deg, #3b0764, #1e1b4b, #09090b)',
    duration: '00:07'
  },
  {
    id: 'champagne',
    name: 'Rose Gold',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #4c0519 0%, #831843 50%, #1c1917 100%)',
    previewGradient: 'linear-gradient(135deg, #4c0519, #831843, #1c1917)',
    duration: '00:05'
  },
  {
    id: 'starfield',
    name: 'Cosmic Nebula',
    category: 'Animated',
    type: 'particles',
    value: '#030712',
    previewGradient: 'radial-gradient(circle, #1e1b4b, #030712)',
    duration: '00:04'
  },
  {
    id: 'cinematic',
    name: 'Cinematic Noir',
    category: 'Cinematic',
    type: 'gradient',
    value: 'linear-gradient(180deg, #090d16 0%, #030712 100%)',
    previewGradient: 'linear-gradient(180deg, #090d16, #030712)',
    duration: '00:10'
  },
  {
    id: 'vhs',
    name: 'VHS Retro',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(180deg, #18181b 0%, #27272a 50%, #09090b 100%)',
    previewGradient: 'linear-gradient(180deg, #18181b, #27272a, #09090b)',
    duration: '00:04'
  },
  {
    id: 'glass',
    name: 'Frosted Glass',
    category: 'Abstract',
    type: 'blurred-artwork',
    value: '#0f172a',
    previewGradient: 'linear-gradient(135deg, #1e293b, #0f172a)',
    duration: '00:06'
  },
  {
    id: 'y2k',
    name: 'Y2K Cyber',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #4c1d95 100%)',
    previewGradient: 'linear-gradient(135deg, #0f172a, #0369a1, #4c1d95)',
    duration: '00:04'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Blood',
    category: 'Animated',
    type: 'waveform',
    value: '#450a0a',
    previewGradient: 'linear-gradient(135deg, #450a0a, #7f1d1d, #18181b)',
    duration: '00:03'
  }
];

// Helper to draw background video or animated particle canvas
export function drawBackgroundCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  bgSettings: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    value: string;
    videoUrl?: string;
    imageElement?: HTMLImageElement | null;
    videoElement?: HTMLVideoElement | null;
  },
  albumArtImage?: HTMLImageElement | null,
  audioFrequencyData?: Uint8Array | null
) {
  ctx.save();

  if (bgSettings.type === 'color') {
    ctx.fillStyle = bgSettings.value || '#09090b';
    ctx.fillRect(0, 0, W, H);
  } else if (bgSettings.type === 'gradient') {
    const val = bgSettings.value || '';
    const colorMatches = val.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g);
    if (colorMatches && colorMatches.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      colorMatches.forEach((color, idx) => {
        const stop = idx / (colorMatches.length - 1);
        grad.addColorStop(stop, color);
      });
      ctx.fillStyle = grad;
    } else if (val.startsWith('#')) {
      ctx.fillStyle = val;
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, W, H);
  } else if (bgSettings.type === 'image') {
    const img = bgSettings.imageElement || albumArtImage;
    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
      // Dark overlay for legibility
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
    } else {
      // Fallback dark canvas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
    }
  } else if (bgSettings.type === 'video' && bgSettings.videoElement) {
    const video = bgSettings.videoElement;
    if (video.readyState >= 2) {
      const dur = video.duration || 10;
      const targetTime = currentTime % dur;
      if (Math.abs(video.currentTime - targetTime) > 0.3) {
        try { video.currentTime = targetTime; } catch (_) {}
      }
      
      const vW = video.videoWidth || 1280;
      const vH = video.videoHeight || 720;
      const scale = Math.max(W / vW, H / vH);
      const drawW = vW * scale;
      const drawH = vH * scale;
      ctx.drawImage(video, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, W, H);
    }
  } else if (bgSettings.type === 'blurred-artwork') {
    // Mureka-style Static Heavily Blurred Abstract Color Field (Aurora / Lava Lamp look)
    ctx.save();
    
    // Base dark canvas fill
    ctx.fillStyle = '#070810';
    ctx.fillRect(0, 0, W, H);

    const bgImg = albumArtImage || bgSettings.imageElement;

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      // 1. Draw zoomed, heavily blurred album art base
      const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight) * 1.5;
      const drawW = bgImg.naturalWidth * scale;
      const drawH = bgImg.naturalHeight * scale;
      
      ctx.filter = 'blur(75px) brightness(0.7) saturate(1.6)';
      ctx.drawImage(bgImg, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
      ctx.filter = 'none';
    } else {
      // Fallback static organic radial blobs
      ctx.filter = 'blur(80px)';
      
      // Blob 1: Deep Violet / Indigo Top-Left
      const grad1 = ctx.createRadialGradient(W * 0.25, H * 0.25, 10, W * 0.25, H * 0.25, Math.max(W, H) * 0.5);
      grad1.addColorStop(0, 'rgba(112, 26, 117, 0.7)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(W * 0.25, H * 0.25, Math.max(W, H) * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Blob 2: Warm Amber / Orange Center-Right
      const grad2 = ctx.createRadialGradient(W * 0.8, H * 0.45, 10, W * 0.8, H * 0.45, Math.max(W, H) * 0.45);
      grad2.addColorStop(0, 'rgba(194, 65, 12, 0.65)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.45, Math.max(W, H) * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Blob 3: Cyan / Emerald Bottom-Left
      const grad3 = ctx.createRadialGradient(W * 0.15, H * 0.85, 10, W * 0.15, H * 0.85, Math.max(W, H) * 0.45);
      grad3.addColorStop(0, 'rgba(13, 148, 136, 0.6)');
      grad3.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad3;
      ctx.beginPath();
      ctx.arc(W * 0.15, H * 0.85, Math.max(W, H) * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.filter = 'none';
    }

    // Static subtle vignette for depth and legibility
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0.25)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  } else if (bgSettings.type === 'particles') {
    // Cosmic Particle Canvas background
    ctx.fillStyle = bgSettings.value || '#030712';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const count = 40;
    for (let i = 0; i < count; i++) {
      const x = (Math.sin(i * 127.1 + currentTime * 0.3) * 0.5 + 0.5) * W;
      const y = (Math.cos(i * 311.7 + currentTime * 0.2) * 0.5 + 0.5) * H;
      const radius = Math.sin(i + currentTime) * 2 + 3;
      const alpha = Math.sin(i * 10 + currentTime * 2) * 0.3 + 0.5;

      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  } else if (bgSettings.type === 'waveform') {
    // Waveform Reactive background
    ctx.fillStyle = bgSettings.value || '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const waveCount = 60;
    const step = W / waveCount;
    for (let i = 0; i < waveCount; i++) {
      const amp = audioFrequencyData ? (audioFrequencyData[i % audioFrequencyData.length] / 255) : Math.sin(i * 0.2 + currentTime * 3) * 0.5 + 0.5;
      const y = H / 2 + Math.sin(i * 0.3 + currentTime * 2) * amp * (H * 0.15);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * step, y);
    }
    ctx.stroke();
    ctx.restore();
  } else {
    // Default gradient fallback
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}
