# Background-safe, high-quality export setup

## Why focus-independent export needs a render server
Browser `MediaRecorder(canvas.captureStream())` relies on `requestAnimationFrame`
and live playback. Browser engines can throttle or suspend it when you change
tabs or minimize windows. Increasing 60 FPS or bitrate does not fix that.

For **final releases**, choose **Server Remotion** in Joelizer. A persistent
Node/Remotion/FFmpeg service renders each timeline frame deterministically
and encodes MP4 independently of the browser. Once the job starts, you may
use other windows without changing the final frame cadence. The progress
poller can pause when the tab is inactive; this does not pause the server
job. The tab/browser must remain accessible to retrieve the result.

## Free 1440p and 4K exports on joelizer.vercel.app

The web app includes a **free, on-device WebCodecs MP4 rendering path**.
There is no need to register with Render, deploy a separate server or pay an
encoding API when Chrome/Edge can encode the chosen resolution.

1. Open Joelizer in the newest desktop Chrome or Edge and enable browser
   hardware acceleration when available.
2. Open **Export → Video quality** and choose **1440p Maximum** or **4K Maximum**.
3. Choose **30 FPS** first, especially on integrated graphics.
4. Joelizer checks your browser's H.264 encoder for the exact resolution and
   frame rate. If supported, it renders frames locally through WebCodecs.
5. **Keep the tab open**. Rendering a full-length 4K video is demanding and
   consumes local RAM/disk/CPU/GPU; try a 5–10 second range before a long export.
6. Download the resulting MP4. Maximum quality never silently shrinks
   the resolution. An unsupported codec fails with an explanation.

The "server" path below remains optional. Remotion is better for long renders,
machines with weak GPUs, or leaving the tab minimized. Do not conflate output
dimensions with AI upscaling: 1080p source video inside a 4K composition is
still missing the source detail that was never recorded.

## Deploy the dedicated backend (optional; not required for free browser export)
This is **separate** from Vercel. Vercel's /api/health correctly returns
`hasRemotion:false`: its serverless functions do not run this persistent
job queue or store large assets. The server must have sufficient disk,
FFmpeg, Chrome/Chromium dependencies, and RAM (at least 2–4 GB recommended).

**Render's Free web service is not a reliable 4K renderer:** it has 512 MB RAM,
0.1 CPU, and no persistent disk, and it spins down after idle time. This code
does not provision a Render account or service. If you already use a paid or
self-hosted persistent renderer, connect it using the steps below.

1. Build the supplied `Dockerfile.render` on a persistent container platform
   (Render, Railway, Fly.io, a VM, or your own machine).
2. Mount persistent storage at `/data`. Never use ephemeral-only disk for
   project assets, export videos or post-render download links.
3. Configure `RENDER_ALLOWED_ORIGINS=https://YOUR-VERCEL-APP.vercel.app`
   (comma-separated if multiple frontend domains are used). Set
   `PORT` only if your hosting platform requires it.
4. Configure the Vercel frontend **build-time** environment variable:
   `VITE_RENDER_SERVER_URL=https://YOUR-RENDER-SERVICE.example.com`
   (HTTPS origin only, no trailing path or slash). Redeploy the frontend
   so Vite can embed this setting in the bundle.
5. Open Joelizer → Export → Server Remotion. The indicator should report
   the server online. Check `/api/health` on the render service returns
   `"hasRemotion": true`. Run the real 10-second render health test.

If hosting the entire app on Node rather than Vercel, no
`VITE_RENDER_SERVER_URL` is needed because the same-origin server
provides the renderer.

### Security and resource requirements
- CORS `RENDER_ALLOWED_ORIGINS` is **not authentication**. Protect the
  rendering service using a gateway, network policy, authentication, and
  upload/job limits before exposing a costly public rendering endpoint.
- The current job registry is in memory; run one instance or add a proper
  durable queue for scale/restarts. Persistent disk does not preserve job
  progress across a process restart.
- A browser upload must finish before the job can start, so do not close
  the tab during staging. Once rendering begins, switching windows is fine.
- Avoid cross-domain clips that reject server fetches; upload local files.
- Long 1080p/60fps projects require substantial CPU, RAM and storage.

## Quality targets
- **1080p, 60 FPS** for genuinely 60fps input or smoother rendered
  text/animation (60fps does not synthesize extra motion from 30fps source).
- H.264 CRF 16, `x264Preset: slow`, `yuv420p`, BT.709, fast-start MP4.
- AAC 320 kbps, 48 kHz where an audio track is provided.
- For drafts, use 360p or 720p / 30 FPS to save rendering time.
- Final release: verify that the downloaded MP4 plays fully with
  continuous motion and synchronized audio, not merely that a file exists.

## Foreground-only browser fallback
Browser export is explicitly not background-safe. Keep its tab visible
throughout. It now reports a failure if the tab is hidden instead of
telling you a corrupted/frozen export completed successfully. It outputs
a browser-supported format, which is usually WebM and is not guaranteed
to be MP4. For a reliable MP4, use Server Remotion.

## Smoke tests
`npm run lint`
`npm run build`
`npx tsx src/tests/browserExportClock.test.ts`
`npx tsx src/tests/videoExportSmoke.test.ts`
The last test needs FFmpeg, a Chrome headless shell, and its test fixtures
in `public/staged` (see GitHub Actions workflow).
