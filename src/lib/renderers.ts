import { VisualizerSettings } from '../store/useStore';

export function renderVisualizer(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  timeData: Uint8Array,
  settings: VisualizerSettings,
  width: number,
  height: number
) {
  const { style, color, sensitivity } = settings;
  const scaledSensitivity = sensitivity * 1.5;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  
  if (style === 'bars') {
    const barCount = 64;
    const barWidth = (width / barCount) * 0.8;
    const spacing = (width / barCount) * 0.2;
    const step = Math.floor(frequencyData.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      const value = frequencyData[i * step] * scaledSensitivity;
      const percent = Math.min(value / 255, 1);
      const barHeight = height * 0.5 * percent;
      
      const x = i * (barWidth + spacing);
      const y = height / 2 - barHeight / 2; // Center vertically
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), barWidth / 2);
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
    const radius = Math.min(width, height) * 0.2;
    const barCount = 64;
    const step = Math.floor(frequencyData.length / barCount);
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    for (let i = 0; i < barCount; i++) {
      const value = frequencyData[i * step] * scaledSensitivity;
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
    // Simple particle approximation using frequency data
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.25;
    const barCount = 128;
    const step = Math.floor(frequencyData.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      const value = frequencyData[i * step] * scaledSensitivity;
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
  }

  ctx.restore();
}
