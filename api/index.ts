import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cache for decrypted audio buffers to keep Vercel serverless snappy
interface CachedAudio {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
}
const audioBufferCache = new Map<string, CachedAudio>();
const pendingFetches = new Map<string, Promise<CachedAudio | null>>();

function getGeminiClient(req?: express.Request) {
  const headerKey = req ? (req.headers['x-gemini-api-key'] || req.headers['x-gemini-key'] || req.headers['authorization']) : undefined;
  const bodyKey = req && req.body ? req.body.apiKey : undefined;
  
  const apiKey = (typeof headerKey === 'string' ? headerKey : undefined) || 
                 (typeof bodyKey === 'string' ? bodyKey : undefined) || 
                 process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

function safeExtractJson(text: string) {
  if (!text) return null;
  let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  clean = clean.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(clean);
  } catch (e) {
    try {
      const relaxed = clean.replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t');
      return JSON.parse(relaxed);
    } catch (err) {
      return null;
    }
  }
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'vercel-serverless',
    hasRemotion: false,
    time: new Date().toISOString()
  });
});

// 2. Proxy media (Bypasses CORS restrictions for remote images/audio)
app.get('/api/proxy-media', async (req, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Valid http/https target URL parameter required' });
    }

    const mediaRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!mediaRes.ok) {
      return res.status(mediaRes.status).json({ error: `Remote media returned status ${mediaRes.status}` });
    }

    const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await mediaRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to proxy remote media asset' });
  }
});

// 3. Audio Streaming Resolver
async function resolveAudioStreamBuffer(clipId: string): Promise<CachedAudio | null> {
  const cached = audioBufferCache.get(clipId);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached;
  }

  if (pendingFetches.has(clipId)) {
    return pendingFetches.get(clipId)!;
  }

  const fetchPromise = (async () => {
    try {
      const subtle = globalThis.crypto?.subtle;
      const mediaUrls = [
        `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${clipId}.m4a`,
        `https://cdn1.suno.ai/${clipId}.mp3`,
        `https://cdn1.suno.ai/${clipId}.m4a`,
        `https://audiopipe.suno.ai/?item_id=${clipId}`
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
            signal: AbortSignal.timeout(8000)
          });
          if (mediaRes.ok) {
            rawBuffer = Buffer.from(await mediaRes.arrayBuffer());
            if (rawBuffer.length > 0) break;
          }
        } catch (e) {
          // Try next url
        }
      }

      if (!rawBuffer || rawBuffer.length === 0) {
        return null;
      }

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
        audioBufferCache.set(clipId, result);
        return result;
      }

      // If encrypted, attempt Mango rights decryption
      if (subtle) {
        try {
          const rightsRes = await fetch('https://studio-api-prod.suno.com/api/mango/rights', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Origin': 'https://suno.com',
              'Referer': `https://suno.com/song/${clipId}`
            },
            body: JSON.stringify({ content_params: { content_id: clipId, content_type: 'clip' } }),
            signal: AbortSignal.timeout(6000)
          });

          if (rightsRes.ok) {
            const { key: encKeyB64, iv: encIvB64, glt } = await rightsRes.json();
            if (encKeyB64 && encIvB64 && glt) {
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

              const decBuf = await subtle.decrypt(
                { name: 'AES-CTR', counter: contentIv, length: 128 },
                contentKey,
                rawBuffer
              );

              const decryptedBuffer = Buffer.from(decBuf);
              const result: CachedAudio = { buffer: decryptedBuffer, mimeType: 'audio/mp4', timestamp: Date.now() };
              audioBufferCache.set(clipId, result);
              return result;
            }
          }
        } catch (decErr) {
          console.warn('Decryption warning:', decErr);
        }
      }

      return null;
    } catch (err) {
      return null;
    } finally {
      pendingFetches.delete(clipId);
    }
  })();

  pendingFetches.set(clipId, fetchPromise);
  return fetchPromise;
}

// 4. HTTP 206 Partial Content Audio Stream
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

    const cleanId = rawClipId.replace(/\.[^/.]+$/, '');
    const audioData = await resolveAudioStreamBuffer(cleanId);
    if (!audioData) {
      return res.status(404).json({ error: 'Audio track not found or unavailable' });
    }

    const { buffer, mimeType } = audioData;
    const totalLength = buffer.length;
    const rangeHeader = req.headers.range;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/^bytes=/, '').trim().split('-');
      let start = parseInt(parts[0], 10) || 0;
      let end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

      if (isNaN(start) || start >= totalLength || isNaN(end) || end >= totalLength || start > end) {
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
    return res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// 5. URL Metadata Resolver (handles audio URLs, song links, etc.)
const handleResolveUrl = async (req: express.Request, res: express.Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const trimmedUrl = url.trim();
    const uuidMatch = trimmedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    if (uuidMatch) {
      const songId = uuidMatch[0].toLowerCase();
      const pageUrl = `https://suno.com/song/${songId}`;
      let audioUrl = `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`;
      let imageUrl = `https://cdn2.suno.ai/image_large_${songId}.jpeg`;
      let title = 'Suno Track';
      let artist = 'ELITEJOE';
      let lyrics = '';
      let tags = '';
      let duration = 180;

      // Scrape Suno page for accurate HTML metadata, clip media URLs, and artist creator
      try {
        const fetchRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();

          // 1. Extract title and artist from <title> tag: <title>Set Free (synth.ver) by ELITEJOE | Suno</title>
          const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleTagMatch) {
            const raw = titleTagMatch[1].replace(/\s*\|\s*Suno$/i, '').trim();
            const bySplit = raw.split(/\s+by\s+/i);
            if (bySplit.length > 1) {
              title = bySplit[0].trim();
              artist = bySplit.slice(1).join(' by ').trim();
            } else {
              title = raw;
            }
          }

          // 2. Extract og:title fallback
          const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);
          if (ogTitleMatch && ogTitleMatch[1]) {
            const cleanedOg = ogTitleMatch[1].replace(/\s*\|\s*Suno$/i, '').trim();
            if (cleanedOg && !title) title = cleanedOg;
          }

          // 3. Extract exact user display_name from user_id JSON block in page stream
          const userBlockMatch = html.match(/\\"user_id\\":\\"[^"]+\\",\\"display_name\\":\\"([^"\\]+)\\"/) ||
                                 html.match(/"user_id":"[^"]+","display_name":"([^"]+)"/) ||
                                 html.match(/\\"user_display_name\\":\\"([^"\\]+)\\"/);
          if (userBlockMatch && userBlockMatch[1]) {
            artist = userBlockMatch[1].trim();
          }

          // 4. Description tag fallback for creator name
          if (!artist || artist.toLowerCase() === 'suno' || artist.toLowerCase() === 'suno ai') {
            const descMatch = html.match(/name="description"\s+content="([^"]+)"/i) || html.match(/property="og:description"\s+content="([^"]+)"/i);
            if (descMatch && descMatch[1]) {
              const byMatch = descMatch[1].match(/by\s+([^(@\n\r,]+)/i);
              if (byMatch && byMatch[1]) {
                const candidate = byMatch[1].trim();
                if (candidate && !candidate.toLowerCase().includes('suno')) {
                  artist = candidate;
                }
              }
            }
          }

          // 5. Extract audio link from Suno clip CDN or cloudfront
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

          // 6. Extract duration
          const durMatch = html.match(/\\?"duration\\?":\s*([0-9]+(?:\.[0-9]+)?)/) || html.match(/"duration":\s*([0-9]+(?:\.[0-9]+)?)/);
          if (durMatch && durMatch[1]) {
            duration = Math.round(parseFloat(durMatch[1]) * 10) / 10;
          }

          // 7. Extract OG image
          const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
          if (ogImageMatch && ogImageMatch[1]) {
            imageUrl = ogImageMatch[1];
          }

          // 8. Extract prompt / lyrics from JSON stream
          if (!lyrics) {
            const promptMatch = html.match(/\\?"prompt\\?":\s*\\?"((?:\\\\"|[^"])*)\\?"/);
            if (promptMatch && promptMatch[1] && promptMatch[1] !== '$53') {
              lyrics = promptMatch[1]
                .replace(/\\\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .trim();
            }
          }

          // 9. Extract tags
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
        source: 'online'
      });
    }

    // Direct audio URL check
    if (trimmedUrl.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i) || trimmedUrl.startsWith('http')) {
      const urlParts = trimmedUrl.split('/');
      const rawFileName = urlParts[urlParts.length - 1].split('?')[0] || 'Audio Track';
      const cleanName = decodeURIComponent(rawFileName).replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
      return res.json({
        id: `url-${Date.now()}`,
        title: cleanName || 'Audio Stream',
        artist: 'Web Audio',
        audioUrl: trimmedUrl,
        proxiedAudioUrl: trimmedUrl,
        imageUrl: null,
        lyrics: '',
        tags: 'Direct Audio Stream',
        duration: 180,
        source: 'direct'
      });
    }

    return res.status(400).json({ error: 'Please provide a valid audio link or song URL.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process URL' });
  }
};

app.post('/api/suno-info', handleResolveUrl);
app.post('/api/resolve-url', handleResolveUrl);

// 6. Transcribe (Gemini 2.5 Flash)
// 6. Transcribe (AI Speech-to-Text)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3', language, prompt } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'Audio data is required' });

    const ai = getGeminiClient(req);
    const model = 'gemini-2.5-flash';

    const systemPrompt = `You are a high-precision music transcription and lyrics synchronization engine.
You specialize in English, Korean (한국어 / Hangul, K-Pop, melisma), Chinese (中文 / Mandarin, Cantonese, Traditional & Simplified Hanzi characters), Japanese, and mixed multilingual lyrics.

Target Song Language: ${language || 'Auto-detect'}.
Extra User Guidance: ${prompt || 'None'}.

Rules for High-Accuracy Transcription & Alignment:
1. Listen carefully to the singing vocals and speech in the audio.
2. For Korean (한국어): Transcribe in natural, correct Hangul characters with standard word spacing (어절). Keep Korean phrases grouped logically.
3. For Chinese (中文): Transcribe in accurate Chinese Hanzi characters. Break lines into natural musical phrases.
4. For Mixed Lyrics: Preserve exact English words alongside Hangul/Hanzi without corrupting non-English parts.
5. Exact Acoustic Boundaries:
   - startTime: The EXACT second where vocal articulation begins for the line. If there is an intro, do NOT start at 0.00s.
   - endTime: The EXACT second where vocal sound finishes decaying or pauses.
6. Word-Level Timings: Provide word-level start and end timestamps in the "words" array for each line.
7. Ensure timestamps are strictly chronological (startTime < endTime and sorted ascending).

Return strictly JSON:
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
      "text": "Lyric text line",
      "words": [
        { "word": "Lyric", "startTime": 4.25, "endTime": 5.10 },
        { "word": "text", "startTime": 5.15, "endTime": 6.20 },
        { "word": "line", "startTime": 6.25, "endTime": 7.80 }
      ]
    }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
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
                  text: { type: 'STRING' },
                  words: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        word: { type: 'STRING' },
                        startTime: { type: 'NUMBER' },
                        endTime: { type: 'NUMBER' }
                      },
                      required: ['word', 'startTime', 'endTime']
                    }
                  }
                },
                required: ['startTime', 'endTime', 'text']
              }
            }
          },
          required: ['lines']
        }
      }
    });

    const parsedData = safeExtractJson(aiResponse.text || '');
    if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
      const sortedLines = parsedData.lines
        .map((l: any, idx: number) => {
          const rawStart = typeof l.startTime === 'number' && !isNaN(l.startTime) ? Math.max(0, l.startTime) : idx * 4;
          const rawEnd = typeof l.endTime === 'number' && !isNaN(l.endTime) && l.endTime > rawStart ? l.endTime : rawStart + 3.5;
          const lineText = String(l.text || '').trim();

          let words = Array.isArray(l.words) && l.words.length > 0
            ? l.words.map((w: any) => {
                const wStart = typeof w.startTime === 'number' ? Math.max(rawStart, w.startTime) : (typeof w.start === 'number' ? Math.max(rawStart, w.start) : rawStart);
                const wEnd = typeof w.endTime === 'number' ? Math.max(wStart + 0.05, Math.min(rawEnd, w.endTime)) : (typeof w.end === 'number' ? Math.max(wStart + 0.05, Math.min(rawEnd, w.end)) : Math.min(rawEnd, wStart + 0.4));
                return {
                  word: String(w.word || '').trim(),
                  startTime: wStart,
                  endTime: wEnd,
                  start: wStart,
                  end: wEnd
                };
              }).filter((w: any) => w.word.length > 0)
            : [];

          if (words.length === 0 && lineText.length > 0) {
            const textTokens = lineText.split(/\s+/).filter(Boolean);
            const duration = rawEnd - rawStart;
            const tokenDuration = duration / Math.max(1, textTokens.length);
            words = textTokens.map((token: string, tIdx: number) => {
              const ts = Number((rawStart + tIdx * tokenDuration).toFixed(2));
              const te = Number((ts + tokenDuration).toFixed(2));
              return {
                word: token,
                startTime: ts,
                endTime: te,
                start: ts,
                end: te
              };
            });
          }

          return {
            id: l.id || `line-${idx}-${Date.now()}`,
            startTime: Number(rawStart.toFixed(2)),
            endTime: Number(rawEnd.toFixed(2)),
            text: lineText,
            words
          };
        })
        .filter((l: any) => l.text.length > 0)
        .sort((a: any, b: any) => a.startTime - b.startTime);

      return res.json({
        ...parsedData,
        lines: sortedLines
      });
    }

    return res.json({ text: "Transcribed Audio", lines: [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Transcription error' });
  }
});

// 7. Align (Forced Alignment)
app.post('/api/align', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3', rawLyrics, language } = req.body;
    if (!audioBase64 || !rawLyrics) {
      return res.status(400).json({ error: 'Audio data and raw lyrics text are required' });
    }

    const ai = getGeminiClient(req);
    const model = 'gemini-2.5-flash';

    const systemPrompt = `You are an expert audio engineer and precision multilingual forced audio alignment system.
You are given an audio track and the exact, user-provided lyrics.
Your objective: Align the provided lyrics line-by-line and word-by-word with the actual vocals in the audio recording to produce millisecond-accurate timestamps.

User Provided Lyrics:
${rawLyrics}

Target Language Preference: ${language || 'Auto-detect'}

CRITICAL FORCED ALIGNMENT RULES:
1. STRICT TEXT FIDELITY & PRESERVATION:
   - Match the provided lyrics text line-by-line without altering, replacing, misspelling, or translating words.
   - Do NOT omit any line from the user's provided lyrics. Every single line in the input must appear in the output "lines" array with its corresponding timestamp.
   - If a line repeats (e.g. repeated chorus), find its distinct chronological occurrence in the audio.

2. PRECISION ACOUSTIC ONSET & OFFSET:
   - startTime: The EXACT second (floating point, e.g. 14.25) where the singer articulates the first audible syllable of the line. If there is an instrumental intro, DO NOT start at 0.00s.
   - endTime: The EXACT second (e.g. 17.80) where the vocal sound decay ends or the phrase finishes.
   - For instrumental solos, breaks, and pauses between verses, do NOT place timestamps during silence.

3. WORD-LEVEL TIMESTAMPS:
   - For each line, break it down into words and provide the start and end timestamp for each word in the "words" array:
     words: [
       { "word": "First", "startTime": 14.25, "endTime": 14.70 },
       { "word": "word", "startTime": 14.75, "endTime": 15.60 }
     ]

4. STRICT CHRONOLOGICAL MONOTONICITY:
   - All lines must follow ascending chronological order: line[0].startTime <= line[1].startTime ...
   - For every line and word: startTime < endTime.

5. MULTILINGUAL ACCURACY:
   - Accurately align Korean Hangul (한국어, K-pop vocal chops & melisma), Chinese (中文 / 國語 / 粵語), Japanese (日本語), English, Spanish, and mixed-language rap/vocals.

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
      "text": "Exact lyric text line",
      "words": [
        { "word": "Exact", "startTime": 4.50, "endTime": 5.20 },
        { "word": "lyric", "startTime": 5.25, "endTime": 6.10 },
        { "word": "text", "startTime": 6.15, "endTime": 7.00 },
        { "word": "line", "startTime": 7.05, "endTime": 8.20 }
      ]
    }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
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
                  text: { type: 'STRING' },
                  words: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        word: { type: 'STRING' },
                        startTime: { type: 'NUMBER' },
                        endTime: { type: 'NUMBER' }
                      },
                      required: ['word', 'startTime', 'endTime']
                    }
                  }
                },
                required: ['startTime', 'endTime', 'text']
              }
            }
          },
          required: ['lines']
        }
      }
    });

    const parsedData = safeExtractJson(aiResponse.text || '');
    if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
      const sortedLines = parsedData.lines
        .map((l: any, idx: number) => {
          const rawStart = typeof l.startTime === 'number' && !isNaN(l.startTime) ? Math.max(0, l.startTime) : idx * 4;
          const rawEnd = typeof l.endTime === 'number' && !isNaN(l.endTime) && l.endTime > rawStart ? l.endTime : rawStart + 3.5;
          const lineText = String(l.text || '').trim();

          let words = Array.isArray(l.words) && l.words.length > 0
            ? l.words.map((w: any) => {
                const wStart = typeof w.startTime === 'number' ? Math.max(rawStart, w.startTime) : (typeof w.start === 'number' ? Math.max(rawStart, w.start) : rawStart);
                const wEnd = typeof w.endTime === 'number' ? Math.max(wStart + 0.05, Math.min(rawEnd, w.endTime)) : (typeof w.end === 'number' ? Math.max(wStart + 0.05, Math.min(rawEnd, w.end)) : Math.min(rawEnd, wStart + 0.4));
                return {
                  word: String(w.word || '').trim(),
                  startTime: wStart,
                  endTime: wEnd,
                  start: wStart,
                  end: wEnd
                };
              }).filter((w: any) => w.word.length > 0)
            : [];

          if (words.length === 0 && lineText.length > 0) {
            const textTokens = lineText.split(/\s+/).filter(Boolean);
            const duration = rawEnd - rawStart;
            const tokenDuration = duration / Math.max(1, textTokens.length);
            words = textTokens.map((token: string, tIdx: number) => {
              const ts = Number((rawStart + tIdx * tokenDuration).toFixed(2));
              const te = Number((ts + tokenDuration).toFixed(2));
              return {
                word: token,
                startTime: ts,
                endTime: te,
                start: ts,
                end: te
              };
            });
          }

          return {
            id: l.id || `align-${idx}-${Date.now()}`,
            startTime: Number(rawStart.toFixed(2)),
            endTime: Number(rawEnd.toFixed(2)),
            text: lineText,
            words
          };
        })
        .filter((l: any) => l.text.length > 0)
        .sort((a: any, b: any) => a.startTime - b.startTime);

      return res.json({
        ...parsedData,
        lines: sortedLines
      });
    }

    return res.json({ text: rawLyrics, lines: [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Alignment error' });
  }
});

// 8. Analyze (BPM, Key, Sections)
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
            { inlineData: { data: audioBase64, mimeType } },
            { text: systemPrompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsedData = safeExtractJson(aiResponse.text || '');
    if (parsedData) {
      return res.json(parsedData);
    }

    return res.json({
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
    return res.json({
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

// 9. Music Compose (Gemini AI Music & Lyrics Arranger)
app.post('/api/music/compose', async (req, res) => {
  try {
    const { prompt, genre = 'Pop', mood = 'Energetic', bpm = 120, key = 'C Major', duration = 30 } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient(req);
    const model = 'gemini-2.5-flash';

    const systemPrompt = `You are an elite music composer. Compose a musical arrangement:
Genre: ${genre}, Mood: ${mood}, BPM: ${bpm}, Key: ${key}, Duration: ${duration}s.
User Prompt: ${prompt}

Return strictly valid JSON:
{
  "title": "Song Title",
  "artist": "AI Arranger",
  "genre": "${genre}",
  "mood": "${mood}",
  "bpm": ${bpm},
  "key": "${key}",
  "timeSignature": "4/4",
  "duration": ${duration},
  "description": "Short musical description",
  "chords": [],
  "melody": [],
  "bass": [],
  "drums": [],
  "pads": [],
  "lyrics": [
    { "text": "First line of song", "startTime": 2.0, "duration": 3.0 }
  ]
}`;

    const aiResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      config: { responseMimeType: 'application/json' }
    });

    const parsed = safeExtractJson(aiResponse.text || '');
    if (parsed) {
      return res.json({ success: true, composition: parsed });
    }

    return res.status(500).json({ error: 'Failed to parse music arrangement' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Composition failed' });
  }
});

// 10. Generate Music (ACE-Step / AI Engine Compatibility)
app.post('/api/generate-music', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Music generation prompt is required' });
    }

    // Try dynamic load of ACE-Step server engine if available in environment
    try {
      const aceModule = await import('../server/aceStep');
      if (aceModule && aceModule.generateMusic) {
        const result = await aceModule.generateMusic({
          prompt: prompt.trim(),
          lyrics: typeof req.body.lyrics === 'string' ? req.body.lyrics.trim() : '',
          duration: Number(req.body.duration) || 30
        });
        return res.json(result);
      }
    } catch (importErr) {
      // Graceful fallback when running in serverless without Gradio client
    }

    return res.status(503).json({
      error: 'Direct ACE-Step music generation requires the full Node container server.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate music' });
  }
});

// 11. Render Test Endpoint (Ensures Vercel serverless returns valid JSON)
app.get('/api/render-test', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json({
    success: true,
    platform: 'vercel-serverless',
    engine: 'Browser Engine (WebCodecs / MediaRecorder)',
    message: 'Engine active: Client-side video recording ready with instant MP4 download.'
  });
});

// 12. Asset Staging Fallback (Serverless passthrough)
app.post('/api/stage-asset', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json({
    success: true,
    message: 'Client asset pipeline active'
  });
});

// 13. Export Video Job Endpoints (Graceful fallback)
app.post('/api/export-video', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json({
    success: true,
    exportId: `browser-${Date.now()}`,
    useBrowser: true,
    message: 'Client-side rendering active'
  });
});

app.get('/api/export-progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json({
    id: req.params.jobId,
    stage: 'ready',
    stageMessage: 'Ready',
    progress: 100
  });
});

export default app;
