import { DAWClip, DAWTrack } from '../types/daw';

export class DAWAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  
  // Track node graph cache: trackId -> { gain, panner }
  private trackNodes: Map<string, { gain: GainNode; panner: StereoPannerNode }> = new Map();
  
  // AudioBuffer cache: url -> AudioBuffer
  private bufferCache: Map<string, AudioBuffer> = new Map();
  
  // Currently playing scheduled buffer sources: clipId -> AudioBufferSourceNode
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  
  // Playback state tracking
  private _isPlaying = false;
  private playheadPosition = 0; // Current time in seconds
  private playbackStartTime = 0; // AudioContext.currentTime when playback was initiated
  private animFrameId: number | null = null;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  
  // Recording state
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private inputGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private inputSourceNode: MediaStreamAudioSourceNode | null = null;
  private isMonitoringInput = false;

  constructor() {
    // Lazy initialize on first user interaction
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      
      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 1024;
      this.masterAnalyser.smoothingTimeConstant = 0.8;
      
      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.warn);
    }
    
    return this.ctx;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get currentTime(): number {
    if (!this._isPlaying || !this.ctx) {
      return this.playheadPosition;
    }
    const elapsed = this.ctx.currentTime - this.playbackStartTime;
    return this.playheadPosition + elapsed;
  }

  public setOnTimeUpdate(cb: ((time: number) => void) | null) {
    this.onTimeUpdateCallback = cb;
  }

  // Preload and decode an audio buffer from URL or Blob
  public async loadAudioBuffer(url: string, fileOrBlob?: Blob): Promise<AudioBuffer> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    const ctx = this.getContext();
    let arrayBuffer: ArrayBuffer;

    if (fileOrBlob) {
      arrayBuffer = await fileOrBlob.arrayBuffer();
    } else {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch audio at ${url}: status ${res.status}`);
      }
      arrayBuffer = await res.arrayBuffer();
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  // Compute waveform peaks array from AudioBuffer
  public computePeaks(audioBuffer: AudioBuffer, numPeaks = 400): number[] {
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / numPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < numPeaks; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j] || 0);
        if (val > max) max = val;
      }
      peaks.push(max);
    }

    return peaks;
  }

  // Ensure track routing nodes exist
  private getOrCreateTrackNode(track: DAWTrack): { gain: GainNode; panner: StereoPannerNode } {
    const ctx = this.getContext();
    if (this.trackNodes.has(track.id)) {
      return this.trackNodes.get(track.id)!;
    }

    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    panner.connect(gain);
    gain.connect(this.masterGain!);

    const nodeEntry = { gain, panner };
    this.trackNodes.set(track.id, nodeEntry);
    return nodeEntry;
  }

  // Update track volume, pan, mute, and solo states
  public updateTrackParameters(tracks: DAWTrack[]) {
    const hasSolo = tracks.some(t => t.solo);

    for (const track of tracks) {
      const { gain, panner } = this.getOrCreateTrackNode(track);
      
      // Calculate effective volume considering mute & solo
      let effectiveVolume = track.volume;
      if (track.muted) {
        effectiveVolume = 0;
      } else if (hasSolo && !track.solo) {
        effectiveVolume = 0;
      }

      gain.gain.setTargetAtTime(effectiveVolume, this.getContext().currentTime, 0.02);
      panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, track.pan)), this.getContext().currentTime, 0.02);
    }
  }

  public setMasterVolume(vol: number) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, vol)), this.getContext().currentTime, 0.02);
    }
  }

  // Start multitrack playback from a specified timestamp
  public async play(
    startTime: number, 
    tracks: DAWTrack[], 
    isLooping = false, 
    loopStart = 0, 
    loopEnd = 0
  ) {
    const ctx = this.getContext();
    this.stopAllSources();

    this.playheadPosition = startTime;
    this.playbackStartTime = ctx.currentTime;
    this._isPlaying = true;

    this.updateTrackParameters(tracks);

    // Schedule all visible clips across all tracks
    for (const track of tracks) {
      const trackNodes = this.getOrCreateTrackNode(track);

      for (const clip of track.clips) {
        if (clip.isMuted) continue;

        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        // Check if playhead is before or inside the clip
        if (clipEnd > startTime) {
          const buffer = this.bufferCache.get(clip.audioUrl);
          if (!buffer) {
            // Lazy load buffer in background
            this.loadAudioBuffer(clip.audioUrl)
              .then(loadedBuffer => {
                if (this._isPlaying) {
                  this.scheduleClip(clip, loadedBuffer, trackNodes.panner, startTime);
                }
              })
              .catch(err => console.warn(`Failed to preload clip "${clip.name}":`, err));
          } else {
            this.scheduleClip(clip, buffer, trackNodes.panner, startTime);
          }
        }
      }
    }

    this.startTimeLoop(isLooping, loopStart, loopEnd, tracks);
  }

  // Schedule an individual clip buffer to start at its calculated offset
  private scheduleClip(
    clip: DAWClip,
    buffer: AudioBuffer,
    destinationNode: AudioNode,
    playbackStartOffset: number
  ) {
    const ctx = this.getContext();
    if (!ctx || !this._isPlaying) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Clip local gain node for fade-ins, fade-outs, and per-clip volume
      const clipGain = ctx.createGain();
      clipGain.gain.value = clip.volume ?? 1.0;

      source.connect(clipGain);
      clipGain.connect(destinationNode);

      const timelineClipStart = clip.startTime;
      const audioSourceOffset = clip.sourceStart;
      const clipDuration = clip.duration;

      if (playbackStartOffset <= timelineClipStart) {
        // Playhead is BEFORE clip start: schedule to start in future
        const delaySeconds = timelineClipStart - playbackStartOffset;
        const when = ctx.currentTime + delaySeconds;
        source.start(when, audioSourceOffset, clipDuration);
      } else {
        // Playhead is INSIDE the clip: start immediately with offset
        const elapsedIntoClip = playbackStartOffset - timelineClipStart;
        const remainingDuration = clipDuration - elapsedIntoClip;
        const newSourceOffset = audioSourceOffset + elapsedIntoClip;

        if (remainingDuration > 0) {
          source.start(ctx.currentTime, newSourceOffset, remainingDuration);
        }
      }

      this.activeSources.set(clip.id, source);

      source.onended = () => {
        if (this.activeSources.get(clip.id) === source) {
          this.activeSources.delete(clip.id);
        }
      };
    } catch (err) {
      console.warn(`Error scheduling clip "${clip.name}":`, err);
    }
  }

  private startTimeLoop(isLooping: boolean, loopStart: number, loopEnd: number, tracks: DAWTrack[]) {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const tick = () => {
      if (!this._isPlaying) return;

      const current = this.currentTime;

      if (isLooping && loopEnd > loopStart && current >= loopEnd) {
        // Loop back to loopStart
        this.play(loopStart, tracks, isLooping, loopStart, loopEnd);
        return;
      }

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(current);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  // Pause playback
  public pause(): number {
    const pauseTime = this.currentTime;
    this.stopAllSources();
    this._isPlaying = false;
    this.playheadPosition = pauseTime;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    return pauseTime;
  }

  // Stop playback and reset to 0 (or start)
  public stop() {
    this.stopAllSources();
    this._isPlaying = false;
    this.playheadPosition = 0;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }
  }

  // Seek to specific time
  public seek(time: number, tracks: DAWTrack[], isLooping = false, loopStart = 0, loopEnd = 0) {
    const wasPlaying = this._isPlaying;
    this.stopAllSources();
    this.playheadPosition = Math.max(0, time);

    if (wasPlaying) {
      this.play(this.playheadPosition, tracks, isLooping, loopStart, loopEnd);
    } else {
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.playheadPosition);
      }
    }
  }

  private stopAllSources() {
    for (const source of this.activeSources.values()) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeSources.clear();
  }

  // --- RECORDING & INPUT MONITORING ENGINE ---

  public async startInputMonitoring(deviceId?: string): Promise<MediaStream> {
    const ctx = this.getContext();

    if (this.mediaStream) {
      this.stopInputMonitoring();
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2
      },
      video: false
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.inputSourceNode = ctx.createMediaStreamSource(this.mediaStream);

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.0;

    this.inputAnalyser = ctx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.5;

    this.inputSourceNode.connect(this.inputGain);
    this.inputGain.connect(this.inputAnalyser);

    this.isMonitoringInput = true;
    return this.mediaStream;
  }

  public setInputMonitoringVolume(vol: number) {
    if (this.inputGain && this.ctx) {
      this.inputGain.gain.setTargetAtTime(Math.max(0, Math.min(2, vol)), this.ctx.currentTime, 0.02);
    }
  }

  public getInputLevel(): number {
    if (!this.inputAnalyser) return 0;
    const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    this.inputAnalyser.getByteFrequencyData(data);
    
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(1, (sum / data.length) / 128);
  }

  public getMasterLevel(): number {
    if (!this.masterAnalyser) return 0;
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(1, (sum / data.length) / 128);
  }

  public stopInputMonitoring() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.inputSourceNode) {
      this.inputSourceNode.disconnect();
      this.inputSourceNode = null;
    }
    this.isMonitoringInput = false;
  }

  // Start recording audio take
  public startRecording(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.mediaStream) {
          await this.startInputMonitoring();
        }

        this.recordedChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(this.mediaStream!, { mimeType });

        this.mediaRecorder.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) {
            this.recordedChunks.push(evt.data);
          }
        };

        this.mediaRecorder.start(100);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Stop recording and return Audio Blob & decoded buffer
  public stopRecording(): Promise<{ blob: Blob; url: string; buffer: AudioBuffer; peaks: number[] }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('MediaRecorder was not running'));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const buffer = await this.loadAudioBuffer(url, blob);
          const peaks = this.computePeaks(buffer);

          resolve({ blob, url, buffer, peaks });
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // --- MULTITRACK MIXDOWN & EXPORT ---

  public async bounceProjectToWav(
    tracks: DAWTrack[], 
    duration: number,
    sampleRate = 44100
  ): Promise<Blob> {
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const offlineMasterGain = offlineCtx.createGain();
    offlineMasterGain.connect(offlineCtx.destination);

    const hasSolo = tracks.some(t => t.solo);

    for (const track of tracks) {
      let effectiveVolume = track.volume;
      if (track.muted || (hasSolo && !track.solo)) {
        effectiveVolume = 0;
      }
      if (effectiveVolume === 0) continue;

      const trackGain = offlineCtx.createGain();
      trackGain.gain.value = effectiveVolume;

      const trackPanner = offlineCtx.createStereoPanner();
      trackPanner.pan.value = Math.max(-1, Math.min(1, track.pan));

      trackPanner.connect(trackGain);
      trackGain.connect(offlineMasterGain);

      for (const clip of track.clips) {
        if (clip.isMuted) continue;

        let buffer = this.bufferCache.get(clip.audioUrl);
        if (!buffer) {
          buffer = await this.loadAudioBuffer(clip.audioUrl);
        }

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        const clipGain = offlineCtx.createGain();
        clipGain.gain.value = clip.volume ?? 1.0;

        source.connect(clipGain);
        clipGain.connect(trackPanner);

        source.start(clip.startTime, clip.sourceStart, clip.duration);
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  // Convert AudioBuffer to standard 16-bit PCM WAV Blob
  private audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // Write WAV Header (RIFF / WAVE / fmt / data)
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);  // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         // length = 16
    setUint16(1);          // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);              // block-align
    setUint16(16);                         // 16-bit precision

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }
}

export const dawAudioEngine = new DAWAudioEngine();
