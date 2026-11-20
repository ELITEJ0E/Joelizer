# Joelizer local YouTube converter (Windows)

The **Local · This computer** option uses a small server running on your own PC instead of Render. It is optional; **Cloud · Render** remains available. Only convert videos you own or have permission from the rights holder and platform to download.

## One-time setup

1. Install **Node.js 22+**, **yt-dlp**, and **FFmpeg**. On Windows, you can use the official installers or run these commands in PowerShell with Windows Package Manager:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install yt-dlp.yt-dlp
   winget install Gyan.FFmpeg
   ```

2. Close and reopen PowerShell so the tools are on your PATH. Check with:

   ```powershell
   node --version
   yt-dlp --version
   ffmpeg -version
   ```

3. Download or clone [Joelizer](https://github.com/ELITEJ0E/Joelizer). In PowerShell, navigate to the folder containing `scripts/local-youtube-converter.mjs` and start it:

   ```powershell
   node scripts/local-youtube-converter.mjs
   ```

4. Keep that window open. Open [joelizer.vercel.app](https://joelizer.vercel.app/), choose **YouTube Audio → Converter → Local · This computer**, enter an authorized video URL, and convert.

The helper listens **only** on `127.0.0.1:39847` and accepts browser requests from `https://joelizer.vercel.app` and local development origins. It does not use or need the Render access key. Stop it with Ctrl+C.

## Troubleshooting

- **Cannot reach local converter:** Check that the helper is running on the **same computer and browser**. Some browsers or network policies may block HTTPS-to-localhost requests; try a current Chrome/Edge browser. Do not expose the port to the internet.
- **yt-dlp or FFmpeg not found:** Verify that both commands work in a freshly opened PowerShell and restart the helper.
- **YouTube bot confirmation:** Local conversion uses your PC's network, but YouTube may still challenge automated requests. This tool does not bypass access restrictions. If conversion is blocked, import a locally obtained source file instead.
- **Updates:** Update yt-dlp with `yt-dlp -U` (or the package manager you used).

The original WAV master is preferable for lossless export. Converting a compressed YouTube audio stream to WAV does not restore lost audio detail.
