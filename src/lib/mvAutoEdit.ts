import { LyricLine } from '../store/useStore';
import { MediaAsset, TimelineClip, TimelineText, SongAnalysis } from '../store/useMVStore';

export interface AutoEditOptions {
  songDuration: number;
  lyricsLines: LyricLine[];
  mediaAssets: MediaAsset[];
  style: string;
  pacing: string;
  beatSync: string;
  seed: number;
  existingClips?: TimelineClip[];
  songAnalysis?: SongAnalysis | null;
  bpm?: number;
}

// Simple deterministic PRNG for seed-based generation
function createPRNG(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const MOTION_EFFECTS = [
  'ken-burns-in',
  'ken-burns-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down'
] as const;

export function generateAutoEdit(options: AutoEditOptions): {
  timelineClips: TimelineClip[];
  wordTimings: TimelineText[];
  songAnalysis: SongAnalysis;
} {
  const {
    songDuration = 60,
    lyricsLines = [],
    mediaAssets = [],
    style = 'Cinematic',
    pacing = 'Balanced',
    beatSync = 'Strong',
    seed = 12345,
    existingClips = [],
    songAnalysis: existingAnalysis = null,
    bpm: inputBpm = 120
  } = options;

  const rand = createPRNG(seed);

  // 1. Determine Song Analysis & Sections
  const bpm = existingAnalysis?.bpm || inputBpm || 120;
  const beatInterval = 60 / bpm; // duration of 1 beat in seconds

  const sections = existingAnalysis?.sections && existingAnalysis.sections.length > 0
    ? existingAnalysis.sections
    : [
        { title: 'Intro', startTime: 0, endTime: Math.min(10, songDuration * 0.12) },
        { title: 'Verse 1', startTime: Math.min(10, songDuration * 0.12), endTime: songDuration * 0.35 },
        { title: 'Pre-Chorus', startTime: songDuration * 0.35, endTime: songDuration * 0.45 },
        { title: 'Chorus 1', startTime: songDuration * 0.45, endTime: songDuration * 0.62 },
        { title: 'Verse 2 / Bridge', startTime: songDuration * 0.62, endTime: songDuration * 0.78 },
        { title: 'Final Chorus', startTime: songDuration * 0.78, endTime: songDuration * 0.92 },
        { title: 'Outro', startTime: songDuration * 0.92, endTime: songDuration }
      ];

  const songAnalysis: SongAnalysis = {
    bpm,
    key: existingAnalysis?.key || 'C Major',
    language: existingAnalysis?.language || 'English',
    sections
  };

  // 2. Process Word Timings & Line Timings
  const wordTimings: TimelineText[] = [];
  if (lyricsLines.length > 0) {
    const hasTimestamps = lyricsLines.some(l => l.startTime > 0 || l.endTime > 0);

    lyricsLines.forEach((line, idx) => {
      let lineStart = line.startTime;
      let lineEnd = line.endTime;

      if (!hasTimestamps) {
        // Distribute lines across song duration leaving intro and outro space
        const activeStart = Math.min(8, songDuration * 0.1);
        const activeEnd = Math.max(songDuration - 8, songDuration * 0.9);
        const lineDur = (activeEnd - activeStart) / lyricsLines.length;
        lineStart = activeStart + idx * lineDur;
        lineEnd = lineStart + lineDur * 0.9;
      }

      if (lineEnd <= lineStart) lineEnd = lineStart + 3.0;

      const wordsArr = line.text.trim().split(/\s+/).filter(Boolean);
      const wordCount = wordsArr.length || 1;
      const totalDuration = lineEnd - lineStart;
      const wordDuration = totalDuration / wordCount;

      const words = wordsArr.map((w, wIdx) => ({
        word: w,
        start: lineStart + wIdx * wordDuration,
        end: lineStart + (wIdx + 0.95) * wordDuration
      }));

      wordTimings.push({
        id: line.id || `line-${idx}`,
        text: line.text,
        startTime: lineStart,
        endTime: lineEnd,
        words
      });
    });
  }

  // 3. Generate Timeline Clips
  if (mediaAssets.length === 0 || songDuration <= 0) {
    return { timelineClips: existingClips, wordTimings, songAnalysis };
  }

  // Pacing multipliers
  const pacingMult = pacing === 'Fast' ? 0.65 : pacing === 'Slow' ? 1.6 : 1.0;

  // Filter out locked clips from existingClips
  const lockedClips = existingClips.filter(c => c.locked);

  const timelineClips: TimelineClip[] = [...lockedClips];

  let currentTime = 0;
  let clipIdCounter = 0;
  let prevAssetId: string | null = null;
  let prevAssetId2: string | null = null;

  while (currentTime < songDuration - 0.1) {
    // Check if current time overlaps with an existing locked clip
    const lockedAtTime = lockedClips.find(
      c => currentTime >= c.startTime - 0.05 && currentTime < c.endTime - 0.05
    );

    if (lockedAtTime) {
      // Skip ahead to the end of the locked clip
      currentTime = lockedAtTime.endTime;
      prevAssetId = lockedAtTime.assetId;
      continue;
    }

    // Determine current song section
    const currentSection = sections.find(
      s => currentTime >= s.startTime && currentTime < s.endTime
    ) || sections[sections.length - 1];

    const secTitle = currentSection?.title?.toLowerCase() || '';

    // Calculate base shot duration range for this section
    let minDur = 2.5;
    let maxDur = 5.0;

    if (secTitle.includes('intro') || secTitle.includes('outro')) {
      minDur = 3.2;
      maxDur = 6.5;
    } else if (secTitle.includes('chorus')) {
      minDur = 0.8;
      maxDur = 2.2;
    } else if (secTitle.includes('pre-chorus')) {
      minDur = 1.2;
      maxDur = 3.0;
    } else if (secTitle.includes('verse')) {
      minDur = 2.2;
      maxDur = 4.8;
    }

    // Adjust for pacing and style
    if (style === 'K-pop' || style === 'Y2K' || style === 'Fast') {
      minDur *= 0.7;
      maxDur *= 0.7;
    } else if (style === 'Cinematic' || style === 'Dreamy' || style === 'Slow') {
      minDur *= 1.3;
      maxDur *= 1.3;
    }

    minDur *= pacingMult;
 maxDur *= pacingMult;
    minDur = Math.max(0.5, minDur);
    maxDur = Math.max(minDur + 0.3, maxDur);

    // Randomize duration in range [minDur, maxDur]
    let shotDur = minDur + rand() * (maxDur - minDur);

    // Beat snapping if beatSync is enabled
    if (beatSync === 'Strong') {
      // Snap to nearest beat or half-beat interval
      const beatsCount = Math.max(1, Math.round(shotDur / beatInterval));
      shotDur = beatsCount * beatInterval;
    } else if (beatSync === 'Loose') {
      const beatsCount = Math.max(1, Math.round(shotDur / beatInterval));
      shotDur = beatsCount * beatInterval + (rand() * 0.4 - 0.2);
    }

    // Ensure we don't bleed past the next locked clip
    const nextLocked = lockedClips
      .filter(c => c.startTime > currentTime)
      .sort((a, b) => a.startTime - b.startTime)[0];

    if (nextLocked && currentTime + shotDur > nextLocked.startTime) {
      shotDur = nextLocked.startTime - currentTime;
    }

    // Ensure we don't bleed past song duration
    if (currentTime + shotDur > songDuration) {
      shotDur = songDuration - currentTime;
    }

    if (shotDur < 0.2) {
      currentTime = nextLocked ? nextLocked.endTime : songDuration;
      continue;
    }

    // Select Media Asset (Weighted selection avoiding recent assets)
    let candidateAssets = mediaAssets;
    if (mediaAssets.length > 2) {
      const filtered = mediaAssets.filter(
        a => a.id !== prevAssetId && a.id !== prevAssetId2
      );
      if (filtered.length > 0) candidateAssets = filtered;
    } else if (mediaAssets.length === 2 && prevAssetId) {
      const filtered = mediaAssets.filter(a => a.id !== prevAssetId);
      if (filtered.length > 0) candidateAssets = filtered;
    }

    const assetIdx = Math.floor(rand() * candidateAssets.length);
    const asset = candidateAssets[assetIdx] || mediaAssets[0];

    prevAssetId2 = prevAssetId;
    prevAssetId = asset.id;

    // Calculate trim points for asset
    const mediaType = asset.mediaType || 'video';
    let trimStart = 0;
    let trimEnd = shotDur;

    if (mediaType === 'video') {
      const assetDur = asset.duration || 10;
      if (assetDur > shotDur) {
        const maxTrimStart = assetDur - shotDur;
        trimStart = rand() * maxTrimStart;
      }
      trimEnd = trimStart + shotDur;
    } else {
      // Image
      trimStart = 0;
      trimEnd = shotDur;
    }

    const motionEffectIdx = Math.floor(rand() * MOTION_EFFECTS.length);
    const effect = mediaType === 'image' ? MOTION_EFFECTS[motionEffectIdx] : 'none';

    timelineClips.push({
      id: `clip-gen-${Date.now()}-${clipIdCounter++}`,
      assetId: asset.id,
      startTime: currentTime,
      endTime: currentTime + shotDur,
      trimStart,
      trimEnd,
      mediaType,
      effect,
      transition: rand() > 0.7 ? 'dissolve' : 'cut'
    });

    currentTime += shotDur;
  }

  // Sort timeline clips chronologically
  timelineClips.sort((a, b) => a.startTime - b.startTime);

  return {
    timelineClips,
    wordTimings,
    songAnalysis
  };
}
