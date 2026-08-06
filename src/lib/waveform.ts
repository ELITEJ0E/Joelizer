export function generateWaveformPeaks(audioBuffer: AudioBuffer, targetPoints: number): number[] {
  const channelData = audioBuffer.getChannelData(0); // Use the first channel
  const totalLength = channelData.length;
  const bucketSize = Math.floor(totalLength / targetPoints);
  const peaks: number[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, totalLength);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
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
  let blob: Blob;
  if (typeof source === 'string') {
    // remote URL fetch
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote audio: ${response.statusText}`);
    }
    blob = await response.blob();
  } else {
    blob = source;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const tempCtx = new AudioContextClass();
  try {
    return await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    tempCtx.close().catch(() => {});
  }
}
