export function generateWaveformPeaks(audioBuffer: AudioBuffer, targetPoints: number): number[] {
  const channelData = audioBuffer.getChannelData(0); // Use the first channel
  const totalLength = channelData.length;
  const bucketSize = Math.max(1, Math.floor(totalLength / targetPoints));
  const peaks: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, totalLength);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j] || 0);
      if (val > max) {
        max = val;
      }
    }
    peaks.push(max);
  }

  // Normalize peaks so they display beautifully (reaching max height of 1.0)
  const absoluteMax = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / absoluteMax);
}

export async function decodeAudioForWaveform(source: File | Blob | string): Promise<AudioBuffer> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const tempCtx = new AudioContextClass();

  const createFallbackBuffer = (duration = 180): AudioBuffer => {
    const sampleRate = tempCtx.sampleRate || 44100;
    const buffer = tempCtx.createBuffer(1, Math.floor(sampleRate * Math.min(duration, 30)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const progress = i / data.length;
      data[i] = (Math.sin(progress * 40) * 0.4 + Math.cos(progress * 120) * 0.2) * Math.sin(progress * Math.PI);
    }
    return buffer;
  };

  try {
    let blob: Blob | null = null;
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (!trimmed) return createFallbackBuffer();

      let target = trimmed;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!trimmed.includes('/api/proxy-media')) {
          target = `/api/proxy-media?url=${encodeURIComponent(trimmed)}`;
        }
      }

      try {
        const response = await fetch(target);
        if (!response.ok) {
          console.warn(`Waveform fetch warning (${response.statusText}), using fallback`);
          return createFallbackBuffer();
        }
        blob = await response.blob();
      } catch (fetchErr) {
        console.warn('Waveform proxy fetch error, using fallback:', fetchErr);
        return createFallbackBuffer();
      }
    } else if (source instanceof Blob) {
      blob = source;
    }

    if (!blob || blob.size < 64) {
      return createFallbackBuffer();
    }

    const arrayBuffer = await blob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 64) {
      return createFallbackBuffer();
    }

    try {
      return await tempCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.warn('Waveform decodeAudioData fallback:', decodeErr);
      return createFallbackBuffer();
    }
  } finally {
    tempCtx.close().catch(() => {});
  }
}
