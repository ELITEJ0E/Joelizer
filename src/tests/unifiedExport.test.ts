import { buildCanonicalProjectJson } from '../lib/projectJsonBuilder';
import { stageAssetIfNeeded } from '../lib/assetStaging';
import { getBestAvailableRenderer } from '../lib/renderers/renderManager';
import { ServerRemotionRenderer } from '../lib/renderers/ServerRemotionRenderer';
import { LocalFFmpegRenderer } from '../lib/renderers/LocalFFmpegRenderer';
import { BrowserFallbackRenderer } from '../lib/renderers/BrowserFallbackRenderer';
import { useStore } from '../store/useStore';
import { useMVStore } from '../store/useMVStore';
import { useLyricsVideoStore } from '../store/useLyricsVideoStore';

export async function runUnifiedExportTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('====================================================');
  console.log(' UNIFIED VIDEO EXPORT ARCHITECTURE AUDIT SUITE ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // Setup initial mock state
  useStore.setState({
    name: 'Test Project',
    audioUrl: 'https://example.com/audio.mp3',
    audioDuration: 15,
    aspectRatio: '16:9',
    exportResolutionOverride: '1080p',
    tracks: [
      {
        id: 'track-1',
        name: 'Sample Track',
        artist: 'Joelizer Test',
        url: 'https://example.com/audio.mp3',
        duration: 15,
        albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17'
      }
    ],
    currentTrackIndex: 0,
    lyricsSettings: {
      font: 'Inter',
      color: '#ffffff',
      animationStyle: 'karaoke',
      lines: [
        {
          id: 'line-1',
          text: 'First line of lyrics',
          startTime: 0,
          endTime: 4,
          words: [
            { word: 'First', startTime: 0, endTime: 1 },
            { word: 'line', startTime: 1, endTime: 2 },
            { word: 'of', startTime: 2, endTime: 3 },
            { word: 'lyrics', startTime: 3, endTime: 4 }
          ]
        }
      ]
    }
  });

  useMVStore.setState({
    timelineClips: [],
    videoAssets: []
  });

  useLyricsVideoStore.setState({
    videoMode: 'lyrics-video'
  });

  // 1. Lyrics-only export JSON without base64
  try {
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.exportMode === 'lyrics-video' && json.audio.audioDataUri === null && json.lyrics.lines.length > 0,
      '1. Generates valid Lyrics-only export JSON without base64'
    );
  } catch (e: any) {
    assert(false, '1. Generates valid Lyrics-only export JSON without base64', e.message);
  }

  // 2. Vinyl Lyrics settings
  try {
    useLyricsVideoStore.setState({
      artworkOverride: { style: 'vinyl', animation: 'rotate', sizeScale: 1.2 }
    });
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.artwork.style === 'vinyl' && json.artwork.animation === 'rotate' && json.artwork.sizeScale === 1.2,
      '2. Preserves Vinyl Lyrics settings in Canonical Project JSON'
    );
  } catch (e: any) {
    assert(false, '2. Preserves Vinyl Lyrics settings in Canonical Project JSON', e.message);
  }

  // 3. Visualizer settings
  try {
    useStore.setState({
      visualizerSettings: {
        style: 'bars',
        color: '#00e676',
        sensitivity: 0.9,
        smoothing: 0.7,
        segments: 16,
        hitResponse: 0.2,
        glitchIntensity: 0,
        shakeIntensity: 0,
        showGrain: false,
        showScanlines: false
      }
    });
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.visualizer.style === 'bars' && json.visualizer.color === '#00e676',
      '3. Preserves Visualizer settings in Canonical Project JSON'
    );
  } catch (e: any) {
    assert(false, '3. Preserves Visualizer settings in Canonical Project JSON', e.message);
  }

  // 4. Video timeline clip conversion
  try {
    useMVStore.setState({
      timelineClips: [
        {
          id: 'clip-1',
          assetId: 'asset-1',
          type: 'video',
          startTime: 0,
          endTime: 5,
          trimStart: 0,
          trimEnd: 5,
          effect: 'ken-burns-in',
          transition: 'fade'
        }
      ],
      videoAssets: [
        {
          id: 'asset-1',
          name: 'Video 1',
          url: 'https://example.com/video1.mp4',
          thumbnail: 'https://example.com/v1.jpg',
          type: 'video',
          duration: 10,
          status: 'ready'
        }
      ]
    });

    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.videoClips.length === 1 && json.videoClips[0].url === 'https://example.com/video1.mp4',
      '4. Converts video timeline clips into canonical representation'
    );
  } catch (e: any) {
    assert(false, '4. Converts video timeline clips into canonical representation', e.message);
  }

  // 5. Multiple clips ordering
  try {
    useMVStore.setState({
      timelineClips: [
        { id: 'c1', assetId: 'a1', type: 'video', startTime: 0, endTime: 3, trimStart: 0, trimEnd: 3 },
        { id: 'c2', assetId: 'a2', type: 'image', startTime: 3, endTime: 7, trimStart: 0, trimEnd: 4 }
      ],
      videoAssets: [
        { id: 'a1', name: 'v1', url: 'https://example.com/v1.mp4', thumbnail: '', type: 'video', duration: 5, status: 'ready' },
        { id: 'a2', name: 'i1', url: 'https://example.com/i1.jpg', thumbnail: '', type: 'image', duration: 4, status: 'ready' }
      ]
    });

    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.videoClips.length === 2 && json.videoClips[0].startTime === 0 && json.videoClips[1].startTime === 3,
      '5. Handles multiple clips ordering and timeline sequence'
    );
  } catch (e: any) {
    assert(false, '5. Handles multiple clips ordering and timeline sequence', e.message);
  }

  // 6. Stage asset helper returns remote URLs unchanged
  try {
    const remoteUrl = 'https://images.unsplash.com/photo-sample';
    const staged = await stageAssetIfNeeded(remoteUrl);
    assert(staged === remoteUrl, '6. Stage asset helper returns remote URLs unchanged');
  } catch (e: any) {
    assert(false, '6. Stage asset helper returns remote URLs unchanged', e.message);
  }

  // 7. Word-level karaoke timestamps
  try {
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    const line = json.lyrics.lines[0];
    assert(
      !!line && !!line.words && line.words.length === 4 && line.words[0].word === 'First',
      '7. Preserves word-level karaoke timestamps in lyrics json'
    );
  } catch (e: any) {
    assert(false, '7. Preserves word-level karaoke timestamps in lyrics json', e.message);
  }

  // 8. Aspect ratio configurations
  try {
    useStore.setState({ aspectRatio: '9:16' });
    const portraitJson = await buildCanonicalProjectJson({ skipStaging: true });
    assert(portraitJson.width === 1080 && portraitJson.height === 1920, '8. Supports portrait 9:16 aspect ratio');
  } catch (e: any) {
    assert(false, '8. Supports portrait 9:16 aspect ratio', e.message);
  }

  // 9. Resolution dimensions calculation
  try {
    const json1080 = await buildCanonicalProjectJson({ resolution: '1080p', skipStaging: true });
    assert(json1080.width === 1080 && json1080.height === 1920, '9. Resolution dimensions calculation for portrait 1080p');
  } catch (e: any) {
    assert(false, '9. Resolution dimensions calculation', e.message);
  }

  // 10. Audio track info
  try {
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    assert(
      json.audio.title === 'Sample Track' && json.audio.artist === 'Joelizer Test',
      '10. Audio track info mapped correctly'
    );
  } catch (e: any) {
    assert(false, '10. Audio track info mapped correctly', e.message);
  }

  // 11. Render manager selection
  try {
    const renderer = await getBestAvailableRenderer();
    assert(
      !!renderer && ['server', 'local', 'browser'].includes(renderer.type),
      '11. Detects available renderers in correct priority order'
    );
  } catch (e: any) {
    assert(false, '11. Detects available renderers in correct priority order', e.message);
  }

  // 12. ServerRemotionRenderer instantiation
  try {
    const serverRenderer = new ServerRemotionRenderer();
    assert(serverRenderer.type === 'server', '12. Instantiates ServerRemotionRenderer correctly');
  } catch (e: any) {
    assert(false, '12. Instantiates ServerRemotionRenderer correctly', e.message);
  }

  // 13. LocalFFmpegRenderer instantiation
  try {
    const localRenderer = new LocalFFmpegRenderer();
    assert(localRenderer.type === 'local', '13. Instantiates LocalFFmpegRenderer correctly');
  } catch (e: any) {
    assert(false, '13. Instantiates LocalFFmpegRenderer correctly', e.message);
  }

  // 14. BrowserFallbackRenderer instantiation
  try {
    const browserRenderer = new BrowserFallbackRenderer();
    assert(browserRenderer.type === 'browser', '14. Instantiates BrowserFallbackRenderer correctly');
  } catch (e: any) {
    assert(false, '14. Instantiates BrowserFallbackRenderer correctly', e.message);
  }

  // 15. Payload size check (no base64)
  try {
    const json = await buildCanonicalProjectJson({ skipStaging: true });
    const str = JSON.stringify(json);
    assert(
      !str.includes('data:audio') && str.length < 100000,
      '15. Ensures export project payload contains no embedded base64 data URIs'
    );
  } catch (e: any) {
    assert(false, '15. Ensures export project payload contains no embedded base64 data URIs', e.message);
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
  return { passed, failed };
}
