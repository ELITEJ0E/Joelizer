import { TimelineClip, TimelineText, SongAnalysis } from '../store/useMVStore';
import { LyricLine } from '../store/useStore';

export interface SnapTarget {
  time: number;
  type: 'playhead' | 'clip' | 'lyric' | 'word' | 'beat' | 'section';
  label: string;
}

export interface SnapResult {
  snappedTime: number;
  isSnapped: boolean;
  target?: SnapTarget;
}

/**
 * Collect all active magnetic snap targets across the timeline
 */
export function collectSnapTargets(params: {
  currentTime: number;
  duration: number;
  clips: TimelineClip[];
  lyrics: LyricLine[] | TimelineText[];
  songAnalysis?: SongAnalysis | null;
  ignoreClipId?: string;
  ignoreLyricId?: string;
  includeWords?: boolean;
}): SnapTarget[] {
  const { currentTime, duration, clips, lyrics, songAnalysis, ignoreClipId, ignoreLyricId, includeWords } = params;
  const targets: SnapTarget[] = [];
  const seenTimes = new Set<number>();

  const addTarget = (time: number, type: SnapTarget['type'], label: string) => {
    const rounded = Number(time.toFixed(3));
    if (rounded < 0 || rounded > duration) return;
    if (seenTimes.has(rounded)) return;
    seenTimes.add(rounded);
    targets.push({ time: rounded, type, label });
  };

  // 1. Playhead position
  addTarget(currentTime, 'playhead', `Playhead (${currentTime.toFixed(2)}s)`);

  // 2. Timeline Start & End
  addTarget(0, 'clip', 'Timeline Start');
  addTarget(duration, 'clip', 'Timeline End');

  // 3. Other Visual Clips
  clips.forEach((clip) => {
    if (clip.id === ignoreClipId) return;
    addTarget(clip.startTime, 'clip', `Clip Start (${clip.startTime.toFixed(2)}s)`);
    addTarget(clip.endTime, 'clip', `Clip End (${clip.endTime.toFixed(2)}s)`);
  });

  // 4. Lyric Lines & Words
  lyrics.forEach((line) => {
    if (line.id === ignoreLyricId) return;
    addTarget(line.startTime, 'lyric', `Lyric "${(line.text || '').slice(0, 15)}..." Start`);
    addTarget(line.endTime, 'lyric', `Lyric "${(line.text || '').slice(0, 15)}..." End`);

    if (includeWords && line.words && line.words.length > 0) {
      line.words.forEach((w: any) => {
        const wStart = w.start ?? w.startTime;
        const wEnd = w.end ?? w.endTime;
        if (wStart !== undefined) addTarget(wStart, 'word', `Word "${w.word}" Start`);
        if (wEnd !== undefined) addTarget(wEnd, 'word', `Word "${w.word}" End`);
      });
    }
  });

  // 5. Song Analysis: Section Markers
  if (songAnalysis && songAnalysis.sections) {
    songAnalysis.sections.forEach((sec) => {
      addTarget(sec.startTime, 'section', `Section: ${sec.title}`);
      addTarget(sec.endTime, 'section', `Section: ${sec.title} End`);
    });
  }

  // 6. Beat Markers
  const bpm = songAnalysis?.bpm || 120;
  if (bpm > 30 && bpm < 300 && duration > 0) {
    const beatInterval = 60 / bpm;
    // Generate snap points for main beats (quarter notes or bar start)
    const totalBeats = Math.min(600, Math.floor(duration / beatInterval));
    for (let i = 0; i <= totalBeats; i++) {
      const beatTime = i * beatInterval;
      if (i % 4 === 0) {
        addTarget(beatTime, 'beat', `Bar ${Math.floor(i / 4) + 1}`);
      } else {
        addTarget(beatTime, 'beat', `Beat ${(i % 4) + 1}`);
      }
    }
  }

  return targets;
}

/**
 * Finds closest snap target within snapping threshold
 */
export function calculateSnap(
  targetTime: number,
  snapTargets: SnapTarget[],
  thresholdSeconds: number = 0.15
): SnapResult {
  let closestTarget: SnapTarget | null = null;
  let minDiff = thresholdSeconds;

  for (const target of snapTargets) {
    const diff = Math.abs(target.time - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestTarget = target;
    }
  }

  if (closestTarget) {
    return {
      snappedTime: closestTarget.time,
      isSnapped: true,
      target: closestTarget,
    };
  }

  return {
    snappedTime: targetTime,
    isSnapped: false,
  };
}
