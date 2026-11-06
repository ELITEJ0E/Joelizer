/**
 * Original phonk synthesis for Joelizer Audio Lab.
 * Deterministic signal generation; no third-party recordings or sample packs.
 * Designed for browser preview, drum pattern sequencing and WAV export.
 */
export type PhonkSound =
  | 'cowbell' | 'lead' | 'bass' | 'riser' | 'impact'
  | 'atmosphere' | 'kick' | 'snare' | 'hat';
export type PhonkStyle = 'drift' | 'brazilian' | 'dark';
export type PhonkLane = 'kick' | 'snare' | 'hat' | 'cowbell';
export const PHONK_LANES: PhonkLane[] = ['kick', 'snare', 'hat', 'cowbell'];
export const PHONK_SOUNDS: Array<{ id: PhonkSound; label: string; description: string }> = [
  { id: 'cowbell', label: '808 Cowbell', description: 'Metallic tuned oscillator with pitch glide' },
  { id: 'lead', label: 'Screaming Lead', description: 'Aggressive FM/saw synthesizer with saturation' },
  { id: 'bass', label: 'Sliding 808', description: 'Sub-bass kick with pitch glide and grit' },
  { id: 'riser', label: 'Riser / Sweep', description: 'Filtered noise and rising oscillator pitch' },
  { id: 'impact', label: 'Impact / Drop', description: 'Punchy low transient, noise and echo' },
  { id: 'atmosphere', label: 'Dark Atmosphere', description: 'Evolving pads, tension and noise textures' },
  { id: 'kick', label: 'Hard Kick', description: 'Punchy distorted bass drum' },
  { id: 'snare', label: 'Clap / Snare', description: 'Noisy snare and short clap transients' },
  { id: 'hat', label: 'Hi-Hat', description: 'Crisp metallic high percussion' }
];

export type PhonkSettings = {
  type: PhonkSound;
  style: PhonkStyle;
  note: number;
  duration: number;
  drive: number;
  tone: number;
  glide: number;
  space: number;
  seed: number;
};
export type PhonkPattern = Record<PhonkLane, boolean[]>;
export type PhonkPCM = { left: Float32Array; right: Float32Array; sampleRate: number; duration: number };

const TWO_PI = 2 * Math.PI;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const sine = (phase: number) => Math.sin(TWO_PI * phase);
const saw = (phase: number) => 2 * (phase - Math.floor(phase)) - 1;

function rng(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296 * 2 - 1;
  };
}

export const PHONK_PRESETS: Record<PhonkStyle, Omit<PhonkSettings, 'type' | 'seed'>> = {
  drift: { style: 'drift', note: 72, duration: 1.2, drive: 45, tone: 65, glide: 20, space: 26 },
  brazilian: { style: 'brazilian', note: 72, duration: 0.9, drive: 78, tone: 80, glide: 48, space: 12 },
  dark: { style: 'dark', note: 60, duration: 1.8, drive: 52, tone: 35, glide: 42, space: 60 }
};

export function makePhonkSettings(style: PhonkStyle, type: PhonkSound): PhonkSettings {
  return { ...PHONK_PRESETS[style], type, seed: 13871387 };
}

export const PHONK_PATTERNS: Record<PhonkStyle, PhonkPattern> = {
  drift: {
    kick: [1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0].map(Boolean),
    snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hat:  [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1].map(Boolean),
    cowbell:[1,0,0,1,0,0,1,0,1,1,0,0,1,0,0,1].map(Boolean)
  },
  brazilian: {
    kick: [1,0,0,1,1,0,1,0,1,0,0,1,1,0,1,0].map(Boolean),
    snare:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0].map(Boolean),
    hat:  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1].map(Boolean),
    cowbell:[1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1].map(Boolean)
  },
  dark: {
    kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0].map(Boolean),
    snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
    hat:  [1,0,0,0,1,0,1,0,1,0,0,0,1,0,1,0].map(Boolean),
    cowbell:[1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0].map(Boolean)
  }
};

/**
 * Generates isolated audio into PCM arrays. No AudioContext is required, making
 * this deterministic and testable in Node and independent of Web Audio timing.
 */
export function renderPhonkOneShot(
  params: PhonkSettings,
  sampleRate = 44100
): PhonkPCM {
  const rate = clamp(Math.round(sampleRate), 8000, 96000);
  const duration = clamp(params.duration, 0.08, 12);
  const length = Math.max(1, Math.round(duration * rate));
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const noise = rng(params.seed + params.note * 101);
  const base = midiToHz(clamp(params.note, 28, 96));
  const drive = clamp(params.drive, 0, 100) / 100;
  const tone = clamp(params.tone, 0, 100) / 100;
  const glide = clamp(params.glide, 0, 100) / 100;
  const space = clamp(params.space, 0, 100) / 100;
  const type = params.type;
  let phase = 0;
  let phase2 = 0;
  let phase3 = 0;
  let noiseLP = 0;
  let bassLP = 0;
  const attack = type === 'atmosphere' ? 0.20 : type === 'riser' ? 0.08 : 0.002;

  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const p = i / Math.max(1, length - 1);
    const tail = Math.max(0, 1 - p);
    const n = noise();
    noiseLP += (n - noiseLP) * (0.02 + 0.36 * tone);
    const brightNoise = n - noiseLP;
    let hz = base;
    let amp = 0;
    let raw = 0;

    switch (type) {
      case 'cowbell': {
        // A tuned pair of inharmonic oscillators, reminiscent of metallic 808 percussion.
        hz = base * (1 + glide * 0.22 * Math.exp(-t * 15));
        phase += hz / rate;
        phase2 += hz * 1.48 / rate;
        raw = 0.58 * Math.tanh(4.5 * sine(phase)) + 0.4 * Math.tanh(4.0 * sine(phase2));
        amp = (1 - Math.exp(-t * 240)) * Math.exp(-t * (2.3 + 7 * (1 - tone)));
        break;
      }
      case 'lead': {
        hz = base * (1 + glide * 0.64 * Math.exp(-t * 13));
        phase += hz / rate;
        phase2 += hz * (1.003 + 0.009 * glide) / rate;
        phase3 += hz * 2.03 / rate;
        const f = sine(phase2) * (0.22 + 0.8 * tone);
        raw = 0.55 * saw(phase + f * 0.13) + 0.25 * saw(phase2) + 0.22 * sine(phase3);
        amp = Math.min(1, t / attack) * Math.pow(tail, 0.65) * Math.min(1, (duration - t) / 0.035);
        break;
      }
      case 'bass': {
        hz = base * 0.5 * (1 + (0.25 + 2.1 * glide) * Math.exp(-t * (12 + 22 * (1 - glide))));
        phase += hz / rate;
        raw = sine(phase) + 0.25 * sine(phase * 2) * drive;
        amp = (1 - Math.exp(-t * 300)) * Math.exp(-t * (1.5 + 3.5 * (1 - tone)));
        break;
      }
      case 'riser': {
        hz = base * (0.15 + Math.pow(p, 2) * (3 + 4 * glide));
        phase += hz / rate;
        raw = 0.35 * sine(phase) + (0.22 + 0.55 * tone * p) * brightNoise;
        amp = Math.pow(p, 1.1) * Math.min(1, (duration - t) / 0.035);
        break;
      }
      case 'impact': {
        hz = 49 * (1 + 10 * Math.exp(-t * 35));
        phase += hz / rate;
        raw = 0.85 * sine(phase) + 0.52 * brightNoise * Math.exp(-t * 27);
        amp = Math.exp(-t * (2.1 + 4 * (1 - tone)));
        break;
      }
      case 'atmosphere': {
        hz = base * 0.25;
        phase += hz / rate;
        phase2 += hz * 1.504 / rate;
        phase3 += hz * (2.011 + 0.006 * Math.sin(t * 2.3)) / rate;
        raw = 0.56 * sine(phase) + 0.31 * sine(phase2) + 0.26 * sine(phase3) + 0.11 * noiseLP;
        amp = Math.min(1, t / attack) * Math.min(1, (duration - t) / 0.4) * 0.78;
        break;
      }
      case 'kick': {
        hz = 47 * (1 + 12 * Math.exp(-t * 44));
        phase += hz / rate;
        raw = sine(phase) + 0.22 * n * Math.exp(-t * 110);
        amp = Math.exp(-t * (11 - tone * 6));
        break;
      }
      case 'snare': {
        hz = 155;
        phase += hz / rate;
        raw = 0.78 * brightNoise + 0.34 * sine(phase) +
          0.28 * noise() * Math.exp(-t * 85);
        amp = Math.exp(-t * (13 + 10 * (1 - tone)));
        break;
      }
      case 'hat': {
        raw = 0.86 * brightNoise + 0.2 * sine(phase);
        hz = 4800;
        phase += hz / rate;
        amp = Math.exp(-t * (36 + 50 * (1 - tone)));
        break;
      }
    }

    // Dynamic saturation is rendered deliberately below digital clipping.
    const saturated = Math.tanh(raw * (1 + 6.5 * drive)) / Math.tanh(1 + 6.5 * drive);
    const mixed = raw * (1 - 0.65 * drive) + saturated * (0.65 * drive);
    // One-pole low-pass for more restrained low-end timbres.
    bassLP += (mixed - bassLP) * (0.07 + 0.85 * tone);
    const v = (type === 'bass' || type === 'atmosphere' ? bassLP : mixed) * amp * 0.68;
    const stereoMotion = type === 'atmosphere' || type === 'riser'
      ? Math.sin(0.75 * t + 0.2) * 0.16 : 0;
    left[i] = v * (1 - stereoMotion);
    right[i] = v * (1 + stereoMotion);
  }

  if (space > 0) {
    // Discrete reflections + gently filtered tail, applied without copying
    // unlicensed recordings or relying on external convolution impulses.
    const delaySamples = [0.093, 0.181, 0.291].map(s => Math.round(s * rate));
    const wetGain = space * 0.36;
    for (let i = 0; i < length; i++) {
      let l = 0; let r = 0;
      for (let tap = 0; tap < delaySamples.length; tap++) {
        const previous = i - delaySamples[tap];
        if (previous < 0) continue;
        const gain = wetGain * (0.46 - 0.08 * tap);
        l += right[previous] * gain;
        r += left[previous] * gain;
      }
      // Dry channel always remains; wet reflections add stereo space.
      left[i] += l;
      right[i] += r;
    }
  }
  return { left, right, sampleRate: rate, duration: length / rate };
}

export function normalizePhonkPCM(pcm: PhonkPCM, ceilingDb = -1): PhonkPCM {
  let peak = 0;
  for (let i = 0; i < pcm.left.length; i++) {
    peak = Math.max(peak, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]));
  }
  if (peak === 0) return pcm;
  const target = Math.pow(10, clamp(ceilingDb, -12, -0.1) / 20);
  const gain = target / peak;
  const left = new Float32Array(pcm.left.length);
  const right = new Float32Array(pcm.right.length);
  for (let i = 0; i < left.length; i++) {
    left[i] = pcm.left[i] * gain;
    right[i] = pcm.right[i] * gain;
  }
  return { ...pcm, left, right };
}

export function renderPhonkBeat(
  pattern: PhonkPattern,
  bpm: number,
  settings: PhonkSettings,
  bars = 4,
  sampleRate = 44100
): PhonkPCM {
  const tempo = clamp(bpm, 60, 220);
  const barCount = clamp(Math.round(bars), 1, 16);
  const samplesPerStep = sampleRate * 60 / tempo / 4;
  const total = Math.ceil(samplesPerStep * 16 * barCount);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const hitCache = new Map<string, PhonkPCM>();
  for (let bar = 0; bar < barCount; bar++) {
    for (let step = 0; step < 16; step++) {
      const start = Math.round((bar * 16 + step) * samplesPerStep);
      for (const lane of PHONK_LANES) {
        if (!pattern[lane]?.[step]) continue;
        const noteOffset = lane === 'cowbell' ? [0, 3, 7, 10][(step + bar) % 4] : 0;
        const sound: PhonkSettings = {
          ...settings, type: lane,
          note: lane === 'cowbell' ? clamp(settings.note + noteOffset, 28, 96) : settings.note,
          duration: lane === 'cowbell' ? 0.28 : lane === 'kick' ? 0.65 : lane === 'snare' ? 0.28 : 0.14,
          space: lane === 'cowbell' ? settings.space : Math.min(15, settings.space),
          seed: settings.seed + step + bar * 16
        };
        const cacheKey = JSON.stringify(sound);
        let hit = hitCache.get(cacheKey);
        if (!hit) {
          hit = renderPhonkOneShot(sound, sampleRate);
          hitCache.set(cacheKey, hit);
        }
        for (let j = 0; j < hit.left.length && start + j < total; j++) {
          left[start + j] += hit.left[j] * 0.58;
          right[start + j] += hit.right[j] * 0.58;
        }
      }
    }
  }
  // Controlled mix-bus soft clip, then peak normalize to -1 dBFS.
  for (let i = 0; i < total; i++) {
    left[i] = Math.tanh(left[i] * 1.2);
    right[i] = Math.tanh(right[i] * 1.2);
  }
  return normalizePhonkPCM({ left, right, sampleRate, duration: total / sampleRate });
}

export function createPhonkAudioBuffer(pcm: PhonkPCM): AudioBuffer {
  const buffer = new AudioBuffer({
    numberOfChannels: 2, sampleRate: pcm.sampleRate,
    length: pcm.left.length
  });
  buffer.copyToChannel(pcm.left as Float32Array<ArrayBuffer>, 0);
  buffer.copyToChannel(pcm.right as Float32Array<ArrayBuffer>, 1);
  return buffer;
}

export function filenameForPhonk(sound: PhonkSound | 'beat', style: PhonkStyle): string {
  return 'joelizer-' + style + '-phonk-' + sound + '.wav';
}
