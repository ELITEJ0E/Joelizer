# Public DAW workflow research

Research date: 6 November 2026. This is a bounded comparison of public, official documentation, not an exhaustive inventory or an assertion of feature parity. No proprietary code, assets, sample libraries, or authenticated content were acquired.

## Evidence and access boundaries

- The requested [BandLab project URL](https://www.bandlab.com/studio?id=8a47decd-13f3-4b0b-8c7c-641689824257&triggered_from=revision_page) could not be opened by the public web research tool. A subsequent browser visit observed a redirect to `accounts.bandlab.com/login`. Its project contents and behavior remain unknown; the login boundary was respected. Nothing in this report claims runtime observation of the project editor.
- The comparisons below are **documented capabilities**, not reverse-engineered implementation details. Sources were retrieved from vendors' public manuals/help centers. Selected products represent different established workflows; no popularity ranking was measured.
- The Joelizer baseline below comes from the checked-out source and its existing documentation. Proposed features are original design recommendations, not observations about completed implementation.

## Documented comparison

| Product | Publicly documented capabilities relevant to this iteration | Design implication for Joelizer |
| --- | --- | --- |
| BandLab Studio | MIDI note quantize, humanize and legato; drum patterns with swing and velocity; breakpoint automation for volume, pan and effects. | Make musical timing and expression editable, with discoverable controls and reversible operations. |
| Ableton Live | Arrangement locators, loop start/length, loop selection, resizable/movable clips; MIDI transforms, editable note velocity and quantization amount. | Provide fast section navigation and explicit musical-time editing rather than relying only on dragging. |
| Logic Pro | Region move/resize/loop; named arrangement markers and marker navigation; step parameters including velocity, pitch and gate time. | Support meaningful song sections, precise clip inspection and expressive patterns. |
| FL Studio | Pattern, audio and automation clips in the Playlist; time markers; piano-roll quantize, articulation and note utilities. | Offer a coherent arrangement workflow and useful note transformations with clear scope. |
| REAPER | Flexible audio/MIDI arranging, snap, fades and crossfades; track/item automation; named/colorable project regions and markers. | Keep editing predictable and reversible, and preserve session metadata together with assets. |

### Sources

**BandLab:** [Editing MIDI Regions](https://help.bandlab.com/hc/en-us/articles/360022659314-Editing-MIDI-Regions), [Using the Drum Machine](https://help.bandlab.com/hc/en-us/articles/115002959894-Using-the-Drum-Machine), [Using Automation](https://help.bandlab.com/hc/en-us/articles/360021039314-Using-Automation), [Studio Keyboard Shortcuts](https://help.bandlab.com/hc/en-us/articles/360021363353-Studio-Keyboard-Shortcuts).

**Ableton:** [Arrangement View](https://www.ableton.com/en/live-manual/12/arrangement-view/), [Editing MIDI](https://www.ableton.com/en/live-manual/12/editing-midi/).

**Apple:** [Get started arranging regions](https://support.apple.com/guide/logicpro/arranging-regions-lgcp4d686a1a/10.7/mac/11.0), [Add arrangement markers](https://support.apple.com/en-lamr/guide/logicpro/lgcpb9f20ee5/mac), [Navigate using markers](https://support.apple.com/en-ae/guide/logicpro/lgcpa855b268/mac), [Step Sequencer overview](https://support.apple.com/en-ie/guide/logicpro/lgcp39acefc9/10.7/mac/11.0).

**Image-Line:** [Playlist](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist.htm), [Piano roll menu](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_menu.htm), [Automation Clips](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist_automationclip.htm).

**Cockos:** [REAPER overview](https://www.reaper.fm/about.php), [REAPER User Guide, sections 9.5–9.8 and Region/Marker Manager](https://dlx.reaper.fm/userguide/).

## Joelizer baseline observed in source

At the initial inspection, `docs/MUSIC_STUDIO_DAW.md` and the DAW components described/provided sample import and preview, a sample-based drum sequencer, a twelve-row/sixteen-step piano grid rendered to PCM, an experimental original synthesizer, multitrack arranging, split/trim/duplicate, snap, transport/looping, recording, mixer controls, undo/redo and portable session ZIPs. Those existing features must not be reported as newly implemented by this iteration.

The initial piano-roll implementation stored binary cells in local component state and rendered each note with a fixed short gate and gain. This establishes a concrete opportunity for note duration, velocity and reusable pattern data. It does not establish the behavior of the entire application.

## Recommended original implementation priorities

1. **Arrangement navigation and inspection:** named markers, seek-to-marker, precise clip start/duration/gain/fade controls and loop-selection actions. Changes should survive project/session export and import where relevant, and participate in meaningful undo/redo.
2. **Expressive note editing:** explicit note events with duration and velocity, selection-scoped quantize/transpose/legato, and bounded humanization. Retain editable note data rather than only a rendered waveform. Validate pitch/time boundaries, overlapping notes and empty selections.
3. **Responsive studio ergonomics:** consistent spacing and hierarchy, readable numeric fields, accessible control labels, keyboard focus, collapsible panels on small screens, horizontal scrolling within editors and reduced-motion support.
4. **Audio integrity and portability:** maintain agreement between real-time playback and exported audio, package newly introduced metadata with sessions, and test round trips and failure cases.

These are recommendations, not a claim that all four groups were implemented. The implementation report and PR should identify the exact delivered subset and test results.

## Explicit remaining scope

A substantial browser-DAW iteration does not imply parity with these mature applications. Broader work includes persistent MIDI clips and file interchange, live MIDI input, automation recording/curves, time-stretching and tempo maps, take comping, advanced routing and sends, full effects/instrument hosting, collaboration/version history, session recovery at scale and comprehensive accessibility/audio-performance evaluation. Native VST/AU compatibility requires a separate architecture and cannot be assumed from a browser UI.
