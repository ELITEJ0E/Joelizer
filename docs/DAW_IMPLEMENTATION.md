# Music Studio arrangement and mix workflow

Implemented on `feat/studio-arrangement-workflow`, based on `main` commit `b538845`. Research and verification date: 6 November 2026.

This iteration adds original arrangement, clip inspection, EQ and responsive editing workflows. It does not claim feature parity with mature desktop DAWs. [Public research and vendor references](DAW_PUBLIC_RESEARCH.md) distinguish documented capabilities from observations.

## What changed

| Area | Delivered behavior |
| --- | --- |
| Song sections | Add named, colored markers at the snapped playhead; rename, recolor and change exact seconds; seek by marker; previous/next navigation; loop a marker through the next marker or arrangement end. Markers survive local storage, JSON and portable session ZIPs. |
| Clip inspector | Rename; exact start, source in and duration; gain 0–150%; fade in/out in seconds; mute; move to another track; duplicate; split at playhead; loop selected clip. |
| Repeat | Add 1, 3, 7, 15 or 31 adjacent copies in one undoable operation. Source audio is shared, and portable archives deduplicate it. |
| Track EQ | Original fixed three-band EQ: 120 Hz low shelf, 1 kHz peak (Q 0.7), 6 kHz high shelf; each −12 to +12 dB; bypass and reset. Same processing in real-time playback and WAV mixdown. |
| Audio integrity | Master gain is honored before audio initialization and by exports. Clip gains and fades agree between playback and bounce. Seeking into a fade uses its actual gain. Splits preserve the original envelope, including cuts inside fades and repeated splits. Pending asynchronous decodes cannot restart stale clips after a transport change. Loop restarts use current track settings. The separate song player stays paused while Music Studio owns playback and its clock, preventing doubled audio; leaving Music Studio pauses its transport. |
| Editing | Correct musical snap fractions from 1/1 through 1/32, plus off; grids and bars honor 4/4, 3/4 and 6/8. Pointer capture supports mouse/touch clip movement and trimming; source bounds prevent negative/revealed past-end audio. Each gesture adds one undo step. |
| Navigation and rendering | Scrolled ruler seeking counts scroll once; ruler and clips support keyboard navigation; track-header and lane vertical scrolling stay aligned. Music Studio owns Space and marker shortcuts; focused selects retain native keys, and browser media controls route to its transport/markers. Ruler canvas allocation follows the visible viewport, and waveform canvas resolution is bounded. Trimmed waveforms and split fade shading use their actual source/envelope positions. |
| History and restore | Marker/clip/EQ history capped at 100 snapshots; reset and restored history avoid empty undo entries. Explicit track selection clears stale clip selection so the inspector edits the intended track. Session restore preloads source lengths and refreshes derived peaks without adding an undo step. |
| UI | Consistent inspector fields and controls, collapsible library/inspector, mutually exclusive full-width panels on phones, accessible labels/focus indicators and reduced-motion support. Tempo, key, meter, transport and snap controls remain accessible on phones. Notices dismiss automatically and stay below the toolbar. |
| Portability and maintenance | Existing portable ZIP format retains markers, EQ and split-envelope metadata; Blob handling works in browsers and Node. Repaired the stale dependency lockfile and added DAW checks to the existing CI workflow. Fixed an existing MV preview boolean/object error that blocked TypeScript and video framing updates. |

The existing sample library, sample drums, basic piano grid, original synth, microphone recording, mixer and portable session feature were already present; they are not counted as new features.

## How to use it

Open **Music Studio**. Import your audio with **Library**, select a clip and open **Inspector**. Place the playhead and press **M** to add song markers. Click a marker to seek and expose its name/time/color controls. **Loop section** cycles through the next marker. **Loop clip** cycles the selected clip. Export with **Mix → Bounce Master WAV**, or preserve editable audio and metadata with **Save Portable Session ZIP + Audio**.

| Shortcut | Action |
| --- | --- |
| Space | Play/pause when focus is on the workspace; focused buttons keep their native keyboard behavior |
| R | Start/stop recording |
| S | Split selected clip at playhead |
| M | Add marker |
| L | Loop selected clip |
| Shift + Left/Right | Previous/next marker |
| Ctrl/Cmd + D | Duplicate selected clip |
| Ctrl/Cmd + Z; Ctrl/Cmd + Shift + Z or Ctrl + Y | Undo; redo |
| Delete/Backspace | Delete selected clip |
| V; E | Select; erase tool |
| Left/Right with clip focused | Nudge by chosen grid, or 0.1 seconds with grid off; Shift multiplies step by four |
| Home/End with ruler focused | Seek to project start/end |

Typing in inputs does not trigger DAW shortcuts. Fades on split pieces retain the original amplitude envelope; explicitly changing a piece's fade controls creates a new envelope for that piece. Extending a split piece outside its original envelope also creates a local fade envelope.

## Verification

Local checks passed on Windows with Node 24.20 and installed Google Chrome:

- `npm run lint` and `npm run build`.
- `npm test`: existing production audit, 22 passed and 0 failed.
- `npm run test:daw:unit`: meter/snap math, marker validation, non-destructive clip normalization, fade/envelope boundaries and seeks, repeated splits, portable ZIP deduplication/audio-byte integrity/path rejection and metadata retention.
- `dawAudioEngine.browser.test.ts`: real Web Audio PCM measurements for master/clip gain, track and clip mute, solo exclusion, all three EQ bands and bypass, fades, seeking into a release, initial master gain, live parameter changes and stale decode cancellation. Split-versus-unsplit PCM regression cuts at 0.03, 0.25 and 0.47 seconds of a 0.5-second clip with 0.1-second fades.
- `dawArrangement.browser.test.ts`: actual sample import, markers/history/navigation, inspector fields, repeat as one undo, EQ/bypass, portable session reopen, pointer snap divisions/off, safe trims, scrolled ruler seek and keyboard editing. Responsive assertions and screenshots at 1440×900, 768×1024 and 390×844, with no unhandled page errors.
- Existing `musicStudio.browser.test.ts`: sample import, sample drums, piano grid render and original synth insertion.
- Targeted arrangement browser checks verify split fade shading and transport ownership with an actual loaded song: Space/button behavior, the separate player's paused state, clock agreement, marker shortcuts, native select keys and leaving the studio.
- `npm ci --ignore-scripts --dry-run --no-audit --no-fund` validates the repaired lockfile; `git diff --check` passes.

The production build still reports a large shared bundle and an existing mixed static/dynamic import warning. Full real-device touch, screen-reader, microphone/driver latency and very large-project performance evaluations remain outside this verification boundary. Existing video-export CI is retained; this change does not claim a complete local rerun of every video/codec stress test.

## REA and investigation boundary

The requested `reverse-engineer-anything` skill was already installed at version 37 and aligned with `rea-agents` 6.4.0. A scoped setup repaired the Codex registration in `C:\Users\benjo\.codex\config.toml`, with `config.toml.rea.backup`; unrelated registrations and native engines were not changed. The active MCP server subsequently reported package 6.4.0 and alignment `aligned` via `binary_session`.

Public browser access to the supplied BandLab project redirects to `accounts.bandlab.com/login`. A REA CLI capture in a fresh temporary profile independently retained that redirect in partial observation, but returned `cleanup_incomplete`/`unreadable_output`; it is not a successful complete capture and supplied no complete analysis Evidence ID. A later scoped check found no remaining REA-owned Chrome processes or `rea-browser-scenario-*` temporary directories. No authenticated project data, third-party application code, proprietary assets or samples were acquired. The feature comparison relies on the public vendor documentation linked in the research report. Joelizer itself was inspected through its public source, following REA's guidance to use ordinary source tools for repository analysis.

## What remains

- Persistent editable MIDI clips, MIDI file interchange, live MIDI input, note velocity/duration editing, quantize/humanize/legato transforms.
- Automation lanes/recording/curves, tempo maps, time stretching and pitch-preserving transposition.
- Metronome/count-in, punch recording, take lanes/comping and recording latency calibration.
- Sends/returns, buses, sidechain routing, flexible effect chains and native VST/AU hosting (requires separate architecture).
- Cloud collaboration, account/version history, robust autosave/recovery of local audio across cold reloads. Use portable ZIPs for local audio; JSON/local-storage references alone do not embed those bytes.
- Gapless audio-clock loop scheduling and scalable scheduling for very large projects; current loop boundaries still use the pre-existing animation-frame transport mechanism.
- Broader accessibility and performance measurement on real mobile hardware and audio devices.

No merge or production deployment is included. The feature branch and PR provide the reviewable deliverable.
