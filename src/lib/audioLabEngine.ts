/**
 * Joelizer Audio Lab: local mastering, objective measurement and PCM WAV export.
 * This module makes NO AI-authorship or hidden-watermark detection claims.
 * Audio is processed locally and original source files remain untouched.
 */
export type MasterPreset = 'balanced' | 'warm' | 'bright' | 'transparent';
export type WavBitDepth = 16 | 24;

export interface MasterSettings {
  highPassHz: number;
  lowShelfDb: number;
  presenceDb: number;
  airDb: number;
  compressionEnabled: boolean;
  compressorThresholdDb: number;
  compressorRatio: number;
  targetRmsDbfs: number;
  samplePeakCeilingDbfs: number;
  bitDepth: WavBitDepth;
}

export interface AudioLabMetrics {
  duration: number;
  sampleRate: number;
  channels: number;
  samplePeakDbfs: number;
  rmsDbfs: number;
  crestDb: number;
  clippedPercent: number;
  dcOffset: number;
  stereoCorrelation: number | null;
  waveform: number[];
  spectrumDb: number[];
}

export const SPECTRAL_BANDS = [
  '20–60 Hz', '60–125 Hz', '125–250 Hz', '250–500 Hz',
  '500 Hz–2 kHz', '2–5 kHz', '5–10 kHz', '10–20 kHz'
];

export const MASTER_PRESETS: Record<MasterPreset, MasterSettings> = {
  balanced: {
    highPassHz: 25, lowShelfDb: 0, presenceDb: 0.8, airDb: 0.6,
    compressionEnabled: true, compressorThresholdDb: -20, compressorRatio: 2,
    targetRmsDbfs: -16, samplePeakCeilingDbfs: -1, bitDepth: 24
  },
  warm: {
    highPassHz: 25, lowShelfDb: 1.6, presenceDb: -0.4, airDb: 0,
    compressionEnabled: true, compressorThresholdDb: -22, compressorRatio: 2.2,
    targetRmsDbfs: -16, samplePeakCeilingDbfs: -1, bitDepth: 24
  },
  bright: {
    highPassHz: 28, lowShelfDb: -0.5, presenceDb: 1.2, airDb: 1.8,
    compressionEnabled: true, compressorThresholdDb: -19, compressorRatio: 2,
    targetRmsDbfs: -16, samplePeakCeilingDbfs: -1, bitDepth: 24
  },
  transparent: {
    highPassHz: 20, lowShelfDb: 0, presenceDb: 0, airDb: 0,
    compressionEnabled: false, compressorThresholdDb: -20, compressorRatio: 2,
    targetRmsDbfs: -18, samplePeakCeilingDbfs: -1, bitDepth: 24
  }
};

const EPSILON = 1e-12;
const asDb = (amplitude: number) =>
  amplitude > EPSILON ? 20 * Math.log10(amplitude) : -120;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Radix-2 FFT for coarse, honest spectral comparisons.
 * Bands represent relative spectral energy, NOT AI-detection probabilities.
 */
function spectralProfile(buffer: AudioBuffer): number[] {
  const size = 2048;
  const windows = 32;
  const channel = buffer.getChannelData(0);
  const limit = Math.max(0, channel.length - size);
  const bounds = [20, 60, 125, 250, 500, 2000, 5000, 10000, 20000];
  const sum = new Float64Array(8);
  const count = new Float64Array(8);
  if (channel.length < size) return Array(8).fill(-90);

  for (let windowIndex = 0; windowIndex < windows; windowIndex++) {
    const start = Math.floor(limit * (windowIndex + 0.5) / windows);
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let n = 0; n < size; n++) {
      real[n] = channel[start + n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (size - 1)));
    }
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const tmp = real[i]; real[i] = real[j]; real[j] = tmp;
      }
    }
    for (let length = 2; length <= size; length <<= 1) {
      const angle = -2 * Math.PI / length;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);
      for (let i = 0; i < size; i += length) {
        let cr = 1; let ci = 0;
        for (let j = 0; j < length / 2; j++) {
          const a = i + j; const b = a + length / 2;
          const vr = real[b] * cr - imag[b] * ci;
          const vi = real[b] * ci + imag[b] * cr;
          real[b] = real[a] - vr; imag[b] = imag[a] - vi;
          real[a] += vr; imag[a] += vi;
          const nextR = cr * wReal - ci * wImag;
          ci = cr * wImag + ci * wReal; cr = nextR;
        }
      }
    }
    for (let bin = 1; bin < size / 2; bin++) {
      const hz = bin * buffer.sampleRate / size;
      for (let band = 0; band < 8; band++) {
        if (hz >= bounds[band] && hz < bounds[band + 1]) {
          sum[band] += real[bin] * real[bin] + imag[bin] * imag[bin];
          count[band]++;
          break;
        }
      }
    }
  }
  const average = Array.from(sum, (x, i) => count[i] ? x / count[i] : 0);
  const highest = Math.max(...average, EPSILON);
  return average.map(v => clamp(10 * Math.log10(Math.max(v, EPSILON) / highest), -90, 0));
}

export function measureAudio(buffer: AudioBuffer): AudioLabMetrics {
  const channels = Math.max(1, buffer.numberOfChannels);
  const length = buffer.length;
  const waveformBuckets = 160;
  const waveform = new Float64Array(waveformBuckets);
  const bucketCounts = new Uint32Array(waveformBuckets);
  const arrays = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  let sumSquares = 0;
  let samplePeak = 0;
  let sumValues = 0;
  let clippedCount = 0;
  let stereoXY = 0; let stereoX2 = 0; let stereoY2 = 0;

  for (let i = 0; i < length; i++) {
    const bucket = Math.min(waveformBuckets - 1, Math.floor(i * waveformBuckets / Math.max(1, length)));
    for (let c = 0; c < channels; c++) {
      const sample = arrays[c][i];
      const v = Number.isFinite(sample) ? sample : 0;
      const sq = v * v;
      sumSquares += sq;
      samplePeak = Math.max(samplePeak, Math.abs(v));
      sumValues += v;
      if (Math.abs(v) >= 0.9999) clippedCount++;
      waveform[bucket] += sq;
      bucketCounts[bucket]++;
    }
    if (channels >= 2) {
      const x = arrays[0][i]; const y = arrays[1][i];
      stereoXY += x * y; stereoX2 += x * x; stereoY2 += y * y;
    }
  }
  const total = Math.max(1, length * channels);
  const rms = Math.sqrt(sumSquares / total);
  return {
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels,
    samplePeakDbfs: asDb(samplePeak),
    rmsDbfs: asDb(rms),
    crestDb: samplePeak > EPSILON && rms > EPSILON ? 20 * Math.log10(samplePeak / rms) : 0,
    clippedPercent: clippedCount / total * 100,
    dcOffset: sumValues / total,
    stereoCorrelation: channels >= 2 && stereoX2 * stereoY2 > EPSILON
      ? clamp(stereoXY / Math.sqrt(stereoX2 * stereoY2), -1, 1) : null,
    waveform: Array.from(waveform, (sq, i) => Math.sqrt(sq / Math.max(1, bucketCounts[i]))),
    spectrumDb: spectralProfile(buffer)
  };
}

export async function decodeLabFile(file: Blob): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  try {
    return await audioContext.decodeAudioData(await file.arrayBuffer());
  } finally {
    await audioContext.close();
  }
}

export async function masterLabAudio(
  source: AudioBuffer,
  settings: MasterSettings
): Promise<{ buffer: AudioBuffer; metrics: AudioLabMetrics; appliedGainDb: number }> {
  const offline = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate);
  const input = offline.createBufferSource();
  input.buffer = source;
  let node: AudioNode = input;

  const highpass = offline.createBiquadFilter();
  highpass.type = 'highpass'; highpass.frequency.value = clamp(settings.highPassHz, 15, 90);
  node.connect(highpass); node = highpass;

  const low = offline.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 145;
  low.gain.value = clamp(settings.lowShelfDb, -6, 6);
  node.connect(low); node = low;

  const presence = offline.createBiquadFilter();
  presence.type = 'peaking'; presence.frequency.value = 2800;
  presence.Q.value = 0.85; presence.gain.value = clamp(settings.presenceDb, -6, 6);
  node.connect(presence); node = presence;

  const high = offline.createBiquadFilter();
  high.type = 'highshelf'; high.frequency.value = Math.min(8000, source.sampleRate * 0.40);
  high.gain.value = clamp(settings.airDb, -6, 6);
  node.connect(high); node = high;

  if (settings.compressionEnabled) {
    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = clamp(settings.compressorThresholdDb, -40, -6);
    compressor.knee.value = 9;
    compressor.ratio.value = clamp(settings.compressorRatio, 1, 6);
    compressor.attack.value = 0.008;
    compressor.release.value = 0.22;
    node.connect(compressor); node = compressor;
  }
  node.connect(offline.destination);
  input.start(0);
  const rendered = await offline.startRendering();
  const measured = measureAudio(rendered);
  const desired = Math.pow(10, clamp(settings.targetRmsDbfs - measured.rmsDbfs, -24, 12) / 20);
  const ceiling = Math.pow(10, clamp(settings.samplePeakCeilingDbfs, -6, -0.1) / 20);
  const peak = Math.pow(10, measured.samplePeakDbfs / 20);
  const safeGain = Math.min(desired, ceiling / Math.max(peak, EPSILON));
  if (!Number.isFinite(safeGain) || safeGain <= 0) throw new Error('Cannot normalize this audio.');
  for (let channel = 0; channel < rendered.numberOfChannels; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= safeGain;
  }
  return { buffer: rendered, metrics: measureAudio(rendered), appliedGainDb: asDb(safeGain) };
}

/** 16-/24-bit PCM export with TPDF dither and an honest processing marker. */
export function encodeLabWav(buffer: AudioBuffer, bitDepth: WavBitDepth = 24): Blob {
  if (bitDepth !== 16 && bitDepth !== 24) throw new Error('Unsupported WAV bit depth.');
  const channels = buffer.numberOfChannels;
  const samples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const audioBytes = samples * channels * bytesPerSample;
  if (!Number.isSafeInteger(audioBytes) || audioBytes > 0xffffffff - 256)
    throw new Error('This recording is too large for a standard WAV file.');

  const writeAscii = (view: DataView, offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const software = 'Joelizer Audio Lab';
  const encoded = new TextEncoder().encode(software + '\0');
  const infoChunkSize = 4 + 8 + encoded.length + (encoded.length % 2);
  const start = 12 + 8 + 16 + 8 + infoChunkSize + 8;
  const bytes = new ArrayBuffer(start + audioBytes);
  const view = new DataView(bytes);
  writeAscii(view, 0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true);
  writeAscii(view, 8, 'WAVE'); writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, 'LIST'); view.setUint32(40, infoChunkSize, true);
  writeAscii(view, 44, 'INFO'); writeAscii(view, 48, 'ISFT');
  view.setUint32(52, encoded.length, true);
  new Uint8Array(bytes, 56, encoded.length).set(encoded);
  const dataHeader = 44 + infoChunkSize;
  writeAscii(view, dataHeader, 'data');
  view.setUint32(dataHeader + 4, audioBytes, true);
  const arrays = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  let offset = dataHeader + 8;
  const peakInt = Math.pow(2, bitDepth - 1);
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const x = arrays[channel][i];
      const dither = (Math.random() - Math.random()) / peakInt;
      const quantized = Math.round(clamp(x + dither, -1, 1 - 1 / peakInt) * peakInt);
      if (bitDepth === 16) {
        view.setInt16(offset, quantized, true); offset += 2;
      } else {
        view.setUint8(offset++, quantized & 255);
        view.setUint8(offset++, (quantized >> 8) & 255);
        view.setUint8(offset++, (quantized >> 16) & 255);
      }
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export function cleanMasterFilename(name: string): string {
  const stem = (name || 'audio').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9 _().-]/g, '_');
  return (stem.slice(0, 120) || 'audio') + '-joelizer-master.wav';
}
