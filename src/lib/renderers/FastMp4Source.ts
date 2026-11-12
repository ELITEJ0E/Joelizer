/**
 * Fast MP4/MOV source reader. MP4Box demuxes compressed samples and
 * VideoDecoder decodes them sequentially. Seeking an HTMLVideoElement once
 * for every export frame repeatedly restarts the decoder and makes a
 * four-minute edit painfully slow. This reader skips those repeated seeks.
 *
 * Frame queues remain small (at most a short GOP at a time); decoded
 * VideoFrames are closed immediately after they are no longer needed.
 * Unsupported codecs/containers fall back to the existing HTMLVideoElement.
 */
import * as MP4Box from 'mp4box';

type Sample = {
  timestamp: number;
  duration: number;
  key: boolean;
  data: Uint8Array;
};

/**
 * Discard only obsolete presentation frames, never future frames.
 * The array is modified in place, preserving the selected frame and all
 * later timestamps; dropping future frames causes choppy MP4 exports.
 */
export function pruneConsumedVideoFrames<T extends { timestamp: number; close(): void }>(
  frames: T[],
  targetUs: number
): void {
  if (frames.length <= 1) return;
  frames.sort((a, b) => a.timestamp - b.timestamp);
  let selected = -1;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].timestamp <= targetUs) selected = i;
    else break;
  }
  if (selected <= 0) return;
  for (let i = 0; i < selected; i++) {
    try { frames[i].close(); } catch {}
  }
  frames.splice(0, selected);
}

export class FastMp4Source {
  private samples: Sample[];
  private config: VideoDecoderConfig;
  private decoder: VideoDecoder | null = null;
  private decoded: VideoFrame[] = [];
  private sampleIndex = 0;
  private lastTarget = -1;
  private currentTargetUs = 0;
  private decoderError: Error | null = null;
  private flushed = false;
  // A VideoDecoder can remain configured while its hardware callback stops
  // producing frames. Detect a stalled decode before the whole MP4 export
  // reaches its 60-second watchdog and activate the HTMLVideo fallback.
  private static readonly FRAME_TIMEOUT_MS = 10000;

  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly codec: string;

  private constructor(samples: Sample[], config: VideoDecoderConfig) {
    this.durationSeconds = samples.reduce((duration, sample) =>
      Math.max(duration, (sample.timestamp + sample.duration) / 1e6), 0);
    this.samples = samples;
    this.config = config;
    this.width = config.codedWidth || 0;
    this.height = config.codedHeight || 0;
    this.codec = config.codec || 'unknown';
  }

  static async open(url: string): Promise<FastMp4Source> {
    if (typeof VideoDecoder === 'undefined') throw new Error('WebCodecs decoding unavailable');
    // MP4Box needs the complete byte stream for random access to keyframes.
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not fetch MP4 source');
    const data = await response.arrayBuffer();
    const file: any = MP4Box.createFile();
    let track: any = null;
    let config: VideoDecoderConfig | null = null;
    const samples: Sample[] = [];

    file.onError = (err: unknown) => {
      throw new Error('MP4 demux failed: ' + String(err));
    };
    file.onReady = (info: any) => {
      track = info.videoTracks?.[0];
      if (!track) return;
      const trak = file.getTrackById(track.id);
      const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
      const codecBox = entry?.avcC || entry?.hvcC || entry?.vpcC || entry?.av1C;
      let description: Uint8Array | undefined;
      if (codecBox) {
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.Endianness.BIG_ENDIAN);
        codecBox.write(stream);
        description = new Uint8Array(stream.buffer.slice(8));
      }
      config = {
        codec: track.codec,
        codedWidth: track.video?.width,
        codedHeight: track.video?.height,
        ...(description ? { description } : {})
      };
      file.setExtractionOptions(track.id, null, { nbSamples: 64 });
      file.start();
    };
    file.onSamples = (_id: number, _user: unknown, batch: any[]) => {
      for (const sample of batch) {
        samples.push({
          timestamp: Math.round(sample.cts * 1e6 / sample.timescale),
          duration: Math.max(1, Math.round(sample.duration * 1e6 / sample.timescale)),
          key: !!sample.is_sync,
          data: new Uint8Array(sample.data)
        });
      }
    };
    const buffer = data as ArrayBuffer & { fileStart: number };
    buffer.fileStart = 0;
    file.appendBuffer(buffer);
    file.flush();
    if (!track || !config || !samples.length) throw new Error('File does not contain a readable MP4 video track.');
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) {
      const detected = track.codec || 'unknown';
      const format = /^hvc1|^hev1/i.test(detected) ? 'HEVC/H.265'
        : /^ap4h|^apch|^apcn|^apcs/i.test(detected) ? 'Apple ProRes'
        : detected;
      throw new Error(`Source codec ${format} (${detected}) cannot be decoded in this browser. Convert the source to H.264 MP4 (8-bit yuv420p), then re-import it.`);
    }
    // Samples must be fed in DTS order, which MP4Box's extraction retains.
    return new FastMp4Source(samples, support.config);
  }

  /**
   * Discard only past frames that can never be selected again during a
   * forward export. Keep every decoded future frame until its timestamp is
   * reached: dropping those frames used to skip source frames and caused
   * visibly jerky exported footage, especially with reordered H.264 frames.
   *
   * The input decodeQueueSize/backpressure below bounds new work; future
   * frames must never be pruned simply because a queue-length cap was hit.
   */
  private pruneDecoded(targetUs: number) {
    pruneConsumedVideoFrames(this.decoded, targetUs);
  }

  private reset(targetUs: number) {
    if (this.decoder) {
      try {
        if (this.decoder.state !== 'closed') this.decoder.close();
      } catch {}
      this.decoder = null;
    }
    for (const frame of this.decoded) {
      try { frame.close(); } catch {}
    }
    this.decoded = [];
    this.decoderError = null;
    this.flushed = false;
    this.lastTarget = -1;

    // Decode from the nearest previous sync sample (keyframe)
    let keyIndex = 0;
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].key) {
        if (this.samples[i].timestamp <= targetUs) {
          keyIndex = i;
        } else {
          break;
        }
      }
    }
    this.sampleIndex = keyIndex;
    this.currentTargetUs = targetUs;
    this.decoder = new VideoDecoder({
      output: frame => {
        this.decoded.push(frame);
        this.pruneDecoded(this.currentTargetUs);
      },
      error: error => {
        console.warn(`[FastMp4Source] VideoDecoder error on ${this.codec}:`, error);
        this.decoderError = error;
      }
    });
    this.decoder.configure(this.config);
  }

  async frameAt(seconds: number): Promise<VideoFrame> {
    const lastSampleTimestamp = this.samples.length > 0
      ? this.samples[this.samples.length - 1].timestamp
      : 0;
    const targetUs = Math.min(Math.round(Math.max(0, seconds) * 1e6), lastSampleTimestamp);
    this.currentTargetUs = targetUs;
    const decodeStartedAt = performance.now();
    const checkDeadline = () => {
      if (performance.now() - decodeStartedAt > FastMp4Source.FRAME_TIMEOUT_MS) {
        throw new Error(`WebCodecs source decoder stopped returning frames at ${(targetUs / 1e6).toFixed(2)}s (${this.codec}). Switching to browser video decoder.`);
      }
    };

    // A cut jump, loop wrap, or distant forward seek triggers a reset to the nearest keyframe
    if (!this.decoder || this.decoder.state === 'closed' || this.decoderError ||
        (this.lastTarget >= 0 && (targetUs < this.lastTarget - 2000 || targetUs > this.lastTarget + 1_500_000))) {
      this.reset(targetUs);
    }
    this.lastTarget = targetUs;

    // Prune before feeding additional samples
    this.pruneDecoded(targetUs);

    let batches = 0;
    while (this.sampleIndex < this.samples.length &&
      (!this.decoded.length || this.decoded[this.decoded.length - 1].timestamp < targetUs)) {
      checkDeadline();
      if (this.decoderError) throw this.decoderError;

      // Backpressure: If decodeQueueSize reaches 4 or higher, wait for the dequeue event
      // instead of flooding the hardware decoder with uncompressed 1080p textures
      if (this.decoder && this.decoder.decodeQueueSize >= 4) {
        await new Promise<void>(resolve => {
          let resolved = false;
          const onDone = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          this.decoder!.addEventListener('dequeue', onDone, { once: true });
          setTimeout(onDone, 30);
        });
      }

      const count = Math.min(4, this.samples.length - this.sampleIndex);
      for (let i = 0; i < count; i++) {
        const sample = this.samples[this.sampleIndex++];
        this.decoder!.decode(new EncodedVideoChunk({
          type: sample.key ? 'key' : 'delta',
          timestamp: sample.timestamp,
          duration: sample.duration,
          data: sample.data
        }));
      }

      // Yield to macrotask so the browser's GPU worker thread can process output callbacks
      await new Promise(resolve => setTimeout(resolve, 0));
      checkDeadline();
      if (this.decoderError) throw this.decoderError;
      if (++batches > 4000) {
        throw new Error(`Imported video decoder exceeded sample batch limit at ${targetUs}us (${this.codec}, queue: ${this.decoder?.decodeQueueSize}, open frames: ${this.decoded.length})`);
      }
    }

    if (!this.flushed && this.sampleIndex === this.samples.length && this.decoder &&
        this.decoder.state === 'configured') {
      const decoder = this.decoder;
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          decoder.flush(),
          new Promise<never>((_, reject) => {
            flushTimer = setTimeout(() => reject(new Error(
              `WebCodecs flush stalled at ${(targetUs / 1e6).toFixed(2)}s (${this.codec})`
            )), Math.max(1000, FastMp4Source.FRAME_TIMEOUT_MS - (performance.now() - decodeStartedAt)));
          })
        ]);
      } finally {
        if (flushTimer !== undefined) clearTimeout(flushTimer);
      }
      this.flushed = true;
      if (this.decoderError) throw this.decoderError;
    }

    if (!this.decoded.length) {
      throw new Error(`MP4 decoder returned no frames for target ${targetUs}us (${this.codec})`);
    }

    this.decoded.sort((a, b) => a.timestamp - b.timestamp);
    let selected = 0;
    for (let i = 0; i < this.decoded.length; i++) {
      if (this.decoded[i].timestamp > targetUs) break;
      selected = i;
    }

    // Retain the chosen frame for output FPS > input FPS; close older frames
    for (let i = 0; i < selected; i++) {
      try { this.decoded[i].close(); } catch {}
    }
    if (selected) this.decoded.splice(0, selected);

    // Return a clone so caller drawing and decoder resets don't cross-close
    return this.decoded[0].clone();
  }

  dispose() {
    if (this.decoder) {
      try {
        if (this.decoder.state !== 'closed') this.decoder.close();
      } catch {}
      this.decoder = null;
    }
    for (const frame of this.decoded) {
      try { frame.close(); } catch {}
    }
    this.decoded = [];
    this.samples = [];
  }
}
