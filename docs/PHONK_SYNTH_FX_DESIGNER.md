# Joelizer Phonk Synth & FX Designer

The Phonk Synth & FX Designer is part of the **Audio Lab** workspace (beside MV Studio). Select **Phonk Synth & FX Designer** inside Audio Lab to switch between the existing Mastering & Comparison workstation and the new original sound generator.

## Sound designer

Choose Drift, Brazilian or Dark Phonk. The generator provides nine standalone sound categories:

| Sound | Synthesized structure |
| --- | --- |
| 808 Cowbell | Two inharmonic, pitched metallic oscillators with pitch envelope |
| Screaming Lead | Saw/FM-style harmonic lead, detuning and drive |
| Sliding 808 | Low-frequency oscillator, glide and harmonics |
| Riser / Sweep | Rising oscillator pitch, filtered noise and tension |
| Impact / Drop | Rapid low-frequency transient and bright noise burst |
| Dark Atmosphere | Moving multi-oscillator pad with atmospheric textures |
| Hard Kick | Descending low-frequency pitch and short click transient |
| Clap / Snare | Noise-based transient and tuned body |
| Hi-Hat | Short, metallic noise percussion |

Edit pitch, sound length, distortion/drive, brightness/tone, glide, echo/space, and seed variation. Use **Generate sound** then **Play preview**, **Download 24-bit WAV**, or **Add to Joelizer playlist**. Nothing plays until manually requested.

## 16-step beat maker

Switch to **16-step beat maker**, choose your style preset, then edit Kick, Snare, Hat and Cowbell lanes. Set BPM (60–220) and loop length (1, 2, 4, or 8 bars), press **Generate beat loop**, and preview/download the stereo WAV. Beats are synthesized locally and normalized to a maximum sample peak of -1 dBFS. The loop end is musically aligned to a bar; the next bar is not automatically blended into its tail.

Generated WAVs can also be inserted as new playlist tracks for use in Joelizer's existing music and video workflows.

## Architecture

- Pure, deterministic signal functions in src/lib/phonkSynthEngine.ts with no external samples, network requests or VST dependencies.
- React editing UI in src/components/Audio/PhonkSynthDesigner.tsx.
- Existing encodeLabWav generates the 24-bit stereo PCM file, and a new dedicated object URL preserves audio when adding it to the playlist.
- Browser playback requires a user gesture, and temporary preview URLs are revoked when the generator unmounts.
- Run npx tsx src/tests/phonkSynthEngine.test.ts for synthesis/peak/timing unit checks; the existing audioMasteringLab.browser.test.ts also checks the new UI and exports.

The generated effects are original synthesis, not copies of third-party sample packs. If users import existing material elsewhere in Joelizer, licensing remains their responsibility. Phonk style presets refer to general genre conventions rather than any particular artist's recordings.
