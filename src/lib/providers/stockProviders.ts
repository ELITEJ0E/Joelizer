export interface StockSearchOptions {
  query: string;
  mediaType?: 'video' | 'image';
  pexelsKey?: string;
  pixabayKey?: string;
  unsplashKey?: string;
}

export interface StockSearchResult {
  id: string;
  url: string;
  name: string;
  mediaType: 'video' | 'image';
  thumbnail: string;
  duration?: number;
  provider: string;
}

export function validateDirectMediaUrl(url: string): { valid: boolean; isWebpage: boolean; mediaType?: 'video' | 'image'; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, isWebpage: false, reason: 'Please enter a valid URL.' };
  }

  const clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return { valid: false, isWebpage: false, reason: 'URL must start with http:// or https://' };
  }

  // Check if URL is a known stock webpage rather than a direct asset
  const isPexelsWebpage = clean.includes('pexels.com/video/') || clean.includes('pexels.com/photo/');
  const isPixabayWebpage = clean.includes('pixabay.com/videos/') || clean.includes('pixabay.com/photos/');
  const isUnsplashWebpage = clean.includes('unsplash.com/photos/');

  if (isPexelsWebpage || isPixabayWebpage || isUnsplashWebpage) {
    return {
      valid: false,
      isWebpage: true,
      reason: "This is a stock website page URL. Please right-click the video/image and select 'Copy video address' or 'Copy image address' to get the direct .mp4 or .jpg file URL."
    };
  }

  const isVideo = clean.match(/\.(mp4|webm|mov)(\?.*)?$/i) || clean.includes('video');
  const isImage = clean.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i) || clean.includes('images.unsplash.com') || clean.includes('photo');

  if (!isVideo && !isImage) {
    return {
      valid: false,
      isWebpage: false,
      reason: "URL must point directly to a video (.mp4, .webm) or image (.jpg, .png, .webp) file."
    };
  }

  return {
    valid: true,
    isWebpage: false,
    mediaType: isVideo && !isImage ? 'video' : 'image'
  };
}

export async function searchPexels(query: string, apiKey: string, mediaType: 'video' | 'image' = 'video'): Promise<StockSearchResult[]> {
  try {
    const endpoint = mediaType === 'video'
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`;

    const res = await fetch(endpoint, {
      headers: { Authorization: apiKey }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (mediaType === 'video') {
      return (data.videos || []).map((v: any) => {
        const file = v.video_files?.find((f: any) => f.quality === 'hd') || v.video_files?.[0];
        return {
          id: `pexels-vid-${v.id}`,
          url: file?.link || '',
          name: `Pexels Video #${v.id}`,
          mediaType: 'video',
          thumbnail: v.image,
          duration: v.duration || 10,
          provider: 'Pexels'
        };
      }).filter((item: any) => Boolean(item.url));
    } else {
      return (data.photos || []).map((p: any) => ({
        id: `pexels-img-${p.id}`,
        url: p.src?.large || p.src?.original,
        name: p.alt || `Pexels Photo #${p.id}`,
        mediaType: 'image',
        thumbnail: p.src?.tiny || p.src?.small,
        duration: 8,
        provider: 'Pexels'
      })).filter((item: any) => Boolean(item.url));
    }
  } catch (err) {
    console.warn('Pexels API fetch error:', err);
    return [];
  }
}
