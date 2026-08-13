with open('src/lib/lyricsTemplates.ts', 'r') as f:
    text = f.read()

prefix = text.split("export const LYRIC_VIDEO_TEMPLATES: Record<LyricTemplateId, LyricVideoTemplate> = {")[0]

new_templates = """export const LYRIC_VIDEO_TEMPLATES: Record<LyricTemplateId, LyricVideoTemplate> = {
  full: {
    id: 'full', name: 'Full Cover', description: '', category: 'Dynamic', previewColor: '#ec4899',
    layout: { lyricPosition: 'center', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'none', artworkPosition: 'background-blur', artworkAnim: 'none', showSongTitle: false, showArtist: false, titlePosition: 'corner' },
    typography: { fontFamily: 'Outfit', fontWeight: '900', fontSizeScale: 1.4, textColor: '#ffffff', activeWordColor: '#f472b6', inactiveWordColor: 'rgba(255, 255, 255, 0.45)', glowColor: '#db2777', shadowColor: 'rgba(0,0,0,0.95)', showContainerPill: false, pillBgColor: 'transparent' },
    animations: { lineAnimation: 'scale', wordAnimation: 'word-pop', intensity: 1.4 },
    defaultBackground: { type: 'blurred-artwork', presetName: 'Aurora', value: '#0f172a' }
  },
  square: {
    id: 'square', name: 'Square Card', description: '', category: 'Modern', previewColor: '#3b82f6',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'square', artworkPosition: 'top-center', artworkAnim: 'pulse', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Inter', fontWeight: '800', fontSizeScale: 1.0, textColor: '#ffffff', activeWordColor: '#38bdf8', inactiveWordColor: 'rgba(255, 255, 255, 0.65)', glowColor: '#0284c7', shadowColor: 'rgba(0,0,0,0.8)', showContainerPill: true, pillBgColor: 'rgba(0, 0, 0, 0.65)' },
    animations: { lineAnimation: 'fade', wordAnimation: 'word-color', intensity: 1.0 },
    defaultBackground: { type: 'gradient', presetName: 'Sunset', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }
  },
  circle: {
    id: 'circle', name: 'Circle Card', description: '', category: 'Modern', previewColor: '#f472b6',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'circle', artworkPosition: 'top-center', artworkAnim: 'float', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Plus Jakarta Sans', fontWeight: '700', fontSizeScale: 1.05, textColor: '#fce7f3', activeWordColor: '#f9a8d4', inactiveWordColor: 'rgba(252, 231, 243, 0.65)', glowColor: '#ec4899', shadowColor: 'rgba(0,0,0,0.7)', showContainerPill: true, pillBgColor: 'rgba(131, 24, 67, 0.4)' },
    animations: { lineAnimation: 'stagger', wordAnimation: 'word-glow', intensity: 1.1 },
    defaultBackground: { type: 'gradient', presetName: 'Dreamy', value: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)' }
  },
  vinyl: {
    id: 'vinyl', name: 'Vinyl Record', description: '', category: 'Retro', previewColor: '#f59e0b', badge: 'Popular',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'vinyl', artworkPosition: 'top-center', artworkAnim: 'rotate', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Outfit', fontWeight: '700', fontSizeScale: 1.05, textColor: '#ffffff', activeWordColor: '#fef08a', inactiveWordColor: 'rgba(255, 255, 255, 0.7)', glowColor: '#eab308', shadowColor: 'rgba(0,0,0,0.9)', showContainerPill: true, pillBgColor: 'rgba(10, 10, 12, 0.85)' },
    animations: { lineAnimation: 'slide-up', wordAnimation: 'karaoke', intensity: 1.0 },
    defaultBackground: { type: 'blurred-artwork', presetName: 'Sunset', value: '#18181b' }
  },
  cd: {
    id: 'cd', name: 'CD Disc', description: '', category: 'Dynamic', previewColor: '#10b981',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'cd', artworkPosition: 'top-center', artworkAnim: 'rotate', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Outfit', fontWeight: '800', fontSizeScale: 1.0, textColor: '#ffffff', activeWordColor: '#34d399', inactiveWordColor: 'rgba(255, 255, 255, 0.6)', glowColor: '#059669', shadowColor: 'rgba(0,0,0,0.85)', showContainerPill: true, pillBgColor: 'rgba(6, 78, 59, 0.4)' },
    animations: { lineAnimation: 'wave', wordAnimation: 'word-glow', intensity: 1.2 },
    defaultBackground: { type: 'particles', presetName: 'Aurora', value: '#022c22' }
  },
  'vinyl-needle': {
    id: 'vinyl-needle', name: 'Vinyl & Needle', description: '', category: 'Retro', previewColor: '#eab308',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'vinyl-needle', artworkPosition: 'top-center', artworkAnim: 'rotate', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Inter', fontWeight: '900', fontSizeScale: 1.15, textColor: '#ffffff', activeWordColor: '#fde047', inactiveWordColor: 'rgba(255, 255, 255, 0.85)', glowColor: '#ca8a04', shadowColor: 'rgba(0,0,0,0.95)', showContainerPill: true, pillBgColor: 'rgba(0, 0, 0, 0.8)' },
    animations: { lineAnimation: 'slide-up', wordAnimation: 'karaoke', intensity: 1.0 },
    defaultBackground: { type: 'gradient', presetName: 'Sunset', value: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }
  },
  'cd-needle': {
    id: 'cd-needle', name: 'CD & Needle', description: '', category: 'Dynamic', previewColor: '#06b6d4',
    layout: { lyricPosition: 'bottom', lyricAlignment: 'center', maxLines: 2, showNextLine: true, showPrevLine: false, artworkType: 'cd-needle', artworkPosition: 'top-center', artworkAnim: 'rotate', showSongTitle: true, showArtist: true, titlePosition: 'below-artwork' },
    typography: { fontFamily: 'Space Grotesk', fontWeight: '800', fontSizeScale: 1.1, textColor: '#ffffff', activeWordColor: '#22d3ee', inactiveWordColor: 'rgba(255, 255, 255, 0.5)', glowColor: '#0891b2', shadowColor: 'rgba(6, 182, 212, 0.9)', showContainerPill: true, pillBgColor: 'rgba(8, 51, 68, 0.75)' },
    animations: { lineAnimation: 'slide-right', wordAnimation: 'word-glow', intensity: 1.5 },
    defaultBackground: { type: 'particles', presetName: 'Neon', value: '#083344' }
  }
};
"""

with open('src/lib/lyricsTemplates.ts', 'w') as f:
    f.write(prefix + new_templates)

