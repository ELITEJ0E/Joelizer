export interface CuratedFont {
  family: string;
  category: 'Modern Sans' | 'Display / Urban' | 'Retro / Synth' | 'Serif & Luxury' | 'Bold Poster';
  weight: string;
  previewText: string;
  description: string;
}

export const CURATED_FONTS: CuratedFont[] = [
  // Modern & Clean
  { family: 'Outfit', category: 'Modern Sans', weight: '800', previewText: 'Modern & Clean', description: 'Contemporary rounded geometric sans, ideal for pop & lofi' },
  { family: 'Plus Jakarta Sans', category: 'Modern Sans', weight: '700', previewText: 'Jakarta Grotesk', description: 'Crisp, contemporary geometric rhythm for hits' },
  { family: 'Inter', category: 'Modern Sans', weight: '800', previewText: 'Ultra Legible', description: 'High-contrast neutral neutral sans' },
  { family: 'DM Sans', category: 'Modern Sans', weight: '700', previewText: 'Geometric Flow', description: 'Geometric, friendly and readable' },

  // Display, Urban & Street
  { family: 'Bebas Neue', category: 'Display / Urban', weight: '400', previewText: 'BEBAS CONDENSED', description: 'Punchy tall all-caps headline, perfect for Trap, Hip-hop & EDM' },
  { family: 'Russo One', category: 'Display / Urban', weight: '400', previewText: 'RUSSO IMPACT', description: 'Heavy, impactful and bold display typeface' },
  { family: 'Permanent Marker', category: 'Display / Urban', weight: '400', previewText: 'Handwritten Vibe', description: 'Authentic street handwritten marker look for rock & rap' },

  // Retro, Synth & Tech
  { family: 'Orbitron', category: 'Retro / Synth', weight: '800', previewText: 'CYBERPUNK 2077', description: 'Futuristic sci-fi techno display for synthwave and electronic' },
  { family: 'Righteous', category: 'Retro / Synth', weight: '400', previewText: 'Retro 80s Groovy', description: 'Curved art deco modernism for disco, retro pop, and funk' },
  { family: 'Space Grotesk', category: 'Retro / Synth', weight: '700', previewText: 'Tech Monochrome', description: 'Quirky monospace-derived sans for electronic and indietronica' },
  { family: 'Syne', category: 'Retro / Synth', weight: '800', previewText: 'Avant-Garde Art', description: 'Bold, expressive artistic curves for hyperpop & indie' },

  // Luxury, Cinematic & Serif
  { family: 'Cinzel', category: 'Serif & Luxury', weight: '800', previewText: 'EPIC CINEMATIC', description: 'Classical Roman proportions for orchestral, metal & cinematic tracks' },
  { family: 'Playfair Display', category: 'Serif & Luxury', weight: '700', previewText: 'Romantic Elegance', description: 'High-contrast luxury serif with graceful curves for ballads and R&B' },
  { family: 'Montserrat', category: 'Bold Poster', weight: '800', previewText: 'POSTER CAPITAL', description: 'Sturdy urban signage font with powerful presence' }
];

export const FONT_OPTIONS = CURATED_FONTS.map(f => f.family);
