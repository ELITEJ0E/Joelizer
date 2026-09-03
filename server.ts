import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { generateMusic } from './server/aceStep';
import { startExportJob, getExportJob, runAutomatedRenderTest } from './server/renderEngine';
import { createGenerationJob, getGenerationJob, cancelGenerationJob, getAllGenerationJobs, localProviderInstance, cloudProviderInstance } from './server/engines/aceStep';

dotenv.config();

// Ensure public staged directory exists
const STAGED_DIR = path.resolve('./public/staged');
if (!fs.existsSync(STAGED_DIR)) {
  fs.mkdirSync(STAGED_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Serve staged media files statically
  app.use('/staged', express.static(STAGED_DIR));

  const stageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, STAGED_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const uniqueName = `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, uniqueName);
    }
  });
  const stageUpload = multer({ storage: stageStorage, limits: { fileSize: 500 * 1024 * 1024 } });

  // JSON Body parser with extended payload limit
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Initialize Gemini AI Client lazily
  function getGeminiClient(req?: express.Request) {
    const headerKey = req ? (req.headers['x-gemini-api-key'] || req.headers['x-gemini-key'] || req.headers['authorization']) : undefined;
    const bodyKey = req && req.body ? req.body.apiKey : undefined;
    
    // In Vercel deploy or custom client-side override, use the client key or custom header key.
    // Otherwise, default to process.env.GEMINI_API_KEY (AI Studio Developer Testing key).
    const apiKey = (typeof headerKey === 'string' ? headerKey : undefined) || 
                   (typeof bodyKey === 'string' ? bodyKey : undefined) || 
                   process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    return new GoogleGenAI({ apiKey });
  }

  // Helper function for ultra-robust JSON extraction from Gemini output
  function safeExtractJson(text: string) {
    if (!text) return null;
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    // Clean trailing commas before brackets/braces
    clean = clean.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(clean);
    } catch (e) {
      console.warn("First JSON parse attempt failed, trying relaxed string cleanup...", e);
      try {
        // Fix potential raw unescaped newlines within JSON string values
        const relaxed = clean.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t');
        return JSON.parse(relaxed);
      } catch (err) {
        console.error("All JSON parse attempts failed on text:", text.slice(0, 300));
        return null;
      }
    }
  }

  // --- API ENDPOINTS ---

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1b. Asset Staging Endpoint (Converts local Blobs/Files into server-renderable URLs)
  app.post('/api/stage-asset', stageUpload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided for staging' });
      }
      const fileUrl = `/staged/${req.file.filename}`;
      return res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (err: any) {
      console.error('Asset Staging Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to stage asset' });
    }
  });

  // 1c. Server Video Export Endpoints
  app.post('/api/export-video', async (req, res) => {
    try {
      const projectJson = req.body;
      if (!projectJson || typeof projectJson !== 'object') {
        return res.status(400).json({ error: 'Valid CanonicalProjectJson body is required' });
      }

      const jobId = await startExportJob(projectJson);
      return res.json({ success: true, exportId: jobId });
    } catch (err: any) {
      console.error('Export Request Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to initialize export job' });
    }
  });

  app.get('/api/export-progress/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = getExportJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }
    return res.json({
      id: job.id,
      projectName: job.projectName,
      stage: job.stage,
      stageMessage: job.stageMessage,
      progress: job.progress,
      outputUrl: job.outputUrl,
      fileSize: job.fileSize,
      error: job.error
    });
  });

  app.get('/api/download-export/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = getExportJob(jobId);
    
    const exportPath = path.resolve('./public/exports', `${jobId}.mp4`);
    if (!fs.existsSync(exportPath)) {
      return res.status(404).send('Export video file not found or still processing.');
    }

    const cleanFilename = (job?.projectName || 'Joelizer-Video')
      .replace(/[^a-zA-Z0-9_-]/g, '_') + '.mp4';

    return res.download(exportPath, cleanFilename, (err) => {
      if (err) {
        console.error('Error downloading export file:', err);
      }
    });
  });

  // Requirement 15: Automated 10s Render Test Endpoint
  app.get('/api/render-test', async (req, res) => {
    try {
      const result = await runAutomatedRenderTest();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Render test failed'
      });
    }
  });

  // 1b. Media CORS proxy endpoint with audio streaming & Range support
  app.get('/api/proxy-media', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Valid http/https target URL parameter required' });
      }

      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      };

      if (targetUrl.includes('suno') || targetUrl.includes('cloudfront')) {
        reqHeaders['Referer'] = 'https://suno.com/';
        reqHeaders['Origin'] = 'https://suno.com';
      }

      if (req.headers.range) {
        reqHeaders['Range'] = req.headers.range as string;
      }

      const mediaRes = await fetch(targetUrl, {
        headers: reqHeaders
      });

      if (!mediaRes.ok && mediaRes.status !== 206) {
        return res.status(mediaRes.status).json({ error: `Remote media returned status ${mediaRes.status}` });
      }

      let deducedContentType = mediaRes.headers.get('content-type') || '';
      if (!deducedContentType || deducedContentType === 'application/octet-stream' || deducedContentType.startsWith('text/')) {
        const cleanUrl = targetUrl.split('?')[0].toLowerCase();
        if (cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.mp4')) {
          deducedContentType = 'audio/mp4';
        } else if (cleanUrl.endsWith('.mp3')) {
          deducedContentType = 'audio/mpeg';
        } else if (cleanUrl.endsWith('.wav')) {
          deducedContentType = 'audio/wav';
        } else if (cleanUrl.endsWith('.ogg')) {
          deducedContentType = 'audio/ogg';
        } else if (cleanUrl.endsWith('.webm')) {
          deducedContentType = 'audio/webm';
        } else {
          deducedContentType = 'audio/mp4';
        }
      }

      res.status(mediaRes.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin, User-Agent');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', deducedContentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const contentRange = mediaRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      const contentLength = mediaRes.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const arrayBuffer = await mediaRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Proxy Media Error:', err);
      return res.status(500).json({ error: 'Failed to proxy remote media asset' });
    }
  });

  // =========================================================================
  // SUNO AUDIO STREAM RESOLVER & STREAMING PROXY (MANGO DRM)
  // =========================================================================
  interface CachedAudio {
    buffer: Buffer;
    mimeType: string;
    timestamp: number;
  }

  const audioBufferCache = new Map<string, CachedAudio>();
  const pendingFetches = new Map<string, Promise<CachedAudio | null>>();

  async function resolveSunoAudioStream(rawClipId: string): Promise<CachedAudio | null> {
    if (!rawClipId) return null;
    const uuidMatch = rawClipId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const clipId = uuidMatch ? uuidMatch[0].toLowerCase() : rawClipId.trim();

    const cached = audioBufferCache.get(clipId);
    if (cached && Date.now() - cached.timestamp < 4 * 3600 * 1000) {
      return cached;
    }

    if (pendingFetches.has(clipId)) {
      return pendingFetches.get(clipId)!;
    }

    const fetchPromise = (async (): Promise<CachedAudio | null> => {
      try {
        const subtle = globalThis.crypto?.subtle || (await import('crypto')).webcrypto?.subtle;
        if (!subtle) {
          throw new Error('WebCrypto subtle is not available in current runtime');
        }

        // 1. Download encrypted audio stream
        const mediaUrls = [
          `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${clipId}.m4a`,
          `https://cdn1.suno.ai/${clipId}.mp3`
        ];

        let rawBuffer: Buffer | null = null;
        for (const url of mediaUrls) {
          try {
            const mediaRes = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://suno.com/',
                'Origin': 'https://suno.com'
              },
              signal: AbortSignal.timeout(10000)
            });
            if (mediaRes.ok) {
              rawBuffer = Buffer.from(await mediaRes.arrayBuffer());
              if (rawBuffer.length > 0) break;
            }
          } catch (mediaErr) {
            console.warn(`[Suno Audio] Download attempt failed for ${url}:`, mediaErr);
          }
        }

        if (!rawBuffer || rawBuffer.length === 0) {
          console.error(`[Suno Audio] Failed to fetch media buffer for clip ${clipId}`);
          return null;
        }

        // Check if audio is already unencrypted (ISO ftyp, ID3, MP3 syncword, WebM, or OGG)
        const isFtyp = rawBuffer.length >= 8 && rawBuffer.subarray(4, 8).toString('ascii') === 'ftyp';
        const isWebM = rawBuffer.length >= 4 && rawBuffer[0] === 0x1A && rawBuffer[1] === 0x45 && rawBuffer[2] === 0xDF && rawBuffer[3] === 0xA3;
        const isID3 = rawBuffer.length >= 3 && rawBuffer.subarray(0, 3).toString('ascii') === 'ID3';
        const isMP3Sync = rawBuffer.length >= 2 && rawBuffer[0] === 0xFF && (rawBuffer[1] & 0xE0) === 0xE0;
        const isOgg = rawBuffer.length >= 4 && rawBuffer.subarray(0, 4).toString('ascii') === 'OggS';

        if (isFtyp || isWebM || isID3 || isMP3Sync || isOgg) {
          let mimeType = 'audio/mp4';
          if (isWebM) mimeType = 'audio/webm';
          else if (isID3 || isMP3Sync) mimeType = 'audio/mpeg';
          else if (isOgg) mimeType = 'audio/ogg';

          const result: CachedAudio = { buffer: rawBuffer, mimeType, timestamp: Date.now() };
          if (audioBufferCache.size > 100) {
            const firstKey = audioBufferCache.keys().next().value;
            if (firstKey) audioBufferCache.delete(firstKey);
          }
          audioBufferCache.set(clipId, result);
          return result;
        }

        // 2. Fetch rights metadata for encrypted stream
        const rightsRes = await fetch('https://studio-api-prod.suno.com/api/mango/rights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Origin': 'https://suno.com',
            'Referer': `https://suno.com/song/${clipId}`
          },
          body: JSON.stringify({
            content_params: { content_id: clipId, content_type: 'clip' }
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (!rightsRes.ok) {
          console.error(`[Suno Audio] Mango rights endpoint returned status ${rightsRes.status}`);
          return null;
        }

        const { key: encKeyB64, iv: encIvB64, glt } = await rightsRes.json();
        if (!encKeyB64 || !encIvB64 || !glt) {
          console.error('[Suno Audio] Incomplete rights payload received');
          return null;
        }

        // 3. Unpack key parameters
        const userKeyHash = await subtle.digest('SHA-256', new TextEncoder().encode(glt));
        const userKey = await subtle.importKey('raw', userKeyHash, { name: 'AES-GCM' }, false, ['decrypt']);

        const wrappedKey = Uint8Array.from(Buffer.from(encKeyB64, 'base64'));
        const wrappedIv = Uint8Array.from(Buffer.from(encIvB64, 'base64'));
        const additionalData = new TextEncoder().encode(clipId);

        const rawKey = await subtle.decrypt(
          { name: 'AES-GCM', iv: wrappedKey.slice(0, 12), additionalData },
          userKey,
          wrappedKey.slice(12)
        );
        const contentKey = await subtle.importKey('raw', rawKey, { name: 'AES-CTR' }, false, ['decrypt']);

        const rawIv = await subtle.decrypt(
          { name: 'AES-GCM', iv: wrappedIv.slice(0, 12), additionalData },
          userKey,
          wrappedIv.slice(12)
        );
        const contentIv = new Uint8Array(rawIv);

        // 4. Decrypt audio stream
        const decBuf = await subtle.decrypt(
          { name: 'AES-CTR', counter: contentIv, length: 128 },
          contentKey,
          rawBuffer
        );

        const decryptedBuffer = Buffer.from(decBuf);
        let mimeType = 'audio/mp4';
        if (
          decryptedBuffer.length >= 4 &&
          decryptedBuffer[0] === 0x1A &&
          decryptedBuffer[1] === 0x45 &&
          decryptedBuffer[2] === 0xDF &&
          decryptedBuffer[3] === 0xA3
        ) {
          mimeType = 'audio/webm';
        } else if (
          (decryptedBuffer.length >= 3 && decryptedBuffer.subarray(0, 3).toString('ascii') === 'ID3') ||
          (decryptedBuffer.length >= 2 && decryptedBuffer[0] === 0xFF && (decryptedBuffer[1] & 0xE0) === 0xE0)
        ) {
          mimeType = 'audio/mpeg';
        }

        const result: CachedAudio = { buffer: decryptedBuffer, mimeType, timestamp: Date.now() };

        if (audioBufferCache.size > 100) {
          const firstKey = audioBufferCache.keys().next().value;
          if (firstKey) audioBufferCache.delete(firstKey);
        }
        audioBufferCache.set(clipId, result);
        return result;
      } catch (err) {
        console.error('[Suno Audio Engine] Error resolving stream:', err);
        return null;
      } finally {
        pendingFetches.delete(clipId);
      }
    })();

    pendingFetches.set(clipId, fetchPromise);
    return fetchPromise;
  }

  // HTTP 206 Partial Content route
  app.get('/api/suno-audio/:clipId', async (req, res) => {
    try {
      const rawClipId = req.params.clipId?.trim();
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.setHeader('Accept-Ranges', 'bytes');

      if (!rawClipId) {
        return res.status(400).json({ error: 'Clip ID is required' });
      }

      const audioData = await resolveSunoAudioStream(rawClipId);
      if (!audioData) {
        return res.status(404).json({ error: 'Track not available or could not be decrypted' });
      }

      const { buffer, mimeType } = audioData;
      const totalLength = buffer.length;
      const rangeHeader = req.headers.range;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace(/^bytes=/, '').trim().split('-');
        let start = 0;
        let end = totalLength - 1;

        if (!parts[0] && parts[1]) {
          const suffix = parseInt(parts[1], 10);
          if (isNaN(suffix) || suffix <= 0) {
            res.setHeader('Content-Range', `bytes */${totalLength}`);
            return res.status(416).end();
          }
          start = Math.max(0, totalLength - suffix);
          end = totalLength - 1;
        } else {
          start = parseInt(parts[0], 10);
          if (isNaN(start)) {
            res.setHeader('Content-Range', `bytes */${totalLength}`);
            return res.status(416).end();
          }
          if (parts[1]) {
            end = parseInt(parts[1], 10);
            if (isNaN(end)) {
              end = totalLength - 1;
            }
          }
        }

        if (start >= totalLength || end >= totalLength || start > end) {
          res.setHeader('Content-Range', `bytes */${totalLength}`);
          return res.status(416).end();
        }

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
        res.setHeader('Content-Length', (end - start + 1).toString());
        return res.end(buffer.subarray(start, end + 1));
      }

      res.status(200);
      res.setHeader('Content-Length', totalLength.toString());
      return res.end(buffer);
    } catch (err: any) {
      console.error('[Suno Audio Route] Error:', err);
      return res.status(500).json({ error: 'Internal streaming error' });
    }
  });

  // Suno Song / Audio URL resolver endpoint
  app.post('/api/suno-info', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      const trimmedUrl = url.trim();

      // Check if URL contains a Suno UUID
      const uuidMatch = trimmedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      if (uuidMatch) {
        const songId = uuidMatch[0].toLowerCase();
        const pageUrl = `https://suno.com/song/${songId}`;
        let audioUrl = `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`;
        let imageUrl = `https://cdn2.suno.ai/image_large_${songId}.jpeg`;
        let title = 'Suno Track';
        let artist = 'Suno AI';
        let lyrics = '';
        let tags = '';
        let duration = 180;

        // 1. Try public Suno JSON feed first for fast & accurate metadata
        try {
          const apiRes = await fetch(`https://studio-api.prod.suno.com/api/feed/?ids=${songId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(3500)
          });
          if (apiRes.ok) {
            const apiData: any = await apiRes.json();
            const clip = Array.isArray(apiData) ? apiData[0] : (apiData?.clips ? apiData.clips[0] : null);
            if (clip) {
              if (clip.title) title = clip.title;
              if (clip.display_name || clip.handle) artist = clip.display_name || clip.handle;
              if (clip.image_large_url || clip.image_url) imageUrl = clip.image_large_url || clip.image_url;
              if (clip.audio_url && !clip.audio_url.includes('forbidden')) audioUrl = clip.audio_url;
              if (clip.metadata?.duration) duration = clip.metadata.duration;
              else if (clip.duration) duration = clip.duration;
              if (clip.metadata?.prompt) lyrics = clip.metadata.prompt;
              if (clip.metadata?.tags) tags = clip.metadata.tags;
            }
          }
        } catch (apiErr) {
          console.warn('Suno API feed probe warning:', apiErr);
        }

        // 2. Scrape page for accurate HTML metadata, clip media URLs, and current CDN audio link
        try {
          const fetchRes = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(6000)
          });

          if (fetchRes.ok) {
            const html = await fetchRes.text();

            // Extract audio link from Suno clip CDN or cloudfront
            const cloudfrontMatch = html.match(/https:(?:\\\/|\/)+[a-z0-9]+\.cloudfront\.net(?:\\\/|\/)+[0-9]+(?:\\\/|\/)clip(?:\\\/|\/)+[0-9a-f-]+\.m4a/i);
            const mediaUrlMatch = html.match(/\\?"media_urls\\?":\s*\[\s*\{[^}]*?\\?"url\\?":\s*\\?"(https:[^"\\]+)/i);
            const genericMatch = html.match(new RegExp(`https:(?:\\\\\\/|\\/)+[^"'\\s]*${songId}[^"'\\s]*\\.(?:m4a|mp3)`, 'i'));
            
            if (cloudfrontMatch && cloudfrontMatch[0]) {
              audioUrl = cloudfrontMatch[0].replace(/\\/g, '');
            } else if (mediaUrlMatch && mediaUrlMatch[1]) {
              audioUrl = mediaUrlMatch[1].replace(/\\/g, '');
            } else if (genericMatch && genericMatch[0] && !genericMatch[0].includes('forbidden')) {
              audioUrl = genericMatch[0].replace(/\\/g, '');
            }

            // Extract duration
            const durMatch = html.match(/\\?"duration\\?":\s*([0-9]+(?:\.[0-9]+)?)/);
            if (durMatch && durMatch[1]) {
              duration = Math.round(parseFloat(durMatch[1]) * 10) / 10;
            }

            // Extract title
            const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);
            const titleMatch = html.match(/"title":"([^"]+)"/);
            if (ogTitleMatch && ogTitleMatch[1]) {
              title = ogTitleMatch[1].replace(/ \| Suno$/i, '').trim();
            } else if (titleMatch && titleMatch[1] && titleMatch[1] !== 'Suno') {
              title = titleMatch[1];
            }

            // Extract artist
            const descMatch = html.match(/property="og:description"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:description"/i);
            if (descMatch && descMatch[1]) {
              const byMatch = descMatch[1].match(/by ([^(@]+)/);
              if (byMatch) {
                artist = byMatch[1].trim();
              }
            }

            // Extract OG image
            const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
            if (ogImageMatch && ogImageMatch[1]) {
              imageUrl = ogImageMatch[1];
            }

            // Extract prompt / lyrics from JSON stream
            if (!lyrics) {
              const promptMatch = html.match(/\\?"prompt\\?":\s*\\?"((?:\\\\"|[^"])*)\\?"/);
              if (promptMatch && promptMatch[1]) {
                lyrics = promptMatch[1]
                  .replace(/\\\\n/g, '\n')
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .trim();
              }
            }

            // Extract tags
            if (!tags) {
              const tagsMatch = html.match(/\\?"tags\\?":\s*\\?"((?:\\\\"|[^"])*)\\?"/);
              if (tagsMatch && tagsMatch[1]) {
                tags = tagsMatch[1]
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .trim();
              }
            }
          }
        } catch (e) {
          console.warn('Suno page fetch warning:', e);
        }

        return res.json({
          id: songId,
          title,
          artist,
          audioUrl,
          proxiedAudioUrl: `/api/suno-audio/${songId}.m4a`,
          imageUrl,
          lyrics,
          tags,
          duration,
          source: 'suno'
        });
      }

      // Check if URL is YouTube
      const isYoutube = trimmedUrl.match(/(youtube\.com|youtu\.be|youtube-nocookie\.com)\/(watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/i) || trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be');
      if (isYoutube) {
        let videoId = 'dQw4w9WgXcQ'; // default fallback ID
        const idMatch = trimmedUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        if (idMatch && idMatch[1]) {
          videoId = idMatch[1];
        }

        const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Try Cobalt API first
        try {
          const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
              url: pageUrl,
              downloadMode: 'audio',
              audioFormat: 'mp3',
              audioBitrate: '128'
            })
          });

          if (cobaltRes.ok) {
            const cobaltData = await cobaltRes.json();
            if (cobaltData && cobaltData.url) {
              return res.json({
                id: `yt-${videoId}`,
                title: `YouTube Audio (${videoId})`,
                artist: 'YouTube Video',
                audioUrl: cobaltData.url,
                imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                lyrics: '',
                tags: '',
                source: 'youtube'
              });
            }
          }
        } catch (err) {
          console.warn("Primary Cobalt API attempt failed, trying fallback mirrors...", err);
        }

        // Fallback mirrors
        const fallbackMirrors = [
          'https://cobalt.api.ryb.sh/api/json',
          'https://api.cobalt.tools/api/json'
        ];

        for (const mirror of fallbackMirrors) {
          try {
            const cobaltRes = await fetch(mirror, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
              },
              body: JSON.stringify({
                url: pageUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3'
              })
            });

            if (cobaltRes.ok) {
              const cobaltData = await cobaltRes.json();
              if (cobaltData && cobaltData.url) {
                return res.json({
                  id: `yt-${videoId}`,
                  title: `YouTube Audio (${videoId})`,
                  artist: 'YouTube Video',
                  audioUrl: cobaltData.url,
                  imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                  lyrics: '',
                  tags: '',
                  source: 'youtube'
                });
              }
            }
          } catch (mirrorErr) {
            console.warn(`Fallback mirror ${mirror} failed:`, mirrorErr);
          }
        }

        // If all automated APIs fail, provide a clear, helpful error on how to proceed.
        return res.status(400).json({ 
          error: 'YouTube conversion service is currently busy or rate-limited. Please use a direct MP3 link or upload your audio file directly in the Studio.' 
        });
      }

      // Direct MP3 or generic stream audio URL
      if (trimmedUrl.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i) || trimmedUrl.startsWith('http')) {
        const urlParts = trimmedUrl.split('/');
        const rawFileName = urlParts[urlParts.length - 1].split('?')[0] || 'Remote Track';
        const cleanName = decodeURIComponent(rawFileName).replace(/[-_]/g, ' ');
        return res.json({
          id: `url-${Date.now()}`,
          title: cleanName,
          artist: 'Online Source',
          audioUrl: trimmedUrl,
          imageUrl: null,
          lyrics: '',
          tags: '',
          source: 'direct'
        });
      }

      return res.status(400).json({ error: 'Invalid URL. Please enter a valid track link, YouTube URL, or direct audio URL.' });
    } catch (err: any) {
      console.error('Suno Info API Error:', err);
      return res.status(500).json({ error: 'Failed to process song URL' });
    }
  });

  // ACE-Step AI Engine Routes (Workstation Generation API)
  app.post('/api/ai/generate', (req, res) => {
    try {
      const { prompt, lyrics, duration, bpm, key, timeSignature, vocalLanguage, isInstrumental, model, engine } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Song prompt is required' });
      }

      const job = createGenerationJob({
        prompt: prompt.trim(),
        lyrics: typeof lyrics === 'string' ? lyrics.trim() : '',
        duration: Number(duration) || 30,
        bpm: Number(bpm) || 0,
        keySignature: key || '',
        timeSignature: timeSignature || '',
        vocalLanguage: vocalLanguage || 'unknown',
        isInstrumental: !!isInstrumental,
        model: model || 'ACE-Step v1.5',
        engine: engine === 'ace-step-local' ? 'ace-step-local' : 'ace-step-cloud'
      });

      return res.json({ success: true, job });
    } catch (err: any) {
      console.error('Job Creation Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to queue generation job' });
    }
  });

  app.get('/api/ai/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = getGenerationJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }
    return res.json({ job });
  });

  app.post('/api/ai/jobs/:jobId/cancel', (req, res) => {
    const { jobId } = req.params;
    const cancelled = cancelGenerationJob(jobId);
    return res.json({ success: cancelled });
  });

  app.get('/api/ai/jobs', (_req, res) => {
    return res.json({ jobs: getAllGenerationJobs() });
  });

  app.get('/api/ai/engine-status', async (req, res) => {
    try {
      const { engine } = req.query;
      if (engine === 'ace-step-local') {
        const status = await localProviderInstance.checkHealth();
        return res.json(status);
      } else if (engine === 'ace-step-cloud') {
        const status = await cloudProviderInstance.checkHealth();
        return res.json(status);
      }
      const [localStatus, cloudStatus] = await Promise.all([
        localProviderInstance.checkHealth(),
        cloudProviderInstance.checkHealth()
      ]);
      return res.json({
        local: localStatus,
        cloud: cloudStatus,
        connected: localStatus.connected || cloudStatus.connected
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to check engine status' });
    }
  });

  app.post('/api/ai/engine-config', (req, res) => {
    const { endpoint } = req.body;
    if (typeof endpoint === 'string' && endpoint.trim()) {
      localProviderInstance.setEndpoint(endpoint.trim());
    }
    return res.json({ success: true, endpoint: localProviderInstance.getEndpoint() });
  });

  // ACE-Step AI Music Generation endpoint (Legacy compatibility)
  app.post('/api/generate-music', async (req, res) => {
    try {
      const { prompt, lyrics, duration } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Music generation prompt is required' });
      }

      const numDuration = Number(duration) || 30;

      // Wrap generation with a 75-second timeout for HuggingFace cold starts
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Generation request timed out after 75s. The ACE-Step Space may be waking up or busy. Please retry.')), 75000);
      });

      const genPromise = generateMusic({
        prompt: prompt.trim(),
        lyrics: typeof lyrics === 'string' ? lyrics.trim() : '',
        duration: numDuration
      });

      const result = await Promise.race([genPromise, timeoutPromise]) as any;

      return res.json(result);
    } catch (err: any) {
      console.error('AI Music Generation Route Error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to generate music track with ACE-Step AI.'
      });
    }
  });

  // 2. Audio Transcription endpoint (Audio -> Synchronized LRC JSON)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/mp3', language, prompt } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const ai = getGeminiClient(req);
      const candidateModels = ['gemini-2.5-flash', 'gemini-3.7-flash'];

      const systemPrompt = `You are an elite, highly accurate multilingual music transcription and subtitle synchronization system.
You specialize in English, Korean (한국어 / Hangul, K-Pop, melisma), Chinese (中文 / Mandarin, Cantonese, Traditional & Simplified Hanzi characters), Japanese, and mixed multilingual lyrics.

Target Song Language: ${language || 'Auto-detect'}.
Extra User Guidance: ${prompt || 'None'}.

Rules for High-Accuracy Transcription:
1. Listen carefully to the singing and speech in the audio.
2. For Korean (한국어): Transcribe in natural, correct Hangul characters with standard word spacing (어절). Keep Korean phrases grouped logically.
3. For Chinese (中文): Transcribe in accurate Chinese Hanzi characters (Traditional or Simplified as heard). Break lines into natural musical singing phrases (usually 4 to 10 characters per line).
4. For Mixed Lyrics (e.g. K-pop / C-pop with English rap or chorus): Preserve exact English words alongside Hangul/Hanzi without corrupting non-English parts into phonetic approximations.
5. Assign precise start times (startTime in seconds, float format e.g. 12.34) and end times (endTime in seconds).
6. Ensure timestamps are strictly chronological (startTime < endTime and sorted ascending).
7. VERY IMPORTANT: Match timestamps precisely to vocal sound onsets and offsets. Compensate for latency so lyrics illuminate in exact sync with the audio.

Schema required:
{
  "text": "Full plain text transcription",
  "language": "Detected primary language (e.g. Korean, Chinese, English, Mixed)",
  "bpm": 120,
  "key": "C Major",
  "lines": [
    {
      "id": "line-1",
      "startTime": 4.25,
      "endTime": 7.80,
      "text": "Lyric text line"
    }
  ]
}`;

      let aiResponse: any = null;
      let lastError: any = null;

      for (const model of candidateModels) {
        try {
          aiResponse = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: audioBase64, mimeType } },
                  { text: systemPrompt }
                ]
              }
            ],
            config: {
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  language: { type: 'STRING' },
                  bpm: { type: 'NUMBER' },
                  key: { type: 'STRING' },
                  lines: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        id: { type: 'STRING' },
                        startTime: { type: 'NUMBER' },
                        endTime: { type: 'NUMBER' },
                        text: { type: 'STRING' }
                      },
                      required: ['startTime', 'endTime', 'text']
                    }
                  }
                },
                required: ['lines']
              }
            }
          });
          if (aiResponse && aiResponse.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`[Transcription] Model ${model} failed, trying next fallback:`, err.message || err);
          lastError = err;
        }
      }

      if (!aiResponse && lastError) {
        throw lastError;
      }

      const responseText = aiResponse?.text || '';
      const parsedData = safeExtractJson(responseText);

      if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
        // Clean and sort lines, apply a -300ms latency compensation offset for Gemini speech
        const LATENCY_OFFSET = -0.3;
        
        const sortedLines = parsedData.lines
          .map((l: any, idx: number) => {
            const rawStart = typeof l.startTime === 'number' ? l.startTime : idx * 4;
            const rawEnd = typeof l.endTime === 'number' ? l.endTime : rawStart + 3.5;
            
            return {
              id: l.id || `line-${idx}-${Date.now()}`,
              startTime: Math.max(0, rawStart + LATENCY_OFFSET),
              endTime: Math.max((rawStart + LATENCY_OFFSET) + 0.5, rawEnd + LATENCY_OFFSET),
              text: String(l.text || '').trim()
            };
          })
          .filter((l: any) => l.text.length > 0)
          .sort((a: any, b: any) => a.startTime - b.startTime);

        return res.json({
          ...parsedData,
          lines: sortedLines
        });
      }

      // Fallback if parsing returned null or empty lines
      res.json({
        text: responseText || "Transcribed Lyric Audio",
        language: language || "English",
        bpm: 120,
        key: "C Major",
        lines: [
          { id: 'fb-1', startTime: 2.0, endTime: 5.5, text: "Sample Synchronized Lyric Line 1" },
          { id: 'fb-2', startTime: 6.0, endTime: 9.5, text: "Sample Synchronized Lyric Line 2" },
          { id: 'fb-3', startTime: 10.0, endTime: 14.0, text: "Sample Synchronized Lyric Line 3" }
        ]
      });
    } catch (err: any) {
      console.error('Transcription API Error:', err);
      res.json({
        error: err.message || 'Failed to process audio transcription',
        language: 'English',
        bpm: 120,
        key: 'C Major',
        lines: [
          { id: 'err-1', startTime: 2.0, endTime: 5.5, text: "Sample Synchronized Line 1" },
          { id: 'err-2', startTime: 6.0, endTime: 9.5, text: "Sample Synchronized Line 2" }
        ]
      });
    }
  });

  // 3. Forced Alignment endpoint (Audio + Uploaded Lyrics -> Synchronized LRC JSON)
  app.post('/api/align', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/mp3', rawLyrics, language } = req.body;
      if (!audioBase64 || !rawLyrics) {
        return res.status(400).json({ error: 'Audio data and raw lyrics text are required' });
      }

      const ai = getGeminiClient(req);
      const candidateModels = ['gemini-2.5-flash', 'gemini-3.7-flash'];

      const systemPrompt = `You are a high-precision multilingual forced audio alignment engine specialized in Korean (한국어), Chinese (中文 - Mandarin/Cantonese), English, Japanese, and mixed language lyrics.
You are given an audio file and the exact raw lyric text provided by the user.

User Provided Raw Lyrics:
${rawLyrics}

Target Language Preference: ${language || 'Auto-detect'}

Instructions:
1. Preserve the user's provided lyric text line-by-line without altering characters.
2. Accurately handle Korean Hangul (한국어), Chinese characters (中文 / 繁體 / 簡體), and mixed language phrases.
3. For each line in the user's text, listen to the audio and find its exact start timestamp (startTime in seconds) and end timestamp (endTime in seconds).
4. Do NOT omit or drop any lines from the user's text.
5. Timestamps must be sorted in strictly ascending chronological order.
6. VERY IMPORTANT: Assign timestamps precisely where the vocal sound begins and ends for each phrase. Compensate for any audio/processing latency to achieve millimeter-exact visual synchronization.

Schema required:
{
  "text": ${JSON.stringify(rawLyrics)},
  "language": "${language || 'Auto'}",
  "bpm": 120,
  "key": "C Major",
  "lines": [
    {
      "id": "line-1",
      "startTime": 4.50,
      "endTime": 8.20,
      "text": "User lyric text line"
    }
  ]
}`;

      let aiResponse: any = null;
      let lastError: any = null;

      for (const model of candidateModels) {
        try {
          aiResponse = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: audioBase64, mimeType } },
                  { text: systemPrompt }
                ]
              }
            ],
            config: {
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  language: { type: 'STRING' },
                  bpm: { type: 'NUMBER' },
                  key: { type: 'STRING' },
                  lines: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        id: { type: 'STRING' },
                        startTime: { type: 'NUMBER' },
                        endTime: { type: 'NUMBER' },
                        text: { type: 'STRING' }
                      },
                      required: ['startTime', 'endTime', 'text']
                    }
                  }
                },
                required: ['lines']
              }
            }
          });
          if (aiResponse && aiResponse.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`[Alignment] Model ${model} failed, trying next fallback:`, err.message || err);
          lastError = err;
        }
      }

      if (!aiResponse && lastError) {
        throw lastError;
      }

      const responseText = aiResponse?.text || '';
      const parsedData = safeExtractJson(responseText);

      if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
        const LATENCY_OFFSET = -0.3;
        
        const sortedLines = parsedData.lines
          .map((l: any, idx: number) => {
            const rawStart = typeof l.startTime === 'number' ? l.startTime : idx * 4;
            const rawEnd = typeof l.endTime === 'number' ? l.endTime : rawStart + 3.5;
            
            return {
              id: l.id || `align-${idx}-${Date.now()}`,
              startTime: Math.max(0, rawStart + LATENCY_OFFSET),
              endTime: Math.max((rawStart + LATENCY_OFFSET) + 0.5, rawEnd + LATENCY_OFFSET),
              text: String(l.text || '').trim()
            };
          })
          .filter((l: any) => l.text.length > 0)
          .sort((a: any, b: any) => a.startTime - b.startTime);

        return res.json({
          ...parsedData,
          lines: sortedLines
        });
      }

      // Fallback alignment algorithm if Gemini API fails
      const rawLines = (req.body.rawLyrics || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      const lines = rawLines.map((l: string, idx: number) => ({
        id: `align-fb-${idx}`,
        startTime: idx * 4 + 2,
        endTime: idx * 4 + 5.5,
        text: l
      }));

      res.json({
        text: req.body.rawLyrics,
        lines,
        bpm: 120,
        key: 'C Major'
      });
    } catch (err: any) {
      console.error('Alignment API Error:', err);
      const rawLines = (req.body.rawLyrics || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      const lines = rawLines.map((l: string, idx: number) => ({
        id: `align-fb-${idx}`,
        startTime: idx * 4 + 2,
        endTime: idx * 4 + 5.5,
        text: l
      }));

      res.json({
        text: req.body.rawLyrics,
        lines,
        bpm: 120,
        key: 'C Major'
      });
    }
  });

  // 4. Audio Analysis endpoint (BPM, Song Key, Language, Song Structure)
  app.post('/api/analyze', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/mp3' } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const ai = getGeminiClient(req);
      const model = 'gemini-2.5-flash';

      const systemPrompt = `Analyze the audio file and determine:
1. Estimated tempo in BPM (beats per minute)
2. Musical Key (e.g. C Major, F# Minor)
3. Primary Vocal Language (e.g. English, Spanish, Japanese)
4. Song Sections (Intro, Verse 1, Chorus, Verse 2, Bridge, Outro) with start and end times in seconds.

Return strictly valid JSON:
{
  "bpm": 124,
  "key": "A Minor",
  "language": "English",
  "sections": [
    { "title": "Intro", "startTime": 0, "endTime": 12 },
    { "title": "Verse 1", "startTime": 12, "endTime": 36 },
    { "title": "Chorus", "startTime": 36, "endTime": 60 }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: audioBase64,
                  mimeType
                }
              },
              { text: systemPrompt }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = aiResponse.text || '';
      const parsedData = safeExtractJson(responseText);

      if (parsedData) {
        return res.json(parsedData);
      }

      res.json({
        bpm: 120,
        key: 'C Major',
        language: 'English',
        sections: [
          { title: 'Intro', startTime: 0, endTime: 10 },
          { title: 'Verse', startTime: 10, endTime: 40 },
          { title: 'Chorus', startTime: 40, endTime: 70 }
        ]
      });
    } catch (err: any) {
      console.error('Analyze API Error:', err);
      res.json({
        bpm: 120,
        key: 'C Major',
        language: 'English',
        sections: [
          { title: 'Intro', startTime: 0, endTime: 10 },
          { title: 'Verse', startTime: 10, endTime: 40 },
          { title: 'Chorus', startTime: 40, endTime: 70 }
        ]
      });
    }
  });

  // Serve static generated audio files
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));
  app.use('/generated', express.static(path.join(publicDir, 'generated')));

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Joelizer Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
