import { MusicComposition, NoteEvent, ChordEvent, DrumEvent, BassEvent, PadEvent } from '../../server/geminiMusicComposer';

export class GeminiMusicSynthesizer {
  private sampleRate = 44100;

  /**
   * Generates a stereo reverb impulse response buffer
   */
  private createReverbImpulse(ctx: OfflineAudioContext, duration = 2.0, decay = 2.5): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  /**
   * Synthesize an entire composition into an AudioBuffer
   */
  public async renderComposition(comp: MusicComposition, channelVolumes?: {
    melody?: number;
    chords?: number;
    bass?: number;
    drums?: number;
    pads?: number;
  }): Promise<AudioBuffer> {
    const totalDuration = Math.max(1, comp.duration + 2.5); // Add release tail
    const length = Math.ceil(this.sampleRate * totalDuration);
    const ctx = new OfflineAudioContext(2, length, this.sampleRate);

    // Master bus chain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, 0);

    const masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-14, 0);
    masterCompressor.knee.setValueAtTime(10, 0);
    masterCompressor.ratio.setValueAtTime(4, 0);
    masterCompressor.attack.setValueAtTime(0.005, 0);
    masterCompressor.release.setValueAtTime(0.1, 0);

    // Reverb bus
    const reverbConvolver = ctx.createConvolver();
    reverbConvolver.buffer = this.createReverbImpulse(ctx, 2.2, 2.8);
    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(0.22, 0);

    reverbConvolver.connect(reverbGain);
    reverbGain.connect(masterCompressor);

    masterGain.connect(masterCompressor);
    masterCompressor.connect(ctx.destination);

    // Track sub-mix gains
    const melodyGain = ctx.createGain();
    melodyGain.gain.setValueAtTime(channelVolumes?.melody ?? 0.85, 0);
    melodyGain.connect(masterGain);
    melodyGain.connect(reverbConvolver);

    const chordsGain = ctx.createGain();
    chordsGain.gain.setValueAtTime(channelVolumes?.chords ?? 0.75, 0);
    chordsGain.connect(masterGain);
    chordsGain.connect(reverbConvolver);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(channelVolumes?.bass ?? 0.95, 0);
    bassGain.connect(masterGain); // Bass bypasses reverb for clean low-end

    const drumsGain = ctx.createGain();
    drumsGain.gain.setValueAtTime(channelVolumes?.drums ?? 0.9, 0);
    drumsGain.connect(masterGain);

    const padsGain = ctx.createGain();
    padsGain.gain.setValueAtTime(channelVolumes?.pads ?? 0.65, 0);
    padsGain.connect(masterGain);
    padsGain.connect(reverbConvolver);

    // 1. Synthesize Drums
    for (const d of comp.drums) {
      if (d.startTime > comp.duration) continue;
      this.synthesizeDrum(ctx, d, drumsGain);
    }

    // 2. Synthesize Bass
    for (const b of comp.bass) {
      if (b.startTime > comp.duration) continue;
      this.synthesizeBass(ctx, b, bassGain);
    }

    // 3. Synthesize Chords & Keys
    for (const c of comp.chords) {
      if (c.startTime > comp.duration) continue;
      this.synthesizeChord(ctx, c, chordsGain);
    }

    // 4. Synthesize Melody
    for (const m of comp.melody) {
      if (m.startTime > comp.duration) continue;
      this.synthesizeMelodyNote(ctx, m, melodyGain);
    }

    // 5. Synthesize Ambient Pads
    for (const p of comp.pads) {
      if (p.startTime > comp.duration) continue;
      this.synthesizePad(ctx, p, padsGain);
    }

    // Render offline audio context
    return await ctx.startRendering();
  }

  /**
   * Synthesizes drum sounds (Kick, Snare, Hi-Hat, Clap)
   */
  private synthesizeDrum(ctx: OfflineAudioContext, drum: DrumEvent, dest: AudioNode) {
    const t = Math.max(0, drum.startTime);
    const vel = drum.velocity;

    if (drum.type === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Pitch drop envelope for punchy 808 kick
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      osc.frequency.linearRampToValueAtTime(30, t + 0.28);

      gain.gain.setValueAtTime(1.0 * vel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(t);
      osc.stop(t + 0.36);
    } else if (drum.type === 'snare') {
      // Body tone
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      oscGain.gain.setValueAtTime(0.7 * vel, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);

      // Snare wire noise burst
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.85 * vel, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(t);
      noise.stop(t + 0.22);
    } else if (drum.type === 'hihat' || drum.type === 'openhat') {
      const isClosed = drum.type === 'hihat';
      const hatDur = isClosed ? 0.05 : 0.25;

      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * hatDur), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6 * vel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + hatDur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(t);
      noise.stop(t + hatDur);
    } else if (drum.type === 'clap') {
      const clapLength = 0.2;
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * clapLength), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(2, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      // Staggered claps burst
      gain.gain.setValueAtTime(0.7 * vel, t + 0.01);
      gain.gain.setValueAtTime(0.85 * vel, t + 0.025);
      gain.gain.setValueAtTime(1.0 * vel, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(t);
      noise.stop(t + clapLength);
    }
  }

  /**
   * Synthesize bass tone with sub resonance & saturation
   */
  private synthesizeBass(ctx: OfflineAudioContext, bass: BassEvent, dest: AudioNode) {
    const t = Math.max(0, bass.startTime);
    const dur = Math.max(0.1, bass.duration);
    const vel = bass.velocity;
    const freq = bass.freq;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (bass.style === 'sub') {
      osc.type = 'sine';
      osc2.type = 'triangle';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);
    } else {
      osc.type = 'sawtooth';
      osc2.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + dur * 0.8);
      filter.Q.setValueAtTime(3, t);
    }

    osc.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq, t);

    // ADSR Envelope
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.85 * vel, t + 0.02); // Fast attack
    gain.gain.setValueAtTime(0.75 * vel, t + dur * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur); // Release

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /**
   * Synthesize multi-harmonic piano & Rhodes keys
   */
  private synthesizeChord(ctx: OfflineAudioContext, chord: ChordEvent, dest: AudioNode) {
    const t = Math.max(0, chord.startTime);
    const dur = Math.max(0.2, chord.duration);

    for (const freq of chord.freqs) {
      if (freq <= 0) continue;

      // Additive harmonics for warm piano/Rhodes
      const harmonics = [1, 2, 3, 4, 5];
      const amplitudes = [0.5, 0.25, 0.12, 0.06, 0.03];

      for (let h = 0; h < harmonics.length; h++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * harmonics[h], t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, t);
        filter.frequency.exponentialRampToValueAtTime(600, t + dur);

        const amp = amplitudes[h] * 0.35;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(amp, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }

  /**
   * Synthesize expressive lead melody (Synthwave, Pluck, Flute, Piano)
   */
  private synthesizeMelodyNote(ctx: OfflineAudioContext, note: NoteEvent, dest: AudioNode) {
    const t = Math.max(0, note.startTime);
    const dur = Math.max(0.08, note.duration);
    const vel = note.velocity;
    const freq = note.freq;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (note.instrument === 'pluck') {
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc2.detune.setValueAtTime(6, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, t);
      filter.frequency.exponentialRampToValueAtTime(400, t + dur * 0.6);
      filter.Q.setValueAtTime(2.5, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.8 * vel, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else if (note.instrument === 'flute') {
      osc1.type = 'sine';
      osc2.type = 'triangle';
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, t);
      filter.Q.setValueAtTime(1.5, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.7 * vel, t + 0.04);
      gain.gain.setValueAtTime(0.6 * vel, t + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else {
      // Default: Synthwave / Lead
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc2.detune.setValueAtTime(9, t); // Lush stereo detune
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + dur);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.75 * vel, t + 0.02);
      gain.gain.setValueAtTime(0.65 * vel, t + dur * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }

    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq, t);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /**
   * Synthesize lush ambient background pad
   */
  private synthesizePad(ctx: OfflineAudioContext, pad: PadEvent, dest: AudioNode) {
    const t = Math.max(0, pad.startTime);
    const dur = Math.max(0.5, pad.duration);

    for (const freq of pad.freqs) {
      if (freq <= 0) continue;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc2.detune.setValueAtTime(7, t);

      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, t);

      // Soft swell attack and long release
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.8);
      gain.gain.setValueAtTime(0.28, t + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + dur + 0.1);
      osc2.stop(t + dur + 0.1);
    }
  }

  /**
   * Converts an AudioBuffer to a standard 16-bit PCM Stereo .WAV Blob
   */
  public audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // FMT sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // 16 for PCM
    setUint16(1); // PCM format = 1
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // 16-bit PCM

    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }
}

export const geminiSynthesizer = new GeminiMusicSynthesizer();
