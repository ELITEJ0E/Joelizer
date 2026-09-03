import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LyricLine } from "../store/useStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function parseLRC(text: string): LyricLine[] {
  const lines = text.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const timestamps: number[] = [];
    let match;
    timeRegex.lastIndex = 0;
    
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const seconds = min * 60 + sec + (ms / (match[3].length === 3 ? 1000 : 100));
      timestamps.push(seconds);
    }
    
    const cleanText = line.replace(/\[\d{2}:\d{2}[.:]\d{2,3}\]/g, '').trim();
    if (cleanText) {
      for (const time of timestamps) {
        result.push({
          id: `l_${result.length}_${Math.random().toString(36).substring(2, 6)}`,
          text: cleanText,
          startTime: time,
          endTime: time + 3.5 // temp default
        });
      }
    }
  }
  
  result.sort((a, b) => a.startTime - b.startTime);
  
  // Refine endtimes to match starttimes
  for (let i = 0; i < result.length; i++) {
    if (i < result.length - 1) {
      result[i].endTime = result[i + 1].startTime;
    } else {
      result[i].endTime = result[i].startTime + 5.0;
    }
  }
  
  return result;
}

export function getStreamableAudioUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/api/suno-audio/')) return trimmed;

  // Extract Suno clip UUID if present in URL
  const sunoMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (sunoMatch && (trimmed.includes('suno') || trimmed.includes('cloudfront') || trimmed.includes('/song/') || trimmed.includes('cdn1.suno.ai') || trimmed.includes('cdn2.suno.ai'))) {
    return `/api/suno-audio/${sunoMatch[0].toLowerCase()}.m4a`;
  }

  // If it is another remote HTTP URL, proxy it to avoid CORS issues
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!trimmed.includes('/api/proxy-media') && !trimmed.includes('/api/suno-audio')) {
      return `/api/proxy-media?url=${encodeURIComponent(trimmed)}`;
    }
  }

  return trimmed;
}
