/**
 * Deterministic 512-point spectral analysis of the decoded soundtrack.
 * Sample positions come from composition timestamps, not the active audio
 * device or its real-time analyser. Supports silent scenes and trimmed ranges.
 */
export class OfflineAudioAnalysis {
  private samples: Float32Array | null = null;
  private sampleRate = 48000;
  private readonly fftSize = 512;

  setBuffer(buffer: AudioBuffer | null) {
    this.samples = buffer ? buffer.getChannelData(0) : null;
    this.sampleRate = buffer?.sampleRate || 48000;
  }

  atTime(localSeconds: number): { frequency: Uint8Array; waveform: Uint8Array } {
    const spectrum = new Uint8Array(1024);
    const wave = new Uint8Array(1024).fill(128);
    const samples = this.samples;
    if (!samples) return { frequency: spectrum, waveform: wave };
    const center = Math.max(0, Math.floor(localSeconds * this.sampleRate));
    const n = this.fftSize;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 0; k < wave.length; k++) {
      const value = samples[center - 512 + k] || 0;
      wave[k] = Math.max(0, Math.min(255, Math.round(128 + value * 127)));
    }
    for (let i = 0; i < n; i++) {
      const sample = samples[center + i - n / 2] || 0;
      real[i] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    }
    // In-place radix-2 FFT (no external dependencies, no randomness).
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const step = -2 * Math.PI / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < size / 2; k++) {
          const angle = step * k;
          const wr = Math.cos(angle), wi = Math.sin(angle);
          const pos = start + k, next = pos + size / 2;
          const tr = wr * real[next] - wi * imag[next];
          const ti = wr * imag[next] + wi * real[next];
          real[next] = real[pos] - tr;
          imag[next] = imag[pos] - ti;
          real[pos] += tr;
          imag[pos] += ti;
        }
      }
    }
    for (let i = 0; i < n / 2; i++) {
      const amplitude = Math.hypot(real[i], imag[i]) / (n * 0.23);
      spectrum[i] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.min(1, amplitude * 4), 0.55))));
    }
    return { frequency: spectrum, waveform: wave };
  }
}
