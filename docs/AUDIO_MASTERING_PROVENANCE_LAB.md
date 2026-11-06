# Joelizer Audio Mastering & Provenance Lab

**Purpose:** Improve and compare recordings while reporting what can, and cannot, be determined about content provenance. This feature does **not** promise that AI-produced audio can be made undetectable, erase all watermarks, or turn AI-generated audio into human-authored audio.

## Access

Select **Audio Lab** in Joelizer's main studio navigation, immediately beside **MV Studio**, or use the Playlist → Audio Lab shortcut. Audio Lab now fills the workspace beneath the top bar, with keyboard shortcut **4**. The Playlist shortcut still opens it as a modal. Other studios and their video export behavior are unchanged. Import a local original WAV/MP3/M4A/FLAC/Ogg file or select the currently imported Joelizer track. Import a second, already-mastered recording for side-by-side analysis. All decoding, processing, and metrics run in the browser; no recording is sent automatically to a third-party service.

## Available in this version

- A/B monitoring with synchronized playback position, attenuation-only RMS matching, and clear warnings when song lengths do not match.
- Objective audio statistics: duration, sample rate, channel count, sample peak (dBFS), RMS (dBFS), crest factor, fraction of near-clipped samples, DC offset, stereo correlation, normalized waveform envelopes, relative frequency-band energy.
- Local signal chain using Web Audio OfflineAudioContext: sub-bass high pass, low-shelf, presence bell, air shelf, optional compressor, RMS target and sample-peak ceiling. Balanced, warm, bright and transparent presets. No alteration to the source file.
- Adjustable original/processed parallel blend (0–100%) to preserve transients, plus post-render warnings for unmet RMS targets, clipping and low stereo correlation. These are sound-quality controls, not AI-authorship detection adjustments.
- Downloadable 16-bit and 24-bit PCM WAV with TPDF dither. Output has a Joelizer software identification tag. Users may explicitly add the rendered WAV as a new Joelizer playlist track.
- SHA-256 file checksum (exact file identity, **not** an acoustic fingerprint), limited local inspection for readable provenance/encoder strings, and a downloadable JSON technical report with an optional *user-declared*, unverified source category.
- A link to Suno's official Content Credentials detector. The user decides whether to upload a file on the external service.

## Provenance and fingerprint scope

| Signal | Meaning | Lab v1 | Limit |
| --- | --- | --- | --- |
| File bytes (SHA-256) | Exact identity of a file | Local on demand | Altering a single byte changes the checksum; not an acoustic fingerprint |
| Readable metadata markers | Possible C2PA/encoder/provider text in scanned areas | Local sampled text | Does not parse or verify signed C2PA metadata; absence proves nothing |
| Suno C2PA credentials | Provider-signed provenance | External official checker link | No automatic upload or backend proxy |
| Audio watermarks (including proprietary detectors) | Inaudible signal embedded in audio | Not supported | Cannot be reliably assessed without authorized detector or published specification |
| Content-based acoustic fingerprints | Sound-derived matching signatures | Not supported | Fingerprints are generated from audio, not necessarily embedded in a file |
| SubmitHub AI checker | Model-predicted spectral and temporal AI likelihood | Not integrated | Closed proprietary model; cannot infer its probabilities from RMS or spectral comparison |
| Spectral/time-domain audio quality | Tonal balance, dynamics, waveform envelope | Local measurement | Useful for mastering, **not** proof of human origin |

No universal watermark or AI-detector evasion algorithm is provided. Processor output preserves no authenticated C2PA chain: transcoding and mastering can invalidate signed file-level credentials. Keep the original and technical report, and accurately declare the origin when distributing recordings.

## Honest DSP measurement labels

- RMS dBFS is not an EBU R128 integrated LUFS measurement.
- Sample-peak limiting is **not** intersample true-peak limiting. Use an external true-peak meter for release-critical masters.
- The spectrum is a normalized average FFT profile, not a validated authenticity classifier.
- Correlation is computed over coarse whole-song waveform envelopes, not robust fingerprint matching.
- When original and processed durations differ, mastering-only comparisons are not controlled experiments.
- Browser memory and supported codecs limit maximum file size and sampling capabilities; input is capped at 512 MB in the UI.

## Verification

- Unit regression tests for sine-wave amplitude statistics, PCM WAV bit depth and length, provenance marker disclaimers, and waveform comparisons.
- Browser smoke test loads a synthetic stereo WAV, renders a local master, downloads a WAV, computes SHA-256 and closes the UI.
- Existing video-export pipeline and rendering source files remain untouched.

## Potential follow-up improvements

1. Exact EBU R128 integrated LUFS and oversampled true-peak metering, with per-platform *quality* delivery presets.
2. User-consented standards-based C2PA signature verification via a maintained verifier library; distinguish absent, valid, trusted, invalid and inconclusive.
3. Optional provider-specific watermark checks **only** through documented authorized verification endpoints, with clear per-provider scope and privacy consent.
4. Fine-grained stem quality evaluation, audible artifact auditing and noise-reduction tools designed for sound quality, not provenance concealment.
5. Move waveform FFT processing to a Web Worker / chunked analysis to reduce UI blocking for long recordings.
6. Export provenance manifests with stable project identifiers, explicit origin declarations and change history.

Useful references:
- Suno Content Credentials: https://suno.com/suno-credentials
- SubmitHub on AI detection: https://www.submithub.com/help/pdw3RrHXL5MjTNqBa
- C2PA specification: https://c2pa.org/specifications/
