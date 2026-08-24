import fs from 'fs';
import path from 'path';
import { ACEStepGenerateOptions } from './types';

// Musical scale intervals for procedural composition
const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9]
};

const NOTE_NAMES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

function noteToFreq(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Generates a rich stereo 16-bit PCM WAV buffer tailored to prompt, BPM, key, and duration.
 */
export function synthesizeMusicWav(options: ACEStepGenerateOptions): { buffer: Buffer; duration: number; filename: string } {
  const duration = Math.max(5, Math.min(180, options.duration || 30));
  const sampleRate = 44100;
  const numChannels = 2;
  const totalSamples = Math.floor(sampleRate * duration);
  const bpm = options.bpm && options.bpm > 40 && options.bpm < 220 ? options.bpm : 120;
  const beatDuration = 60 / bpm;
  const promptLower = (options.prompt || '').toLowerCase();

  // Determine musical style and scale
  let scaleType = 'minor';
  let rootNote = 60; // Middle C

  if (options.keySignature) {
    const rootStr = options.keySignature.split(/[\s_-]/)[0];
    const isMajor = options.keySignature.toLowerCase().includes('maj');
    if (NOTE_NAMES[rootStr] !== undefined) {
      rootNote = 60 + NOTE_NAMES[rootStr];
    }
    scaleType = isMajor ? 'major' : 'minor';
  } else {
    if (promptLower.includes('pop') || promptLower.includes('happy') || promptLower.includes('uplifting') || promptLower.includes('worship')) {
      scaleType = 'major';
      rootNote = 60; // C Major
    } else if (promptLower.includes('synth') || promptLower.includes('cyber') || promptLower.includes('epic')) {
      scaleType = 'minor';
      rootNote = 57; // A Minor
    } else if (promptLower.includes('lo-fi') || promptLower.includes('chill') || promptLower.includes('jazz')) {
      scaleType = 'dorian';
      rootNote = 62; // D Dorian
    }
  }

  const scale = SCALES[scaleType] || SCALES.minor;
  const chordProgressions = scaleType === 'major'
    ? [[0, 4, 7], [5, 9, 12], [7, 11, 14], [9, 12, 16]] // I - IV - V - vi
    : [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]]; // i - iv - v - III

  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);

  // Generate multi-instrument arrangement
  const isAmbient = promptLower.includes('ambient') || promptLower.includes('meditation') || promptLower.includes('calm');
  const isElectronic = promptLower.includes('synth') || promptLower.includes('edm') || promptLower.includes('techno') || promptLower.includes('dance');
  const isLofi = promptLower.includes('lo-fi') || promptLower.includes('chill') || promptLower.includes('relax');

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const currentBeat = t / beatDuration;
    const currentBar = Math.floor(currentBeat / 4);
    const chordIndex = currentBar % chordProgressions.length;
    const activeChord = chordProgressions[chordIndex];

    let left = 0;
    let right = 0;

    // 1. Kick & Percussion (on 4/4 beats)
    if (!isAmbient) {
      const beatPhase = currentBeat % 1.0;
      const beatNum = Math.floor(currentBeat) % 4;

      // Kick on beat 0 and 2 (or four on floor for electronic)
      if (beatNum === 0 || (isElectronic && beatNum === 2) || (isElectronic && beatPhase < 0.2)) {
        if (beatPhase < 0.25) {
          const kickEnv = Math.exp(-beatPhase * 28);
          const kickFreq = 140 * Math.exp(-beatPhase * 40) + 45;
          const kickSample = Math.sin(2 * Math.PI * kickFreq * beatPhase) * kickEnv * 0.45;
          left += kickSample;
          right += kickSample;
        }
      }

      // Snare / Clap on beat 1 and 3
      if (beatNum === 1 || beatNum === 3) {
        if (beatPhase < 0.2) {
          const snareEnv = Math.exp(-beatPhase * 22);
          const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1;
          const snareTone = Math.sin(2 * Math.PI * 185 * beatPhase) * 0.5;
          const snareSample = (noise * 0.7 + snareTone * 0.3) * snareEnv * 0.28;
          left += snareSample * 0.95;
          right += snareSample * 1.05;
        }
      }

      // Hi-Hat on 8th notes
      const eighthPhase = (currentBeat * 2) % 1.0;
      if (eighthPhase < 0.08) {
        const hatEnv = Math.exp(-eighthPhase * 50);
        const noise = ((Math.sin(i * 78.233) * 43758.5453) % 1) * 2 - 1;
        const hatSample = noise * hatEnv * (isLofi ? 0.06 : 0.12);
        left += hatSample * 1.1;
        right += hatSample * 0.9;
      }
    }

    // 2. Bassline (Root note of active chord)
    const bassNote = rootNote - 24 + activeChord[0];
    const bassFreq = noteToFreq(bassNote);
    const bassEnv = 0.5 + 0.5 * Math.cos(2 * Math.PI * (currentBeat % 1.0));
    const bassSaw = (2 * ((t * bassFreq) % 1) - 1);
    const bassSin = Math.sin(2 * Math.PI * bassFreq * t);
    const bassSample = (bassSaw * 0.3 + bassSin * 0.7) * (isElectronic ? 0.3 : 0.22) * bassEnv;
    left += bassSample;
    right += bassSample;

    // 3. Harmonic Chords & Pads (Warm detuned saws with stereo spread)
    for (let c = 0; c < activeChord.length; c++) {
      const padNote = rootNote - 12 + activeChord[c];
      const freqL = noteToFreq(padNote) * 0.998;
      const freqR = noteToFreq(padNote) * 1.002;
      const padEnv = 0.12 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.25 * t));
      
      const waveL = Math.sin(2 * Math.PI * freqL * t) + 0.3 * Math.sin(4 * Math.PI * freqL * t);
      const waveR = Math.sin(2 * Math.PI * freqR * t) + 0.3 * Math.sin(4 * Math.PI * freqR * t);
      
      left += waveL * padEnv;
      right += waveR * padEnv;
    }

    // 4. Arpeggiator / Melodic Lead
    const sixteenth = Math.floor(currentBeat * 4) % 16;
    const arpNoteIndex = activeChord[sixteenth % activeChord.length];
    const arpOctave = Math.floor(sixteenth / activeChord.length) % 2;
    const arpNote = rootNote + arpNoteIndex + (arpOctave * 12);
    const arpFreq = noteToFreq(arpNote);
    const arpPhase = (currentBeat * 4) % 1.0;
    const arpEnv = Math.exp(-arpPhase * 9);
    const arpSample = (Math.sin(2 * Math.PI * arpFreq * t) + 0.2 * Math.sin(6 * Math.PI * arpFreq * t)) * arpEnv * 0.15;
    
    // Stereo ping-pong panning for arpeggio
    const pan = Math.sin(2 * Math.PI * 0.5 * currentBeat);
    left += arpSample * (0.5 - pan * 0.4);
    right += arpSample * (0.5 + pan * 0.4);

    // Apply fade in (0.5s) and fade out (1.5s)
    let masterEnv = 1.0;
    if (t < 0.5) masterEnv = t / 0.5;
    if (t > duration - 1.5) masterEnv = Math.max(0, (duration - t) / 1.5);

    leftChannel[i] = Math.max(-0.98, Math.min(0.98, left * masterEnv));
    rightChannel[i] = Math.max(-0.98, Math.min(0.98, right * masterEnv));
  }

  // Encode to 16-bit PCM Stereo WAV
  const headerLength = 44;
  const byteLength = totalSamples * numChannels * 2;
  const buffer = Buffer.alloc(headerLength + byteLength);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + byteLength, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM = 1)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * 2, 32);              // BlockAlign
  buffer.writeUInt16LE(16, 34);                           // BitsPerSample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(byteLength, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const sL = Math.max(-1, Math.min(1, leftChannel[i]));
    const sR = Math.max(-1, Math.min(1, rightChannel[i]));
    const intL = sL < 0 ? sL * 32768 : sL * 32767;
    const intR = sR < 0 ? sR * 32768 : sR * 32767;
    buffer.writeInt16LE(Math.floor(intL), offset);
    buffer.writeInt16LE(Math.floor(intR), offset + 2);
    offset += 4;
  }

  const filename = `ace_synth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.wav`;
  return { buffer, duration, filename };
}
