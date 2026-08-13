import re

with open('src/lib/lyricsTemplates.ts', 'r') as f:
    content = f.read()

# Replace the keys inside LYRIC_VIDEO_TEMPLATES to match the new IDs
# classic -> square
content = content.replace("  classic: {", "  square: {")
content = content.replace("id: 'classic',", "id: 'square',")
content = content.replace("artworkType: 'square',", "artworkType: 'square',")

# minimal -> keep, wait, the layout IDs are: 'full', 'square', 'circle', 'vinyl', 'cd', 'vinyl-needle', 'cd-needle'
# Let's map them properly
content = content.replace("  'full-screen': {", "  full: {")
content = content.replace("id: 'full-screen',", "id: 'full',")

content = content.replace("  dreamy: {", "  circle: {")
content = content.replace("id: 'dreamy',", "id: 'circle',")
content = content.replace("artworkType: 'circle',", "artworkType: 'circle',")

content = content.replace("  kinetic: {", "  cd: {")
content = content.replace("id: 'kinetic',", "id: 'cd',")

# Let's add vinyl-needle and cd-needle by copying vinyl and cd
import sys
# Actually let's just rewrite the LYRIC_VIDEO_TEMPLATES part completely.
