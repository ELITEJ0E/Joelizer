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
