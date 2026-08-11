const fs = require('fs');
let code = fs.readFileSync('src/components/MVStudio/MVTimeline.tsx', 'utf-8');

if (!code.includes('commitTimeline')) {
  // Import commitTimeline, undo, redo
  code = code.replace('const addTimelineClip = useMVStore(s => s.addTimelineClip);', `const addTimelineClip = useMVStore(s => s.addTimelineClip);
  const commitTimeline = useMVStore(s => s.commitTimeline);
  const undo = useMVStore(s => s.undo);
  const redo = useMVStore(s => s.redo);`);

  // Hook for Ctrl+Z, Ctrl+Y
  code = code.replace('const handleMouseUp = () => {', `const handleMouseUp = () => {
      commitTimeline();`);

  code = code.replace('const [zoom, setZoom] = useState(1);', `const [zoom, setZoom] = useState(1);

  // Undo / Redo Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
`);

  // Add commitTimeline to Drop
  code = code.replace(/mediaType: asset\.mediaType\n\s*\}\);\n\s*\};/, `mediaType: asset.mediaType
    });
    commitTimeline();
  };`);
  
  // Add commit to Split / Remove
  code = code.replace('splitTimelineClip(selectedClip.id, currentTime);', `splitTimelineClip(selectedClip.id, currentTime);
                  commitTimeline();`);
  code = code.replace('removeTimelineClip(selectedClip.id);', `removeTimelineClip(selectedClip.id);
                  commitTimeline();`);
  code = code.replace('toggleLockClip(selectedClip.id);', `toggleLockClip(selectedClip.id);
                  commitTimeline();`);
  
  fs.writeFileSync('src/components/MVStudio/MVTimeline.tsx', code);
  console.log("Reapplied");
} else {
  console.log("Already there");
}
