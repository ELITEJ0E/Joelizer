/** Spotify URLs identify catalog entries, not downloadable audio streams. */
export function parseSpotifyTrackUrl(input: string): { id: string; url: string; embedUrl: string } | null {
  const trimmed = input.trim();
  let id: string | undefined;
  const uri = /^spotify:track:([A-Za-z0-9]{22})$/i.exec(trimmed);
  if (uri) id = uri[1];
  if (!id) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' || !['open.spotify.com', 'play.spotify.com'].includes(parsed.hostname.toLowerCase())) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const trackIndex = parts.indexOf('track');
      if (trackIndex < 0 || !/^[A-Za-z0-9]{22}$/.test(parts[trackIndex + 1] || '')) return null;
      id = parts[trackIndex + 1];
    } catch { return null; }
  }
  return { id, url: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}` };
}

export function isSpotifyLink(input: string): boolean {
  return /^spotify:/i.test(input.trim()) || /^https?:\/\/(?:open|play)\.spotify\.com\//i.test(input.trim());
}
