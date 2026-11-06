# Joelizer Music Studio — dedicated multitrack DAW

**Status:** A dedicated, integrated browser DAW using Joelizer's existing transport, editing and audio engine. This is a functional production foundation, not yet a complete replacement for FL Studio, GarageBand, or BandLab.

## Where it is

Open **Music Studio** in the top navigation, next to MV Studio and separate from **Audio Lab**. The shortcut is **5**. Audio Lab remains focused on mastering, A/B analysis and file provenance.

## Workflows

**1. Import and arrange professionally made sounds.** Use the left **Samples** browser to import local MP3, WAV, FLAC and other formats supported by the browser. You may select many files or drag them into the drop area. Preview them, filter by name, and click **+** to insert a sound at the playhead on its own audio track. Imported sounds retain the original waveform and dynamics; no synthetic replacement is forced.

**2. Make sample-based phonk drums.** Under **Drums**, assign your imported one-shot samples to Kick, Snare, Hat and Percussion, toggle steps in the 16-step pattern, and render 1, 2, 4 or 8 bars at the project's BPM. The rendered drum pattern appears as a clip on a DRUMS track, ready for arrangement, volume/pan/mute/solo and WAV bounce.

**3. Play samples chromatically.** The **Piano** tab has a 12-row chromatic piano-roll editor. Choose a sample, source root note and octave, enter notes, choose the bar count, then render the pitched pattern onto a SYNTH track. This is a sampler-based sequencer, rather than an external VST host.

**4. Experiment with original synthesis.** The **Synth** tab keeps the previous original oscillator-based phonk sound generator but clearly labels it experimental. Preview its renders, export its WAVs and insert the result onto a SYNTH track. For production-quality phonk sounds, use reputable licensed sample packs or recordings in the sample browser.

**5. Arrange, mix, record and export.** The existing DAW provides a multitrack timeline, split/trim/duplicate, drag clips, snap-to-grid, zoom, play/pause/seek, looping, microphone recording, track-level volume/pan/mute/solo, mixer panel, undo/redo, and WAV master bounce. The Music Studio top bar also supports exporting its mix into MV Studio.

**6. Save and reopen portable sessions.** Use **Mix → Save Portable Session ZIP + Audio** to download the arrangement and audio assets together. Use **Open Session** in the DAW toolbar to restore a ZIP. This is the recommended save format for locally imported audio; the older JSON export does not include its audio bytes.

## Important limitations

- **No VST/AU plugin hosting** is implemented: browsers cannot directly run desktop VST3/AU plugins like a desktop DAW.
- Browser audio files imported as local object URLs remain usable **in the current session**. Use **portable session ZIP** for reopenable sessions including audio assets. The separate existing project JSON export is reference-only; a cold reload of JSON alone may require reimporting local assets.
- The piano roll currently renders note grids into PCM audio clips; it is not a persistent MIDI editor or MIDI file importer.
- Drum-rack and piano-roll sample playback is offline-rendered, with no automatic time-stretching of source samples. Long sample tails can be truncated at pattern boundaries.
- The music studio's real-sample workflow is separate from Audio Lab's mastering and C2PA/provenance inspection.
- This is an incremental build toward professional-grade production. Low-latency plug-in instrumentation, full MIDI editing, automation curves, piano roll velocity and proper project asset packaging remain future work.

## Verification

- Existing TypeScript/build and audio export checks.
- New Music Studio browser smoke test imports a stereo WAV, creates a clip, renders a sample-based beat and renders a piano-roll phrase into editable DAW tracks.
- No change to the MV Studio video export engine.
