# YouTube Audio workspace

The **YouTube Audio** tab is next to **Audio Lab** in the top navigation. It
accepts standard YouTube, Shorts and YouTube Music **video** links, and offers
MP3 or uncompressed PCM WAV downloads plus a **Use in Joelizer** action.

Only convert content you own or are independently authorized to download and
convert. YouTube's terms and policies may restrict downloads even when a video
is publicly viewable. This tool does not bypass login, DRM, private videos,
account restrictions, or other access protections, and it does not use the
third-party MP3Juice conversion service.

## Deploying

This is an opt-in service on the **persistent Node render backend**, not a
standalone Vercel serverless function. Install up-to-date `yt-dlp` and `ffmpeg`
on the server, or use the updated `Dockerfile.render`, which installs both.

Set on the backend:

```env
YOUTUBE_AUDIO_IMPORT_ENABLED=true
YOUTUBE_AUDIO_IMPORT_TOKEN=<strong-secret>
RENDER_ALLOWED_ORIGINS=https://your-joelizer-frontend.example.com
```

Build the frontend with:

```env
VITE_RENDER_SERVER_URL=https://your-node-render-backend.example.com
```

Redeploy after setting the frontend build-time variable. Enter the same
private converter key in the UI when submitting a conversion; it stays only
in component memory, not in localStorage. Protect the service at the network
or gateway layer as well, and keep the token secret. CORS alone is not
authentication.

The endpoint enforces one conversion at a time, up to 15 minutes of video,
250 MiB of output and a 3-minute processing timeout. It downloads into a
unique temporary directory, sends the file once, and deletes the temporary
files. Extraction can still fail due to changes at YouTube, expired sources,
network restrictions, or unavailable format streams. The UI reports such
errors rather than returning a broken or empty download.

**Audio quality:** WAV is uncompressed PCM of the decoded source, not an
enhancement of a lossy YouTube stream. MP3 is encoded at up to 320 kbps. For
your own released songs, the original WAV master remains the preferred source.
