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
    previewGradient: 'linear-gradient(135deg, #4c1d95 0%, #06b6d4 100%)',
    isDefault: true
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #312e81 100%)',
    previewGradient: 'linear-gradient(135deg, #f97316 0%, #b91c1c 50%, #4c1d95 100%)',
    duration: '00:05'
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    category: 'Animated',
    type: 'particles',
    value: '#083344',
    previewGradient: 'linear-gradient(135deg, #06b6d4 0%, #083344 50%, #ec4899 100%)',
    duration: '00:03'
  },
  {
    id: 'aurora',
    name: 'Cosmic Aurora',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)',
    previewGradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #3b82f6 100%)',
    duration: '00:04'
  },
  {
    id: 'minimal',
    name: 'Deep Onyx',
    category: 'Cinematic',
    type: 'color',
    value: '#050508',
    previewGradient: 'linear-gradient(180deg, #27272a 0%, #09090b 100%)',
    duration: '00:10'
  },
  {
    id: 'ocean',
    name: 'Ocean Depth',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
    previewGradient: 'linear-gradient(135deg, #0d9488 0%, #115e59 50%, #022c22 100%)',
    duration: '00:06'
  },
  {
    id: 'crimson',
    name: 'Crimson Fall',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #110105 100%)',
    previewGradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 50%, #450a0a 100%)',
    duration: '00:06'
  },
  {
    id: 'gold',
    name: 'Liquid Gold',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #170701 100%)',
    previewGradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #78350f 100%)',
    duration: '00:08'
  },
  {
    id: 'waveform',
    name: 'Sound Wave',
    category: 'Animated',
    type: 'waveform',
    value: '#111317',
    previewGradient: 'linear-gradient(135deg, #3b82f6 0%, #1e293b 50%, #111827 100%)',
    duration: '00:03'
  },
  {
    id: 'synthwave',
    name: 'Synthwave 80s',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #831843 0%, #4c1d95 50%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #ff007f 0%, #701a75 50%, #0f172a 100%)',
    duration: '00:04'
  },
  {
    id: 'tokyo',
    name: 'Tokyo Night',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #831843 60%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #2e1065 0%, #be185d 60%, #030712 100%)',
    duration: '00:05'
  },
  {
    id: 'emerald',
    name: 'Emerald Jade',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #022c22 0%, #065f46 50%, #042f2e 100%)',
    previewGradient: 'linear-gradient(135deg, #10b981 0%, #047857 50%, #064e3b 100%)',
    duration: '00:06'
  },
  {
    id: 'electric',
    name: 'Electric Violet',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #1e1b4b 100%)',
    previewGradient: 'linear-gradient(135deg, #c084fc 0%, #7e22ce 50%, #3b0764 100%)',
    duration: '00:05'
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #431407 100%)',
    previewGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #7c2d12 100%)',
    duration: '00:06'
  },
  {
    id: 'diamond',
    name: 'Ice Diamond',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #082f49 0%, #0284c7 50%, #0f172a 100%)',
    previewGradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)',
    duration: '00:05'
  },
  {
    id: 'matrix',
    name: 'Cyber Matrix',
    category: 'Animated',
    type: 'particles',
    value: '#011c10',
    previewGradient: 'linear-gradient(135deg, #22c55e 0%, #052e16 60%, #022c22 100%)',
    duration: '00:04'
  },
  {
    id: 'velvet',
    name: 'Royal Velvet',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #2e0854 0%, #11053b 50%, #03020c 100%)',
    previewGradient: 'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 60%, #1e1b4b 100%)',
    duration: '00:07'
  },
  {
    id: 'champagne',
    name: 'Rose Gold',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #5c182c 0%, #881337 50%, #1f050e 100%)',
    previewGradient: 'linear-gradient(135deg, #f43f5e 0%, #9f1239 50%, #4c0519 100%)',
    duration: '00:05'
  },
  {
    id: 'starfield',
    name: 'Cosmic Nebula',
    category: 'Animated',
    type: 'particles',
    value: '#050510',
    previewGradient: 'linear-gradient(135deg, #c084fc 0%, #1e1b4b 60%, #030712 100%)',
    duration: '00:04'
  },
  {
    id: 'cinematic',
    name: 'Cinematic Noir',
    category: 'Cinematic',
    type: 'gradient',
    value: 'linear-gradient(180deg, #07090e 0%, #010204 100%)',
    previewGradient: 'linear-gradient(180deg, #334155 0%, #0f172a 60%, #020617 100%)',
    duration: '00:10'
  },
  {
    id: 'vhs',
    name: 'VHS Retro',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(180deg, #151518 0%, #202024 50%, #07070a 100%)',
    previewGradient: 'linear-gradient(180deg, #4b5563 0%, #1f2937 50%, #111827 100%)',
    duration: '00:04'
  },
  {
    id: 'glass',
    name: 'Frosted Glass',
    category: 'Abstract',
    type: 'blurred-artwork',
    value: 'glass',
    previewGradient: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 100%), linear-gradient(135deg, #6366f1 0%, #312e81 100%)',
    duration: '00:06'
  },
  {
    id: 'y2k',
    name: 'Y2K Cyber',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #4c1d95 100%)',
    previewGradient: 'linear-gradient(135deg, #06b6d4 0%, #4f46e5 50%, #312e81 100%)',
    duration: '00:04'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Blood',
    category: 'Animated',
    type: 'waveform',
    value: '#450a0a',
    previewGradient: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 60%, #450a0a 100%)',
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

    // Special Glassmorphism overlay for Frosted Glass
    if (bgSettings.value === 'glass') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(0, 0, W, H);
      
      // Frosted milky white horizontal guidelines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(0, (i / 40) * H, W, 1);
      }
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
    
    // Gradient backgrounds for particles to make them deeply rich
    if (bgSettings.value === '#083344') {
      // Cyber Neon: cyan to deep indigo gradient base
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#02151c');
      grad.addColorStop(0.5, '#042838');
      grad.addColorStop(1, '#0c071a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (bgSettings.value === '#011c10') {
      // Cyber Matrix: dark green gradient base
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#000402');
      grad.addColorStop(0.5, '#01160a');
      grad.addColorStop(1, '#000402');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (bgSettings.value === '#050510') {
      // Cosmic Nebula: dark indigo/purple base
      const grad = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, Math.max(W,H)*0.6);
      grad.addColorStop(0, '#0e0b25');
      grad.addColorStop(1, '#020205');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    const count = 45;
    for (let i = 0; i < count; i++) {
      const x = (Math.sin(i * 127.1 + currentTime * 0.3) * 0.5 + 0.5) * W;
      const y = (Math.cos(i * 311.7 + currentTime * 0.2) * 0.5 + 0.5) * H;
      const radius = Math.sin(i + currentTime) * 2 + 3;
      const alpha = Math.sin(i * 10 + currentTime * 2) * 0.3 + 0.5;

      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);

      // Unique colored particles matching category
      if (bgSettings.value === '#083344') {
        // Alternate neon pink and bright cyan
        ctx.fillStyle = i % 2 === 0 ? `rgba(0, 229, 255, ${alpha})` : `rgba(236, 72, 153, ${alpha})`;
        ctx.shadowColor = i % 2 === 0 ? '#00e5ff' : '#ec4899';
      } else if (bgSettings.value === '#011c10') {
        // Bright Matrix code green
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.shadowColor = '#22c55e';
      } else {
        // White-blue nebula star dust
        ctx.fillStyle = i % 2 === 0 ? `rgba(192, 132, 252, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        ctx.shadowColor = i % 2 === 0 ? '#c084fc' : '#ffffff';
      }

      ctx.shadowBlur = 12;
      ctx.fill();
    }
    ctx.restore();
  } else if (bgSettings.type === 'waveform') {
    // Waveform Reactive background
    ctx.fillStyle = bgSettings.value || '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    
    const isBlood = bgSettings.value === '#450a0a';
    
    if (isBlood) {
      // Cyberpunk Blood: dark crimson radial base
      const grad = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, Math.max(W, H) * 0.6);
      grad.addColorStop(0, '#2b0202');
      grad.addColorStop(1, '#070000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.strokeStyle = isBlood ? 'rgba(239, 68, 68, 0.75)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = isBlood ? 4 : 2;
    if (isBlood) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ef4444';
    }

    // Main Waveform
    ctx.beginPath();
    const waveCount = 60;
    const step = W / waveCount;
    for (let i = 0; i < waveCount; i++) {
      const amp = audioFrequencyData ? (audioFrequencyData[i % audioFrequencyData.length] / 255) : Math.sin(i * 0.2 + currentTime * 3) * 0.5 + 0.5;
      const y = H / 2 + Math.sin(i * 0.3 + currentTime * 2) * amp * (H * 0.2);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * step, y);
    }
    ctx.stroke();

    // Secondary Gold Echo Wave for Cyberpunk Blood
    if (isBlood) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < waveCount; i++) {
        const amp = audioFrequencyData ? (audioFrequencyData[(i + 15) % audioFrequencyData.length] / 255) : Math.cos(i * 0.2 + currentTime * 2) * 0.5 + 0.5;
        const y = H / 2 + Math.cos(i * 0.25 + currentTime * 1.5) * amp * (H * 0.15);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
    }
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
