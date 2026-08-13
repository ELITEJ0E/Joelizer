export interface BackgroundPreset {
  id: string;
  name: string;
  category: 'Gradient' | 'Animated' | 'Theme' | 'Abstract';
  type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
  value: string;
  previewGradient: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'dreamy',
    name: 'Dreamy',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)',
    previewGradient: 'linear-gradient(135deg, #2e1065, #701a75, #1e1b4b)'
  },
  {
    id: 'neon',
    name: 'Neon Grid',
    category: 'Theme',
    type: 'particles',
    value: '#083344',
    previewGradient: 'linear-gradient(135deg, #083344, #155e75, #083344)'
  },
  {
    id: 'y2k',
    name: 'Y2K Cyber',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #4c1d95 100%)',
    previewGradient: 'linear-gradient(135deg, #0f172a, #0369a1, #4c1d95)'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'Theme',
    type: 'waveform',
    value: '#450a0a',
    previewGradient: 'linear-gradient(135deg, #450a0a, #7f1d1d, #18181b)'
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #312e81 100%)',
    previewGradient: 'linear-gradient(135deg, #431407, #9a3412, #312e81)'
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    category: 'Animated',
    type: 'particles',
    value: '#022c22',
    previewGradient: 'linear-gradient(135deg, #022c22, #065f46, #022c22)'
  },
  {
    id: 'vhs',
    name: 'VHS Retro',
    category: 'Theme',
    type: 'gradient',
    value: 'linear-gradient(180deg, #18181b 0%, #27272a 50%, #09090b 100%)',
    previewGradient: 'linear-gradient(180deg, #18181b, #27272a, #09090b)'
  },
  {
    id: 'glass',
    name: 'Frosted Glass',
    category: 'Abstract',
    type: 'blurred-artwork',
    value: '#0f172a',
    previewGradient: 'linear-gradient(135deg, #1e293b, #0f172a)'
  },
  {
    id: 'cosmic',
    name: 'Cosmic Nebula',
    category: 'Animated',
    type: 'particles',
    value: '#030712',
    previewGradient: 'radial-gradient(circle, #1e1b4b, #030712)'
  },
  {
    id: 'minimal',
    name: 'Minimal Dark',
    category: 'Gradient',
    type: 'color',
    value: '#09090b',
    previewGradient: '#09090b'
  },
  {
    id: 'cinematic',
    name: 'Cinematic Noir',
    category: 'Gradient',
    type: 'gradient',
    value: 'linear-gradient(180deg, #090d16 0%, #030712 100%)',
    previewGradient: 'linear-gradient(180deg, #090d16, #030712)'
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
    if (bgSettings.value && bgSettings.value.includes('gradient')) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgSettings.value || '#0f172a';
    }
    ctx.fillRect(0, 0, W, H);
  } else if (bgSettings.type === 'image' && bgSettings.imageElement && bgSettings.imageElement.complete && bgSettings.imageElement.naturalWidth > 0) {
    const img = bgSettings.imageElement;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
    // Dark overlay for legibility
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
  } else if (bgSettings.type === 'video' && bgSettings.videoElement) {
    const video = bgSettings.videoElement;
    if (video.readyState >= 2) {
      // Loop video seamlessly: videocurrentTime = currentTime % videoDuration
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

      // Dark tint for lyrics readability
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, W, H);
    }
  } else if (bgSettings.type === 'blurred-artwork' && albumArtImage && albumArtImage.complete && albumArtImage.naturalWidth > 0) {
    ctx.save();
    // Scale up blurred artwork
    const scale = Math.max(W / albumArtImage.naturalWidth, H / albumArtImage.naturalHeight) * 1.2;
    const drawW = albumArtImage.naturalWidth * scale;
    const drawH = albumArtImage.naturalHeight * scale;
    ctx.filter = 'blur(45px) brightness(0.65) saturate(1.4)';
    ctx.drawImage(albumArtImage, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
    ctx.filter = 'none';
    ctx.restore();

    // Subtle dark gradient vignette
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0.3)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
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
