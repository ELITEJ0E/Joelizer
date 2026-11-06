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

## Professional workflow upgrade (November 2026)

Music Studio now has a dedicated two-level transport and editing toolbar, with its project title, play/stop/record/loop controls, tempo, key, time signature, snapping, zoom, undo/redo, track creation, 24-bit WAV export and portable project save/open. The sample browser can be resized or hidden without losing imported samples. Use the **Inspector** toggle to edit selected channel levels, pan, EQ and compression or selected clip position, trim length, fades and volume. The **Mixer** toggle opens clear channel strips and a master output meter. **Fit** changes the timeline zoom to an arrangement overview.

**Real effects**: the three-band low/mid/high EQ and compressor in each channel run in both live Web Audio playback and offline mixdown. Clip fade-in, fade-out and gain are likewise applied in both. The master volume is reflected in the WAV bounce, which uses 24-bit stereo PCM with a -1 dBFS sample-peak safety ceiling. These are sample-peak controls, not oversampled true-peak limiting or LUFS mastering.

**Performance and navigation**: the visible time ruler is rendered on a viewport-sized canvas instead of allocating canvases thousands of pixels wide. Track headers stay synchronized when scrolling vertically; a lower default zoom and **Fit** improve long-song navigation. Clip drag and trim now preview locally and commit once at pointer release, reducing costly store updates and undo history churn. The transport reports UI time about 30 times per second while Web Audio handles sample-clock playback.

**Shortcuts**: Space play/pause, R record, V select, E erase, S split, B browser, I inspector, M mixer, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+D duplicate clip, left/right arrows seek a beat and brackets set loop boundaries. Shortcuts don't override focused text fields or buttons.

**Browser validation**: imports files into editable clips; exercises the sample drum rack, sampler piano roll, experimental synth, channel FX, panel toggles and short song 24-bit mixdown. Music Studio saves portable ZIP sessions containing audio data.

**Current limitations**: this is a browser-based DAW, not a fully-featured desktop VST host. Advanced MIDI editing, persistent editable MIDI instruments, plugin hosting, automation lanes, time-stretch algorithms, full sends/buses, sidechain routing, oversampled limiting and a curated pro sample library are not implemented. The experimental procedural phonk synth is not the recommended route to polished commercial phonk; use quality recordings or licensed samples in the sampler/drum rack.

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
