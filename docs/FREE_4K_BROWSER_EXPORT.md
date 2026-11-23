# Free 1440p and 4K exports

Joelizer's regular website stays at https://joelizer.vercel.app. You do **not** need to
deploy a paid Render service to try high-resolution video exports.

## Free local browser export (experimental)

1. Open Joelizer in the latest Chrome or Edge on a desktop/laptop.
2. Open Lyrics Video or Music Video > Export > Video.
3. Select **1440p Maximum** or **4K Maximum**. When WebCodecs is available,
   the option is labelled **free browser · beta**.
4. Start with 30 FPS and a **5–10-second range** to test your computer.
5. Keep the browser tab open and visible until encoding finishes.
6. Download the MP4. Joelizer uses the chosen dimensions or reports a failure;
   it does not quietly export a smaller file in Maximum Detail mode.

This method renders all frames and muxes H.264/AAC locally. It does not use
a paid API or free-tier cloud quota. Your computer supplies the CPU, GPU,
memory and electricity. Hardware capable of 1080p does **not** necessarily
support 4K H.264 encoding. A successful codec support probe also cannot
guarantee sufficient memory for a long 4K project. A full-length music video,
especially 4K/60, may be impractical on integrated graphics.

The export settings panel now checks the H.264 encoder's support at the exact
resolution, orientation and frame rate. A positive probe means the encoder
reports that configuration as supported, not that long 4K projects are guaranteed
to fit in GPU and system memory.

If there is no browser VideoEncoder, or your GPU cannot encode the requested
resolution/frame rate, the app will explain the issue and fail without
mislabeling a 1080p file as 4K. Try 1440p/30 or a dedicated render machine.

### Important quality note

Output dimensions are distinct from image reconstruction. Upscaling a 720p
source by rendering to 4K does not create genuine missing source detail.
MP4 H.264/AAC is high-quality **lossy** compression, not bit-exact preservation.

## Optional Render backend for unattended exports

The supplied `Dockerfile.render` launches the persistent Remotion/FFmpeg backend.
The publicly hosted Vercel serverless API cannot run these long background jobs.
No Render service is created by committing backend code.

To connect an independently hosted Node service:

1. Deploy `Dockerfile.render` on an appropriately sized machine/service.
2. On that service, set `RENDER_ALLOWED_ORIGINS=https://joelizer.vercel.app`.
3. On Vercel, set `VITE_RENDER_SERVER_URL=https://YOUR-SERVICE.onrender.com`
   as a **build-time** environment variable and redeploy the frontend.
4. Test `https://YOUR-SERVICE.onrender.com/api/health`. The persistent
   Node service should respond with `"hasRemotion":true`.
5. If both engines are connected, choose **Remotion server** in the
   high-resolution export settings.

CORS is **not authentication**. Before exposing cloud rendering to untrusted
users, implement authentication, upload quotas, job limits and storage cleanup.

Render's free web instance currently provides 512 MB RAM and no persistent disk.
It is not a reliable choice for 4K Chrome/Remotion rendering. See
https://render.com/docs/free and https://render.com/pricing.
