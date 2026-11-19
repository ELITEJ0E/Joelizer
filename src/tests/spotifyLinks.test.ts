import assert from 'node:assert/strict';
import { isSpotifyLink, parseSpotifyTrackUrl } from '../lib/spotifyLinks';

const id = '4cOdK2wGLETKBW3PvgPWqT';
const link = `https://open.spotify.com/track/${id}?si=example`;
assert.deepEqual(parseSpotifyTrackUrl(link), {
  id, url: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}`
});
assert.equal(parseSpotifyTrackUrl(`spotify:track:${id}`)?.id, id);
assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/intl-en/track/${id}`)?.id, id);
assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/album/${id}`), null);
assert.equal(parseSpotifyTrackUrl('https://example.com/track/4cOdK2wGLETKBW3PvgPWqT'), null);
assert.equal(isSpotifyLink(link), true);
assert.equal(isSpotifyLink('https://example.com/audio.mp3'), false);
console.log('Spotify link tests passed');
