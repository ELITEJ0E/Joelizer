import { useStore } from '../store/useStore';
import { useMVStore, TimelineClip, TimelineText } from '../store/useMVStore';
import { useLyricsVideoStore } from '../store/useLyricsVideoStore';
import { LyricLine, LyricsSettings, BackgroundSettings, VisualizerSettings } from '../store/useStore';
import { useEffect, useState } from 'react';

export interface GlobalProjectSnapshot {
  timestamp: number;
  description: string;
  // MV Studio state
  timelineClips: TimelineClip[];
  wordTimings: TimelineText[];
  // Main Store state
  lyricsLines: LyricLine[];
  lyricsSettings: LyricsSettings;
  backgroundSettings: BackgroundSettings;
  visualizerSettings: VisualizerSettings;
  // Lyrics Video state
  selectedTemplateId?: string;
  typographyOverride?: any;
  customBackground?: any;
  artworkOverride?: any;
  animationOverride?: any;
  elementPositions?: any;
}

class GlobalHistoryManager {
  private undoStack: GlobalProjectSnapshot[] = [];
  private redoStack: GlobalProjectSnapshot[] = [];
  private maxHistory = 60;
  private isApplyingHistory = false;
  private listeners: Set<() => void> = new Set();
  private lastSnapshotTime = 0;

  private captureCurrentState(description: string = 'Edit'): GlobalProjectSnapshot {
    const mainState = useStore.getState();
    const mvState = useMVStore.getState();
    const lyricsVideoState = useLyricsVideoStore.getState();

    return {
      timestamp: Date.now(),
      description,
      timelineClips: JSON.parse(JSON.stringify(mvState.timelineClips || [])),
      wordTimings: JSON.parse(JSON.stringify(mvState.wordTimings || [])),
      lyricsLines: JSON.parse(JSON.stringify(mainState.lyricsSettings?.lines || [])),
      lyricsSettings: JSON.parse(JSON.stringify(mainState.lyricsSettings || {})),
      backgroundSettings: JSON.parse(JSON.stringify(mainState.backgroundSettings || {})),
      visualizerSettings: JSON.parse(JSON.stringify(mainState.visualizerSettings || {})),
      selectedTemplateId: lyricsVideoState.selectedTemplateId,
      typographyOverride: JSON.parse(JSON.stringify(lyricsVideoState.typographyOverride || {})),
      customBackground: JSON.parse(JSON.stringify(lyricsVideoState.customBackground || {})),
      artworkOverride: JSON.parse(JSON.stringify(lyricsVideoState.artworkOverride || {})),
      animationOverride: JSON.parse(JSON.stringify(lyricsVideoState.animationOverride || {})),
      elementPositions: JSON.parse(JSON.stringify(lyricsVideoState.elementPositions || {})),
    };
  }

  public recordSnapshot(description: string = 'Edit', debounceMs: number = 0): void {
    if (this.isApplyingHistory) return;

    const now = Date.now();
    if (debounceMs > 0 && now - this.lastSnapshotTime < debounceMs && this.undoStack.length > 0) {
      // Update top of stack
      this.undoStack[this.undoStack.length - 1] = this.captureCurrentState(description);
      this.notifyListeners();
      return;
    }

    const snapshot = this.captureCurrentState(description);
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.lastSnapshotTime = now;
    this.notifyListeners();
  }

  public undo(): boolean {
    if (this.undoStack.length <= 1) return false;

    this.isApplyingHistory = true;
    try {
      // Pop current state onto redo
      const current = this.undoStack.pop()!;
      this.redoStack.push(current);

      // Peek previous state and apply
      const previous = this.undoStack[this.undoStack.length - 1];
      if (previous) {
        this.applySnapshot(previous);
      }
    } finally {
      this.isApplyingHistory = false;
      this.notifyListeners();
    }
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;

    this.isApplyingHistory = true;
    try {
      const next = this.redoStack.pop()!;
      this.undoStack.push(next);
      this.applySnapshot(next);
    } finally {
      this.isApplyingHistory = false;
      this.notifyListeners();
    }
    return true;
  }

  private applySnapshot(snapshot: GlobalProjectSnapshot): void {
    // 1. Restore MV Store (Clips and word timings)
    useMVStore.setState({
      timelineClips: JSON.parse(JSON.stringify(snapshot.timelineClips || [])),
      wordTimings: JSON.parse(JSON.stringify(snapshot.wordTimings || [])),
    });

    // 2. Restore Main Store (Lyrics, background, visualizer)
    useStore.setState({
      lyricsSettings: {
        ...useStore.getState().lyricsSettings,
        ...(snapshot.lyricsSettings || {}),
        lines: JSON.parse(JSON.stringify(snapshot.lyricsLines || snapshot.lyricsSettings?.lines || [])),
      },
      backgroundSettings: JSON.parse(JSON.stringify(snapshot.backgroundSettings || useStore.getState().backgroundSettings)),
      visualizerSettings: JSON.parse(JSON.stringify(snapshot.visualizerSettings || useStore.getState().visualizerSettings)),
    });

    // 3. Restore Lyrics Video Store
    useLyricsVideoStore.setState({
      selectedTemplateId: (snapshot.selectedTemplateId as any) || useLyricsVideoStore.getState().selectedTemplateId,
      typographyOverride: JSON.parse(JSON.stringify(snapshot.typographyOverride || useLyricsVideoStore.getState().typographyOverride)),
      customBackground: JSON.parse(JSON.stringify(snapshot.customBackground || useLyricsVideoStore.getState().customBackground)),
      artworkOverride: JSON.parse(JSON.stringify(snapshot.artworkOverride || useLyricsVideoStore.getState().artworkOverride)),
      animationOverride: JSON.parse(JSON.stringify(snapshot.animationOverride || useLyricsVideoStore.getState().animationOverride)),
      elementPositions: JSON.parse(JSON.stringify(snapshot.elementPositions || useLyricsVideoStore.getState().elementPositions)),
    });
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in global history listener:', err);
      }
    });
  }

  public initIfEmpty(): void {
    if (this.undoStack.length === 0) {
      this.undoStack.push(this.captureCurrentState('Initial State'));
      this.notifyListeners();
    }
  }
}

export const globalHistory = new GlobalHistoryManager();

// Initialize first snapshot on load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    globalHistory.initIfEmpty();
  }, 100);
}

/**
 * React hook for consuming global undo/redo states
 */
export function useGlobalHistory() {
  const [canUndo, setCanUndo] = useState(globalHistory.canUndo());
  const [canRedo, setCanRedo] = useState(globalHistory.canRedo());

  useEffect(() => {
    globalHistory.initIfEmpty();
    const unsubscribe = globalHistory.subscribe(() => {
      setCanUndo(globalHistory.canUndo());
      setCanRedo(globalHistory.canRedo());
    });
    return unsubscribe;
  }, []);

  return {
    canUndo,
    canRedo,
    undo: () => globalHistory.undo(),
    redo: () => globalHistory.redo(),
    recordSnapshot: (desc?: string, debounce?: number) => globalHistory.recordSnapshot(desc, debounce),
  };
}
