# Frame-accurate browser MP4 export

Joelizer now includes an **Offline MP4** engine separate from the legacy
**Fast Browser** recorder. It does not need a Node render service.

## How it works
- For each output frame, calculate exact project time:
  `exportRange.start + frameIndex / fps`.
- Decode trimmed source video at that timestamp before drawing.
- Draw the frame to a dedicated canvas (not the live preview canvas).
- H.264 WebCodecs encodes a `VideoFrame` with a timestamp derived from the
  frame index. It can take longer than real time without losing frames.
- The soundtrack is decoded, trimmed to the same range, resampled to 48 kHz,
  encoded with AAC if supported, then multiplexed into a real MP4.
- Frame count is checked before download. Incomplete output is rejected.

## Selecting the renderer
Export → **Offline MP4** (when enabled). Select 30 or 60 FPS based on source
quality, available hardware and file size. 60 FPS does not invent new source
video motion from 30 FPS footage. The browser must support H.264
`VideoEncoder`, `AudioEncoder` AAC for exports with soundtrack, and Web Audio.
Codec availability varies by browser and operating system.

**Fast Browser** remains available for browsers without required WebCodecs
support. It is a real-time capture, may drop frames under load, and can be
interrupted by tab backgrounding. **Server Remotion** remains the most
feature-complete path when connected.

## Known differences
- Source clips are decoded by seeking a media element per frame, which is
  deterministic but can be slow for long-GOP footage and long songs.
- Advanced preview-only overlays/effects and visualizer behavior may not be
  pixel-for-pixel equivalent yet; compare a short section before release.
- Visualizer FFT comes from decoded project audio instead of the live analyser.
- Browser memory is used for the final MP4 in the current implementation.
  Very long/high-bitrate projects may require server export.
- Network video/image/audio sources must permit browser CORS access.
- An inactive browser tab may delay decoding, but cannot change the encoded
  timestamps. Keep the browser open until the MP4 is ready.
- Offline export preserves the intended timestamps but cannot repair
  stuttering already present in the original uploaded source footage.

## Verification
The CI workflow checks lint/build, original Remotion 30/60fps exports,
and a separate Chrome WebCodecs smoke test for clips and lyrics where the
runtime provides an H.264 encoder. A test on your actual media and browser
is still recommended.
