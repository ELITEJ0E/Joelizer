// Optional, local-only helper for authorized media. Run on your own computer.
// It never listens on a public network interface or accepts arbitrary origins.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 39847;
const ORIGINS = new Set(['https://joelizer.vercel.app', 'http://localhost:3000', 'http://localhost:5173']);
let busy = false;

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function youtubeError(stderr) {
  if (/sign in to confirm you.re not a bot/i.test(stderr))
    return 'YouTube also challenged this computer. Open the video in your browser and try again later; local conversion cannot guarantee access.';
  if (/video unavailable|private video|members.only|age.restricted/i.test(stderr))
    return 'YouTube says this video is unavailable or requires access that this helper does not have.';
  if (/ffmpeg.*not found|ffprobe.*not found|ffmpeg.*not installed/i.test(stderr))
    return 'FFmpeg is missing. Install FFmpeg and restart the local helper.';
  return 'Local conversion failed. Check the helper window for the yt-dlp error.';
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!origin || !ORIGINS.has(origin)) return json(res, 403, { error: 'Untrusted browser origin.' });
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', mode: 'local' });
  if (req.method !== 'POST' || req.url !== '/convert') return json(res, 404, { error: 'Not found.' });
  if (busy) return json(res, 429, { error: 'A conversion is already running.' });

  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > 4096) return json(res, 413, { error: 'Request too large.' });
    }
    const { url, format, authorized } = JSON.parse(body);
    const u = new URL(url);
    if (authorized !== true || !['mp3', 'wav'].includes(format) || u.protocol !== 'https:' || u.hostname !== 'www.youtube.com' || u.pathname !== '/watch' || !/^[\w-]{11}$/.test(u.searchParams.get('v') || ''))
      return json(res, 400, { error: 'Confirm permission and enter a valid YouTube link and format.' });

    busy = true;
    const folder = await mkdtemp(path.join(tmpdir(), 'joelizer-local-'));
    try {
      const output = path.join(folder, `audio.${format}`);
      const args = [
        '--ignore-config', '--no-playlist', '--no-progress', '--no-cache-dir',
        '--match-filter', 'duration <= 900', '--max-filesize', '250M',
        '--extract-audio', '--audio-format', format,
        ...(format === 'mp3' ? ['--audio-quality', '320K'] : []),
        '--output', path.join(folder, 'audio.%(ext)s'),
        `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`
      ];
      await new Promise((resolve, reject) => {
        const child = spawn('yt-dlp', args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
        let stderr = '';
        const timer = setTimeout(() => { child.kill(); reject(new Error('Conversion timed out after 3 minutes.')); }, 180000);
        child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
        child.once('error', err => { clearTimeout(timer); reject(new Error(err.code === 'ENOENT' ? 'yt-dlp is not installed or is missing from PATH.' : err.message)); });
        child.once('close', code => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else { console.error('[yt-dlp]', stderr); reject(new Error(youtubeError(stderr))); }
        });
      });
      const info = await stat(output);
      if (info.size < 100 || info.size > 250 * 1024 * 1024) throw new Error('Converted audio is empty or too large.');
      const audio = await readFile(output);
      res.writeHead(200, {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(audio);
    } finally { busy = false; await rm(folder, { recursive: true, force: true }); }
  } catch (error) {
    console.error('[Joelizer local converter]', error);
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : 'Local conversion failed.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Joelizer local converter ready at http://127.0.0.1:${PORT}`);
  console.log('Keep this terminal open while converting. Press Ctrl+C to stop.');
});
