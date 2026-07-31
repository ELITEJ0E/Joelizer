import { LyricLineWithWords, SongAnalysis } from '../types/studio';
import JSZip from 'jszip';

// Format seconds into [MM:SS.xx] for LRC
export function formatLRCStamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xx = String(hundredths).padStart(2, '0');
  
  return `[${mm}:${ss}.${xx}]`;
}

// Format seconds into <MM:SS.xx> for Word-Level Enhanced LRC
export function formatWordStamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xx = String(hundredths).padStart(2, '0');
  
  return `<${mm}:${ss}.${xx}>`;
}

// Format seconds into HH:MM:SS,mmm for SRT Subtitles
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

// Format seconds into H:MM:SS.xx for ASS Subtitles
export function formatASSTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100); // centiseconds

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xx = String(cs).padStart(2, '0');

  return `${hrs}:${mm}:${ss}.${xx}`;
}

// Generate Standard LRC
export function generateLRC(lines: LyricLineWithWords[], title?: string, artist?: string): string {
  let lrc = '';
  if (title) lrc += `[ti:${title}]\n`;
  if (artist) lrc += `[ar:${artist}]\n`;
  lrc += `[by:Joelizer AI Studio]\n\n`;

  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  sorted.forEach(line => {
    lrc += `${formatLRCStamp(line.startTime)}${line.text}\n`;
  });

  return lrc;
}

// Generate Enhanced Word-Level Karaoke LRC
export function generateEnhancedLRC(lines: LyricLineWithWords[], title?: string, artist?: string): string {
  let lrc = '';
  if (title) lrc += `[ti:${title}]\n`;
  if (artist) lrc += `[ar:${artist}]\n`;
  lrc += `[by:Joelizer AI Studio - Enhanced Word Karaoke]\n\n`;

  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  sorted.forEach(line => {
    lrc += `${formatLRCStamp(line.startTime)}`;
    if (line.words && line.words.length > 0) {
      line.words.forEach(w => {
        lrc += `${formatWordStamp(w.startTime)}${w.word} `;
      });
      lrc = lrc.trimEnd();
    } else {
      lrc += line.text;
    }
    lrc += `\n`;
  });

  return lrc;
}

// Generate SRT Subtitle file
export function generateSRT(lines: LyricLineWithWords[]): string {
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  let srt = '';

  sorted.forEach((line, index) => {
    const end = line.endTime && line.endTime > line.startTime ? line.endTime : line.startTime + 3.5;
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(line.startTime)} --> ${formatSRTTime(end)}\n`;
    srt += `${line.text}\n\n`;
  });

  return srt.trim();
}

// Generate ASS (Advanced SubStation Alpha) with Joelizer Neon Green styling
export function generateASS(lines: LyricLineWithWords[], title = 'Joelizer Lyrics'): string {
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  
  let ass = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,28,&H0000E676,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,2,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  sorted.forEach(line => {
    const end = line.endTime && line.endTime > line.startTime ? line.endTime : line.startTime + 3.5;
    const startStr = formatASSTime(line.startTime);
    const endStr = formatASSTime(end);
    ass += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${line.text}\n`;
  });

  return ass;
}

// Generate Plain Text (TXT)
export function generateTXT(lines: LyricLineWithWords[]): string {
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  return sorted.map(l => l.text).join('\n');
}

// Generate Structured JSON
export function generateJSON(lines: LyricLineWithWords[], analysis?: SongAnalysis): string {
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  return JSON.stringify({
    metadata: {
      generator: 'Joelizer AI Lyrics Studio',
      generatedAt: new Date().toISOString(),
      analysis: analysis || {}
    },
    lyrics: sorted
  }, null, 2);
}

// Generate All Formats in ZIP
export async function generateZIP(lines: LyricLineWithWords[], projectName = 'joelizer-lyrics', analysis?: SongAnalysis): Promise<Blob> {
  const zip = new JSZip();
  const folderName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  zip.file(`${folderName}.lrc`, generateLRC(lines, projectName));
  zip.file(`${folderName}-enhanced.lrc`, generateEnhancedLRC(lines, projectName));
  zip.file(`${folderName}.srt`, generateSRT(lines));
  zip.file(`${folderName}.ass`, generateASS(lines, projectName));
  zip.file(`${folderName}.txt`, generateTXT(lines));
  zip.file(`${folderName}.json`, generateJSON(lines, analysis));

  return await zip.generateAsync({ type: 'blob' });
}

// Browser Trigger Download Helper
export function downloadFile(content: string | Blob, fileName: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
