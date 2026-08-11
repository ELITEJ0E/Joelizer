const fs = require('fs');
let code = fs.readFileSync('src/store/useMVStore.ts', 'utf-8');

// Add types
if (!code.includes('commitTimeline: () => void;')) {
  code = code.replace('splitTimelineClip: (id: string, splitTime: number) => void;', `splitTimelineClip: (id: string, splitTime: number) => void;
  timelineHistory: TimelineClip[][];
  historyIndex: number;
  commitTimeline: () => void;
  undo: () => void;
  redo: () => void;`);
}

// Add implementations
if (!code.includes('timelineHistory: [[]]')) {
  code = code.replace("setMediaSourceFilter: (mediaSourceFilter) => set({ mediaSourceFilter }),", `setMediaSourceFilter: (mediaSourceFilter) => set({ mediaSourceFilter }),
  timelineHistory: [[]],
  historyIndex: 0,
  commitTimeline: () => set((state) => {
    const newHistory = state.timelineHistory.slice(0, state.historyIndex + 1);
    newHistory.push([...state.timelineClips]);
    if (newHistory.length > 50) newHistory.shift();
    return { timelineHistory: newHistory, historyIndex: newHistory.length - 1 };
  }),
  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      return { historyIndex: newIndex, timelineClips: state.timelineHistory[newIndex] };
    }
    return state;
  }),
  redo: () => set((state) => {
    if (state.historyIndex < state.timelineHistory.length - 1) {
      const newIndex = state.historyIndex + 1;
      return { historyIndex: newIndex, timelineClips: state.timelineHistory[newIndex] };
    }
    return state;
  }),`);
}

fs.writeFileSync('src/store/useMVStore.ts', code);
