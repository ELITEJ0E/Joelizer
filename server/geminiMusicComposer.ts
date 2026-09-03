import { GoogleGenAI } from '@google/genai';

export interface ComposeRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  duration?: number; // In seconds (default 30-60)
  includeLyrics?: boolean;
  apiKey?: string;
}

export interface NoteEvent {
  note: string; // e.g. "C4", "E4", "G4"
  freq: number; // Hz
  startTime: number; // Seconds
  duration: number; // Seconds
  velocity: number; // 0.0 to 1.0
  instrument?: 'piano' | 'synth_lead' | 'pluck' | 'keys' | 'flute' | 'guitar';
}

export interface ChordEvent {
  chord: string; // e.g. "Cmaj7", "Am9", "Fmaj7", "G7"
  root: string;
  type: string;
  notes: string[];
  freqs: number[];
  startTime: number;
  duration: number;
}

export interface DrumEvent {
  type: 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'tom';
  startTime: number;
  velocity: number;
}

export interface BassEvent {
  note: string;
  freq: number;
  startTime: number;
  duration: number;
  velocity: number;
  style?: 'sub' | 'synth_bass' | 'pluck_bass';
}

export interface PadEvent {
  notes: string[];
  freqs: number[];
  startTime: number;
  duration: number;
}

export interface LyricLinePlan {
  text: string;
  startTime: number;
  duration: number;
}

export interface MusicComposition {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  timeSignature: string;
  duration: number;
  description: string;
  chords: ChordEvent[];
  melody: NoteEvent[];
  bass: BassEvent[];
  drums: DrumEvent[];
  pads: PadEvent[];
  lyrics: LyricLinePlan[];
  source?: 'gemini-2.5-flash' | 'gemini-3.7-flash' | 'gemini-2.5-pro' | 'procedural-fallback';
}

// Note name to frequency converter helper
export function noteToFreq(note: string): number {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 440;

  let noteName = match[1].toUpperCase();
  // Handle flats
  if (noteName === 'DB') noteName = 'C#';
  else if (noteName === 'EB') noteName = 'D#';
  else if (noteName === 'GB') noteName = 'F#';
  else if (noteName === 'AB') noteName = 'G#';
  else if (noteName === 'BB') noteName = 'A#';

  const octave = parseInt(match[2], 10);
  const noteIndex = notes.indexOf(noteName);
  if (noteIndex === -1) return 440;

  // A4 is 440 Hz (index 9 in octave 4)
  const midi = (octave + 1) * 12 + noteIndex;
  return Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
}

// Musical scale intervals for procedural composition
const SCALES: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10]
};

const ROOT_NOTE_INDICES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNote(midi: number): string {
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * Procedural music generator as a 100% resilient fallback engine.
 * Generates harmonic progressions, melody, walking/synth bass, and drum grooves.
 */
export function generateProceduralComposition(req: ComposeRequest): MusicComposition {
  const duration = Math.min(120, Math.max(15, Number(req.duration) || 30));
  const targetGenre = req.genre || 'Lo-Fi Chillhop';
  const targetMood = req.mood || 'Nostalgic & Cozy';
  const bpm = Math.max(60, Math.min(160, Number(req.bpm) || 85));
  const rawKey = req.key || 'C Major';

  // Parse Key & Scale
  const keyParts = rawKey.split(' ');
  const rootStr = keyParts[0] || 'C';
  const scaleType = keyParts.slice(1).join(' ') || 'Major';
  const rootIndex = ROOT_NOTE_INDICES[rootStr] ?? 0;
  const isMinor = scaleType.toLowerCase().includes('minor') || scaleType.toLowerCase().includes('dorian');
  const scaleIntervals = isMinor ? SCALES['Minor'] : SCALES['Major'];

  // Bar math (4/4 time)
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4;
  const totalBars = Math.ceil(duration / secondsPerBar);

  // Common harmonic progressions
  const majorProgressions = [
    [0, 5, 3, 4], // I - vi - IV - V (e.g. C - Am - F - G)
    [0, 3, 4, 3], // I - IV - V - IV
    [1, 4, 0, 5], // ii - V - I - vi (Lo-fi / Jazz: Dm7 - G7 - Cmaj7 - Am7)
    [0, 4, 5, 3]  // I - V - vi - IV (Pop progression)
  ];
  const minorProgressions = [
    [0, 5, 2, 6], // i - VI - III - VII (e.g. Am - F - C - G)
    [0, 3, 4, 0], // i - iv - v - i
    [0, 5, 3, 4], // i - VI - iv - v
    [0, 2, 6, 5]  // i - III - VII - VI
  ];

  const progList = isMinor ? minorProgressions : majorProgressions;
  const chosenProg = progList[Math.floor(Math.random() * progList.length)];

  const chords: ChordEvent[] = [];
  const bass: BassEvent[] = [];
  const pads: PadEvent[] = [];
  const melody: NoteEvent[] = [];
  const drums: DrumEvent[] = [];

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * secondsPerBar;
    if (barStart >= duration) break;

    const degreeIndex = chosenProg[bar % chosenProg.length];
    const degreeInterval = scaleIntervals[degreeIndex % scaleIntervals.length];
    const chordRootMidi = 60 + rootIndex + degreeInterval; // Octave 4
    const bassRootMidi = 36 + rootIndex + degreeInterval;  // Octave 2
    const padRootMidi = 48 + rootIndex + degreeInterval;   // Octave 3

    // Build 7th / 9th chord voicing
    const thirdInterval = isMinor ? (degreeIndex === 0 || degreeIndex === 3 || degreeIndex === 4 ? 3 : 4) : (degreeIndex === 1 || degreeIndex === 2 || degreeIndex === 5 ? 3 : 4);
    const fifthInterval = 7;
    const seventhInterval = isMinor ? 10 : (degreeIndex === 0 || degreeIndex === 3 ? 11 : 10);

    const chordNoteMidis = [
      chordRootMidi - 12,
      chordRootMidi - 12 + thirdInterval,
      chordRootMidi - 12 + fifthInterval,
      chordRootMidi - 12 + seventhInterval
    ];
    const chordNotes = chordNoteMidis.map(midiToNote);
    const chordFreqs = chordNotes.map(noteToFreq);
    const chordDuration = Math.min(secondsPerBar, duration - barStart);

    const rootName = NOTE_NAMES[(rootIndex + degreeInterval) % 12];
    const chordName = `${rootName}${isMinor ? 'm7' : 'maj7'}`;

    chords.push({
      chord: chordName,
      root: rootName,
      type: isMinor ? 'm7' : 'maj7',
      notes: chordNotes,
      freqs: chordFreqs,
      startTime: barStart,
      duration: chordDuration
    });

    // Pad Event
    const padNoteMidis = [
      padRootMidi,
      padRootMidi + thirdInterval,
      padRootMidi + fifthInterval,
      padRootMidi + 12
    ];
    pads.push({
      notes: padNoteMidis.map(midiToNote),
      freqs: padNoteMidis.map(midiToNote).map(noteToFreq),
      startTime: barStart,
      duration: chordDuration
    });

    // Bassline (rhythmic 8th-note or quarter notes)
    const bassNoteName = midiToNote(bassRootMidi);
    const bassFreq = noteToFreq(bassNoteName);
    bass.push({
      note: bassNoteName,
      freq: bassFreq,
      startTime: barStart,
      duration: secondsPerBeat * 1.8,
      velocity: 0.9,
      style: targetGenre.includes('Synthwave') || targetGenre.includes('Electro') ? 'synth_bass' : 'sub'
    });

    if (barStart + secondsPerBeat * 2 < duration) {
      bass.push({
        note: midiToNote(bassRootMidi + (Math.random() > 0.5 ? 7 : 5)),
        freq: noteToFreq(midiToNote(bassRootMidi + (Math.random() > 0.5 ? 7 : 5))),
        startTime: barStart + secondsPerBeat * 2,
        duration: secondsPerBeat * 1.5,
        velocity: 0.85,
        style: targetGenre.includes('Synthwave') || targetGenre.includes('Electro') ? 'synth_bass' : 'sub'
      });
    }

    // Melody Generation (Pentatonic / Scale steps)
    const melodySteps = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    for (const step of melodySteps) {
      if (Math.random() > 0.35) { // 65% note density
        const noteTime = barStart + step * secondsPerBeat;
        if (noteTime >= duration) break;

        const randomDegree = scaleIntervals[Math.floor(Math.random() * scaleIntervals.length)];
        const octaveOffset = Math.random() > 0.6 ? 12 : 0;
        const melodyMidi = 60 + rootIndex + randomDegree + octaveOffset;
        const melNote = midiToNote(melodyMidi);

        melody.push({
          note: melNote,
          freq: noteToFreq(melNote),
          startTime: noteTime,
          duration: secondsPerBeat * (Math.random() > 0.5 ? 0.45 : 0.8),
          velocity: 0.75 + Math.random() * 0.2,
          instrument: targetGenre.includes('Synthwave') ? 'synth_lead' : 'piano'
        });
      }
    }

    // Drum Grooves across 4 beats in bar
    for (let beat = 0; beat < 4; beat++) {
      const beatTime = barStart + beat * secondsPerBeat;
      if (beatTime >= duration) break;

      // Kick on beat 1 and 3 (plus syncopated on 2.5 for groove)
      if (beat === 0 || beat === 2) {
        drums.push({ type: 'kick', startTime: beatTime, velocity: 0.95 });
      } else if (beat === 1 && Math.random() > 0.6 && beatTime + secondsPerBeat * 0.5 < duration) {
        drums.push({ type: 'kick', startTime: beatTime + secondsPerBeat * 0.5, velocity: 0.8 });
      }

      // Snare / Clap on beat 2 and 4
      if (beat === 1 || beat === 3) {
        drums.push({ type: targetGenre.includes('Synthwave') ? 'clap' : 'snare', startTime: beatTime, velocity: 0.9 });
      }

      // Hi-Hats every 8th note
      drums.push({ type: 'hihat', startTime: beatTime, velocity: 0.65 });
      if (beatTime + secondsPerBeat * 0.5 < duration) {
        drums.push({ type: 'hihat', startTime: beatTime + secondsPerBeat * 0.5, velocity: 0.45 });
      }
    }
  }

  // Lyrics generation fallback
  const sampleLyrics: LyricLinePlan[] = [
    { text: 'City lights glow beneath the midnight sky', startTime: 2.0, duration: 4.0 },
    { text: 'Fading echoes of the memories floating by', startTime: 7.0, duration: 4.0 },
    { text: 'Every heartbeat riding on the mellow groove', startTime: 12.0, duration: 4.0 },
    { text: 'In this twilight rhythm where our spirits move', startTime: 17.0, duration: 4.0 }
  ];

  return {
    title: `${targetGenre} Session (${rawKey})`,
    artist: 'Joelizer AI Composer',
    genre: targetGenre,
    mood: targetMood,
    bpm: bpm,
    key: rawKey,
    timeSignature: '4/4',
    duration: duration,
    description: `Harmonic ${targetGenre} track composed in ${rawKey} at ${bpm} BPM.`,
    chords,
    melody,
    bass,
    drums,
    pads,
    lyrics: req.includeLyrics !== false ? sampleLyrics : [],
    source: 'procedural-fallback'
  };
}

export async function composeMusicWithGemini(
  ai: GoogleGenAI,
  req: ComposeRequest
): Promise<MusicComposition> {
  const duration = Math.min(120, Math.max(15, Number(req.duration) || 30));
  const targetGenre = req.genre || 'Lo-Fi Chillhop';
  const targetMood = req.mood || 'Uplifting & Nostalgic';
  const targetBpm = Number(req.bpm) || 90;
  const targetKey = req.key || 'C Major';

  const systemInstruction = `You are an elite music producer, audio theorist, and algorithmic composer.
Your task is to generate complete, musical, rhythmically accurate compositions with rich chord progressions, melodic hooks, sub/synth basslines, full drum patterns, and synchronized lyrics.

Rules for musical excellence:
1. Tempo & Bar Math: At BPM = ${targetBpm}, 1 bar of 4/4 is ${(240 / targetBpm).toFixed(3)} seconds. 1 beat is ${(60 / targetBpm).toFixed(3)} seconds.
2. Chord Progression: Use sophisticated 4-bar or 8-bar progressions (e.g. ii-V-I-vi, I-V-vi-IV, i-VI-III-VII, etc.) with lush extensions (7ths, 9ths).
3. Melody: Write an expressive, catchy melody that flows across the bars, aligned with chords. Use note names with octaves (e.g. "E4", "G4", "B4", "C5", "D5").
4. Bassline: Solid root notes with passing tones in octave 1 or 2 (e.g. "C2", "G1", "A1", "F1", "E2").
5. Drums: Continuous, tight drum beats throughout the duration:
   - Kick on beats 1 and 3 (with syncopations if groove requires).
   - Snare / Clap on beats 2 and 4.
   - Hi-Hats every 8th or 16th note with varying velocities for groove.
6. Ambient Pads: Sustained atmospheric chord pads holding for 2 to 4 bars.
7. Synchronized Lyrics: If lyrics are enabled, provide 4-8 evocative, poetic lyric lines with realistic start times and durations matching the song's phrasing.

Duration target: exactly ${duration} seconds.
Output MUST be strictly valid JSON matching this schema:
{
  "title": "Creative Song Title",
  "genre": "${targetGenre}",
  "mood": "${targetMood}",
  "bpm": ${targetBpm},
  "key": "${targetKey}",
  "timeSignature": "4/4",
  "duration": ${duration},
  "description": "Brief description of the musical style and groove",
  "chords": [
    { "chord": "Cmaj7", "root": "C", "type": "maj7", "notes": ["C3", "E3", "G3", "B3"], "startTime": 0.0, "duration": 4.0 }
  ],
  "melody": [
    { "note": "E4", "startTime": 0.5, "duration": 0.75, "velocity": 0.85, "instrument": "piano" }
  ],
  "bass": [
    { "note": "C2", "startTime": 0.0, "duration": 1.8, "velocity": 0.9, "style": "synth_bass" }
  ],
  "drums": [
    { "type": "kick", "startTime": 0.0, "velocity": 0.95 },
    { "type": "hihat", "startTime": 0.0, "velocity": 0.6 },
    { "type": "hihat", "startTime": 0.33, "velocity": 0.45 },
    { "type": "snare", "startTime": 0.67, "velocity": 0.9 }
  ],
  "pads": [
    { "notes": ["C3", "G3", "B3", "E4"], "startTime": 0.0, "duration": 4.0 }
  ],
  "lyrics": [
    { "text": "Walking down the neon street at night", "startTime": 2.0, "duration": 3.5 }
  ]
}`;

  const promptText = `Compose a complete ${duration}-second track based on this user prompt:
"${req.prompt || 'Dreamy chill lofi synth beat with warm keys and nostalgic groove'}"
Genre: ${targetGenre}
Mood: ${targetMood}
Key: ${targetKey}
BPM: ${targetBpm}
Include Lyrics: ${req.includeLyrics !== false ? 'YES' : 'NO'}

Generate a rich arrangement with at least 20-40 melody notes, comprehensive drum groove from second 0 to ${duration}, full chord progression, and bassline.`;

  // Candidate models with primary, fast fallback, and pro backup
  const modelCandidates = ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-2.5-pro'];
  let lastError: any = null;
  let parsed: any = null;
  let usedModel: string = 'gemini-2.5-flash';

  for (const modelName of modelCandidates) {
    try {
      console.log(`[Gemini Composer] Attempting composition with model "${modelName}"...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      });

      const responseText = response.text || '';
      if (responseText.trim()) {
        try {
          parsed = JSON.parse(responseText);
          usedModel = modelName;
          break; // Succeeded!
        } catch (err) {
          const clean = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(clean);
          usedModel = modelName;
          break; // Succeeded!
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini Composer] Model ${modelName} failed or unavailable:`, err?.message || err);
      lastError = err;
      // Continue to next candidate model
    }
  }

  // If all Gemini remote models are temporarily unavailable (e.g. 503 high demand spike),
  // seamlessly fall back to our procedural harmonic composition engine.
  if (!parsed || !parsed.chords) {
    console.warn(`[Gemini Composer] All remote Gemini model attempts failed (${lastError?.message || '503/429'}). Activating procedural musical composer fallback.`);
    return generateProceduralComposition(req);
  }

  // Post-process and enrich frequencies
  const processedChords: ChordEvent[] = (parsed.chords || []).map((c: any) => ({
    chord: c.chord || 'C',
    root: c.root || 'C',
    type: c.type || 'maj',
    notes: Array.isArray(c.notes) ? c.notes : ['C3', 'E3', 'G3'],
    freqs: (Array.isArray(c.notes) ? c.notes : ['C3', 'E3', 'G3']).map((n: string) => noteToFreq(n)),
    startTime: Number(c.startTime) || 0,
    duration: Number(c.duration) || 4
  }));

  const processedMelody: NoteEvent[] = (parsed.melody || []).map((m: any) => ({
    note: m.note || 'C4',
    freq: noteToFreq(m.note || 'C4'),
    startTime: Number(m.startTime) || 0,
    duration: Math.max(0.1, Number(m.duration) || 0.5),
    velocity: Math.min(1.0, Math.max(0.1, Number(m.velocity) || 0.8)),
    instrument: m.instrument || 'piano'
  }));

  const processedBass: BassEvent[] = (parsed.bass || []).map((b: any) => ({
    note: b.note || 'C2',
    freq: noteToFreq(b.note || 'C2'),
    startTime: Number(b.startTime) || 0,
    duration: Math.max(0.2, Number(b.duration) || 1.0),
    velocity: Math.min(1.0, Math.max(0.1, Number(b.velocity) || 0.85)),
    style: b.style || 'synth_bass'
  }));

  const processedDrums: DrumEvent[] = (parsed.drums || []).map((d: any) => ({
    type: d.type || 'kick',
    startTime: Number(d.startTime) || 0,
    velocity: Math.min(1.0, Math.max(0.1, Number(d.velocity) || 0.8))
  }));

  const processedPads: PadEvent[] = (parsed.pads || []).map((p: any) => ({
    notes: Array.isArray(p.notes) ? p.notes : ['C3', 'G3', 'C4'],
    freqs: (Array.isArray(p.notes) ? p.notes : ['C3', 'G3', 'C4']).map((n: string) => noteToFreq(n)),
    startTime: Number(p.startTime) || 0,
    duration: Number(p.duration) || 4
  }));

  const processedLyrics: LyricLinePlan[] = (parsed.lyrics || []).map((l: any) => ({
    text: String(l.text || '').trim(),
    startTime: Number(l.startTime) || 0,
    duration: Math.max(1.0, Number(l.duration) || 3.0)
  })).filter((l: LyricLinePlan) => l.text.length > 0);

  return {
    title: parsed.title || 'Joelizer AI Composition',
    artist: 'Joelizer AI Composer',
    genre: parsed.genre || targetGenre,
    mood: parsed.mood || targetMood,
    bpm: Number(parsed.bpm) || targetBpm,
    key: parsed.key || targetKey,
    timeSignature: parsed.timeSignature || '4/4',
    duration: duration,
    description: parsed.description || 'AI composed audio arrangement',
    chords: processedChords,
    melody: processedMelody,
    bass: processedBass,
    drums: processedDrums,
    pads: processedPads,
    lyrics: processedLyrics,
    source: usedModel as any
  };
}

