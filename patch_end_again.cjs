const fs = require('fs');
let code = fs.readFileSync('src/store/useMVStore.ts', 'utf-8');
code = code.replace(/\}\)\)\);\s*$/, `}), {
  name: 'mv-studio-storage',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    videoAssets: state.videoAssets.map(asset => ({
      ...asset,
      file: undefined
    })).filter(asset => asset.url && !asset.url.startsWith('blob:')),
    timelineClips: state.timelineClips,
    style: state.style,
    pacing: state.pacing,
    beatSync: state.beatSync,
    editSeed: state.editSeed,
    mediaSourceFilter: state.mediaSourceFilter,
    songAnalysis: state.songAnalysis,
    wordTimings: state.wordTimings,
    aiMusicPrompt: state.aiMusicPrompt
  })
}));
`);
// If the above replace didn't work because it's only `}));`, let's do both
code = code.replace(/\}\)\);\s*$/, `}), {
  name: 'mv-studio-storage',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    videoAssets: state.videoAssets.map(asset => ({
      ...asset,
      file: undefined
    })).filter(asset => asset.url && !asset.url.startsWith('blob:')),
    timelineClips: state.timelineClips,
    style: state.style,
    pacing: state.pacing,
    beatSync: state.beatSync,
    editSeed: state.editSeed,
    mediaSourceFilter: state.mediaSourceFilter,
    songAnalysis: state.songAnalysis,
    wordTimings: state.wordTimings,
    aiMusicPrompt: state.aiMusicPrompt
  })
}));
`);
fs.writeFileSync('src/store/useMVStore.ts', code);
