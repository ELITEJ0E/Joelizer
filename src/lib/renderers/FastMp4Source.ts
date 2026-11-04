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

export class FastMp4Source {
  private samples: Sample[];
  private config: VideoDecoderConfig;
  private decoder: VideoDecoder | null = null;
  private decoded: VideoFrame[] = [];
  private sampleIndex = 0;
  private lastTarget = -1;
  private decoderError: Error | null = null;

  private constructor(samples: Sample[], config: VideoDecoderConfig) {
    this.samples = samples;
    this.config = config;
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
    if (!track || !config || !samples.length) throw new Error('MP4 has no extractable video samples');
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) throw new Error('Source video codec is unsupported by WebCodecs');
    // Samples must be fed in DTS order, which MP4Box's extraction retains.
    return new FastMp4Source(samples, support.config);
  }

  private reset(targetUs: number) {
    this.decoder?.close();
    this.decoder = null;
    for (const frame of this.decoded) frame.close();
    this.decoded = [];
    this.decoderError = null;
    this.lastTarget = -1;

    // Decode from the nearest previous random access point, not from a
    // delta frame. This supports arbitrary user trimStart values.
    let keyIndex = 0;
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].timestamp > targetUs) break;
      if (this.samples[i].key) keyIndex = i;
    }
    this.sampleIndex = keyIndex;
    this.decoder = new VideoDecoder({
      output: frame => this.decoded.push(frame),
      error: error => { this.decoderError = error; }
    });
    this.decoder.configure(this.config);
  }

  async frameAt(seconds: number): Promise<VideoFrame> {
    const targetUs = Math.round(Math.max(0, seconds) * 1e6);
    // A different cut can jump to a remote trim offset in the same video.
    if (!this.decoder || (this.lastTarget >= 0 &&
        (targetUs < this.lastTarget - 1000 || targetUs > this.lastTarget + 1_000_000))) {
      this.reset(targetUs);
    }
    this.lastTarget = targetUs;

    while (this.sampleIndex < this.samples.length &&
      (!this.decoded.length || Math.max(...this.decoded.map(f => f.timestamp)) < targetUs)) {
      // Decode a small sequential batch. Flush waits for reordered H264 B
      // frames and prevents output from referencing uninitialized frames.
      const count = Math.min(12, this.samples.length - this.sampleIndex);
      for (let i = 0; i < count; i++) {
        const sample = this.samples[this.sampleIndex++];
        this.decoder!.decode(new EncodedVideoChunk({
          type: sample.key ? 'key' : 'delta',
          timestamp: sample.timestamp,
          duration: sample.duration,
          data: sample.data
        }));
      }
      await this.decoder!.flush();
      if (this.decoderError) throw this.decoderError;
    }
    if (!this.decoded.length) throw new Error('MP4 decoder returned no frames');
    this.decoded.sort((a, b) => a.timestamp - b.timestamp);
    let selected = 0;
    for (let i = 0; i < this.decoded.length; i++) {
      if (this.decoded[i].timestamp > targetUs) break;
      selected = i;
    }
    // Retain the chosen frame for output FPS > input FPS; close older
    // decoded frames to keep long projects within reasonable memory.
    for (let i = 0; i < selected; i++) this.decoded[i].close();
    if (selected) this.decoded.splice(0, selected);
    return this.decoded[0];
  }

  dispose() {
    this.decoder?.close();
    this.decoder = null;
    for (const frame of this.decoded) frame.close();
    this.decoded = [];
    this.samples = [];
  }
}
