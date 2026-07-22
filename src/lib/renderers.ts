import { VisualizerSettings } from '../store/useStore';

// Helper to convert hex to rgba
function getRGBA(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(x => x + x).join('');
  }
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Musically-calibrated logarithmic frequency mapper
// Focuses on active musical elements (Bass, Guitar/Melody, Vocals) rather than empty highs
function getMusicalFrequency(i: number, total: number, frequencyData: Uint8Array): number {
  const norm = i / total;
  // A power curve of 1.6 groups more elements in the low and mid frequencies
  const power = Math.pow(norm, 1.6);
  // Cut off at 70% of frequency array because the top 30% is mostly cymbals or background air
  const targetIndex = power * (frequencyData.length * 0.7);
  
  const lower = Math.floor(targetIndex);
  const upper = Math.min(lower + 1, frequencyData.length - 1);
  const frac = targetIndex - lower;
  
  return frequencyData[lower] * (1 - frac) + frequencyData[upper] * frac;
}

export function renderVisualizer(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  timeData: Uint8Array,
  settings: VisualizerSettings,
  width: number,
  height: number
) {
  const { style, color, sensitivity, segments = 8 } = settings;
  const scaledSensitivity = sensitivity * 1.5;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  
  if (style === 'bars') {
    const isVertical = width < height;
    // Fewer, bolder bars in vertical mode to prevent squeezing
    const barCount = isVertical ? 32 : 64;
    
    const visualWidth = width * 0.94;
    const padding = (width - visualWidth) / 2;
    const barWidth = (visualWidth / barCount) * 0.75;
    const spacing = (visualWidth / barCount) * 0.25;
    
    for (let i = 0; i < barCount; i++) {
      const rawValue = getMusicalFrequency(i, barCount, frequencyData);
      const value = rawValue * scaledSensitivity;
      const percent = Math.min(value / 255, 1);
      
      // Taller, more dramatic bars in vertical (9:16) format since we have more vertical space
      const heightMultiplier = isVertical ? 0.65 : 0.48;
      const barHeight = height * heightMultiplier * percent;
      
      const x = padding + i * (barWidth + spacing);
      const y = height / 2 - barHeight / 2; // Center vertically
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(3, barHeight), barWidth / 2);
      ctx.fill();
    }
  } else if (style === 'waveform') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] / 128.0); // 0 to 2, 1 is center
      const y = (v * height / 2) * scaledSensitivity + height / 2 * (1 - scaledSensitivity);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.stroke();
  } else if (style === 'radial') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.22;
    const barCount = 64;
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    for (let i = 0; i < barCount; i++) {
      const rawValue = getMusicalFrequency(i, barCount, frequencyData);
      const value = rawValue * scaledSensitivity;
      const percent = Math.min(value / 255, 1);
      const barHeight = Math.min(width, height) * 0.25 * percent;
      
      const angle = (i / barCount) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barHeight);
      const y2 = cy + Math.sin(angle) * (radius + barHeight);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (style === 'particles') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.25;
    const barCount = 128;
    
    for (let i = 0; i < barCount; i++) {
      const rawValue = getMusicalFrequency(i, barCount, frequencyData);
      const value = rawValue * scaledSensitivity;
      const percent = Math.min(value / 255, 1);
      
      if (percent > 0.1) {
        const angle = (i / barCount) * Math.PI * 2 + (Date.now() / 1000) * 0.2; // Add some rotation
        const distance = radius + percent * (Math.min(width, height) * 0.3);
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.arc(x, y, percent * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'kaleidoscope') {
    const cx = width / 2;
    const cy = height / 2;
    const segCount = segments;
    const angleStep = (Math.PI * 2) / segCount;
    const barCount = 32;
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    for (let s = 0; s < segCount; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s * angleStep);
      
      // Draw first half of the mirrored slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i < barCount; i++) {
        const rawValue = getMusicalFrequency(i, barCount, frequencyData);
        const value = rawValue * scaledSensitivity;
        const percent = Math.min(value / 255, 1);
        const radius = Math.min(width, height) * 0.12 + percent * Math.min(width, height) * 0.22;
        const angle = (i / barCount) * (angleStep / 2);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw mirrored second half of the slice
      ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i < barCount; i++) {
        const rawValue = getMusicalFrequency(i, barCount, frequencyData);
        const value = rawValue * scaledSensitivity;
        const percent = Math.min(value / 255, 1);
        const radius = Math.min(width, height) * 0.12 + percent * Math.min(width, height) * 0.22;
        const angle = (i / barCount) * (angleStep / 2);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.restore();
    }
  } else if (style === 'orb') {
    const cx = width / 2;
    const cy = height / 2;
    
    // Split the frequency bands musically (Bass, Mids, Highs)
    let bass = 0;
    const bassEnd = Math.floor(frequencyData.length * 0.05); // ~250Hz (beat/bass line)
    for (let i = 0; i < bassEnd; i++) bass += frequencyData[i] || 0;
    bass /= Math.max(1, bassEnd);

    let mid = 0;
    const midEnd = Math.floor(frequencyData.length * 0.25); // ~2000Hz (vocals, melody, guitar)
    for (let i = bassEnd; i < midEnd; i++) mid += frequencyData[i] || 0;
    mid /= Math.max(1, midEnd - bassEnd);

    let high = 0;
    const highEnd = Math.floor(frequencyData.length * 0.6); // ~6000Hz (cymbal detail, upper melody)
    for (let i = midEnd; i < highEnd; i++) high += frequencyData[i] || 0;
    high /= Math.max(1, highEnd - midEnd);

    let vol = 0;
    for (let i = 0; i < frequencyData.length; i++) vol += frequencyData[i];
    vol /= frequencyData.length;

    const baseRadius = Math.min(width, height) * 0.15;
    const scaleFactor = 1 + (bass / 255) * scaledSensitivity * 0.6;
    const radius = baseRadius * scaleFactor;
    
    // 1. Draw glowing background aura
    const glowRadius = radius * (1.6 + (vol / 255) * 1.4);
    const auraGrad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, glowRadius);
    auraGrad.addColorStop(0, getRGBA(color, 0.8));
    auraGrad.addColorStop(0.3, getRGBA(color, 0.35));
    auraGrad.addColorStop(0.7, getRGBA(color, 0.12));
    auraGrad.addColorStop(1, getRGBA(color, 0));
    
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 2. Draw outer jitter ring (mids & highs shimmer)
    ctx.strokeStyle = getRGBA(color, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    const points = 72;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const bandIndex = Math.floor((i / points) * 70) + 10;
      const amplitude = (frequencyData[bandIndex] || 0) * scaledSensitivity * 0.22;
      
      const r = radius + amplitude * Math.sin(angle * 8 + Date.now() / 180);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // 3. Draw inner sci-fi core sphere
    const coreGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, radius * 0.05, cx, cy, radius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.2, getRGBA(color, 0.9));
    coreGrad.addColorStop(0.8, getRGBA(color, 0.4));
    coreGrad.addColorStop(1, getRGBA(color, 0.1));
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 4. Draw orbiting particle cluster (JARVIS/Cortana style)
    const particleCount = 24;
    for (let i = 0; i < particleCount; i++) {
      const speedOffset = i % 2 === 0 ? 1 : -1;
      const angle = (i / particleCount) * Math.PI * 2 + (Date.now() / 2000) * speedOffset;
      const orbitOffset = radius * (1.15 + Math.sin(Date.now() / 300 + i) * 0.08) + (high / 255) * 35;
      const px = cx + Math.cos(angle) * orbitOffset;
      const py = cy + Math.sin(angle) * orbitOffset;
      const pSize = 1.2 + (mid / 255) * 3.5;
      
      ctx.fillStyle = getRGBA(color, 0.85 * (1 - (i / particleCount) * 0.25));
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
