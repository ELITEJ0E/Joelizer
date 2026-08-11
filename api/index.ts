import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { generateMusic } from '../server/aceStep.js';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
  res.json({ status: 'ok', platform: 'vercel-serverless', time: new Date().toISOString() });
});

// 2. Proxy media
app.get('/api/proxy-media', async (req, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Valid http/https target URL parameter required' });
    }

    const mediaRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

// 3. Suno Info
app.post('/api/suno-info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const trimmedUrl = url.trim();
    const uuidMatch = trimmedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    if (uuidMatch) {
      const songId = uuidMatch[0].toLowerCase();
      const pageUrl = `https://suno.com/song/${songId}`;
      const audioUrl = `https://cdn1.suno.ai/${songId}.mp3`;
      let imageUrl = `https://cdn2.suno.ai/image_large_${songId}.jpeg`;
      let title = 'Online Song';
      let artist = 'Online Track';
      let lyrics = '';
      let tags = '';

      try {
        const fetchRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const titleMatch = html.match(/"title":"([^"]+)"/);
          if (titleMatch && titleMatch[1] && titleMatch[1] !== 'Suno') title = titleMatch[1];

          const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
          if (ogImageMatch && ogImageMatch[1]) imageUrl = ogImageMatch[1];
        }
      } catch (e) {}

      return res.json({ id: songId, title, artist, audioUrl, imageUrl, lyrics, tags, source: 'suno' });
    }

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

    return res.status(400).json({ error: 'Invalid URL.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process song URL' });
  }
});

// 4. Generate Music
app.post('/api/generate-music', async (req, res) => {
  try {
    const { prompt, lyrics, duration } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Music generation prompt is required' });
    }

    const result = await generateMusic({
      prompt: prompt.trim(),
      lyrics: typeof lyrics === 'string' ? lyrics.trim() : '',
      duration: Number(duration) || 30
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate music' });
  }
});

// 5. Transcribe
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3', language, prompt } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'Audio data is required' });

    const ai = getGeminiClient(req);
    const model = 'gemini-2.5-flash';

    const systemPrompt = `You are an elite, highly accurate multilingual music transcription system.
Target Language: ${language || 'Auto-detect'}.
Extra User Guidance: ${prompt || 'None'}.
Return strictly JSON matching schema:
{
  "text": "Full text",
  "language": "Detected language",
  "bpm": 120,
  "key": "C Major",
  "lines": [
    { "id": "line-1", "startTime": 4.25, "endTime": 7.80, "text": "Lyric line text" }
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
        responseMimeType: 'application/json'
      }
    });

    const parsedData = safeExtractJson(aiResponse.text || '');
    if (parsedData && Array.isArray(parsedData.lines)) {
      return res.json(parsedData);
    }

    res.json({ text: "Transcribed Audio", lines: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transcription error' });
  }
});

// 6. Align
app.post('/api/align', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3', rawLyrics, language } = req.body;
    if (!audioBase64 || !rawLyrics) {
      return res.status(400).json({ error: 'Audio data and raw lyrics text are required' });
    }

    const ai = getGeminiClient(req);
    const model = 'gemini-2.5-flash';

    const systemPrompt = `Forced alignment engine. Listen to audio and assign startTime and endTime to provided lyrics line-by-line.
User Lyrics:
${rawLyrics}

Return strictly JSON:
{
  "text": ${JSON.stringify(rawLyrics)},
  "lines": [
    { "id": "line-1", "startTime": 4.50, "endTime": 8.20, "text": "User lyric text line" }
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
        responseMimeType: 'application/json'
      }
    });

    const parsedData = safeExtractJson(aiResponse.text || '');
    if (parsedData && Array.isArray(parsedData.lines)) {
      return res.json(parsedData);
    }

    res.json({ text: rawLyrics, lines: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Alignment error' });
  }
});

export default app;
