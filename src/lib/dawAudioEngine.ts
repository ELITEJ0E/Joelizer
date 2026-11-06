import { DAWClip, DAWTrack } from '../types/daw';
import { scheduleDawClipEnvelope, dawSafePeakGain } from './dawMixing';
import { encodeLabWav, type WavBitDepth } from './audioLabEngine';

export class DAWAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  
  // Track node graph cache: trackId -> { gain, panner }
  private trackNodes: Map<string, {
    gain: GainNode; panner: StereoPannerNode;
    low: BiquadFilterNode; mid: BiquadFilterNode;
    high: BiquadFilterNode; compressor: DynamicsCompressorNode;
  }> = new Map();
  
  // AudioBuffer cache: url -> AudioBuffer
  private bufferCache: Map<string, AudioBuffer> = new Map();
  
  // Currently playing scheduled buffer sources: clipId -> AudioBufferSourceNode
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  
  // Playback state tracking
  private _isPlaying = false;
  private playheadPosition = 0; // Current time in seconds
  private playbackStartTime = 0; // AudioContext.currentTime when playback was initiated
  private animFrameId: number | null = null;
  private lastUiTick = 0;
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

  // One persistent per-track graph. Keeping nodes alive avoids clicks and
  // decoder churn when changing EQ, compression, mute, pan or volume.
  private getOrCreateTrackNode(track: DAWTrack) {
    const ctx = this.getContext();
    const existing = this.trackNodes.get(track.id);
    if (existing) return existing;

    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const low = ctx.createBiquadFilter();
    const mid = ctx.createBiquadFilter();
    const high = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    low.type = 'lowshelf'; low.frequency.value = 180;
    mid.type = 'peaking'; mid.frequency.value = 1150; mid.Q.value = 0.8;
    high.type = 'highshelf'; high.frequency.value = 7200;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.13;
    compressor.knee.value = 8;
    panner.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(compressor);
    compressor.connect(gain);
    gain.connect(this.masterGain!);
    const nodes = { gain, panner, low, mid, high, compressor };
    this.trackNodes.set(track.id, nodes);
    return nodes;
  }

  public updateTrackParameters(tracks: DAWTrack[]) {
    const hasSolo = tracks.some(track => track.solo);
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const clampValue = (value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
    for (const track of tracks) {
      const {gain,panner,low,mid,high,compressor}=this.getOrCreateTrackNode(track);
      const volume = track.muted || (hasSolo && !track.solo) ? 0 : track.volume;
      gain.gain.setTargetAtTime(clampValue(volume,0,1.5),now,.012);
      panner.pan.setTargetAtTime(clampValue(track.pan,-1,1),now,.012);
      low.gain.setTargetAtTime(clampValue(track.fx?.lowShelfDb ?? 0,-18,18),now,.02);
      mid.gain.setTargetAtTime(clampValue(track.fx?.midDb ?? 0,-18,18),now,.02);
      high.gain.setTargetAtTime(clampValue(track.fx?.highShelfDb ?? 0,-18,18),now,.02);
      compressor.threshold.setTargetAtTime(clampValue(track.fx?.compressorThresholdDb ?? -18,-48,0),now,.02);
      compressor.ratio.setTargetAtTime(track.fx?.compressorEnabled
        ? clampValue(track.fx.compressorRatio ?? 2,1,12) : 1,now,.02);
    }
    // Release routing nodes for removed tracks, keeping an active session lean.
    const ids=new Set(tracks.map(t=>t.id));
    for (const [id,node] of this.trackNodes) {
      if (ids.has(id)) continue;
      node.panner.disconnect();
      node.low.disconnect();node.mid.disconnect();node.high.disconnect();
      node.compressor.disconnect();node.gain.disconnect();
      this.trackNodes.delete(id);
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

      // Apply the same gain/fade automation used by offline WAV mixdown.
      const clipGain = ctx.createGain();
      clipGain.gain.value = 0;

      source.connect(clipGain);
      clipGain.connect(destinationNode);

      const timelineClipStart = clip.startTime;
      const audioSourceOffset = clip.sourceStart;
      const clipDuration = clip.duration;

      if (playbackStartOffset <= timelineClipStart) {
        // Playhead is BEFORE clip start: schedule to start in future
        const delaySeconds = timelineClipStart - playbackStartOffset;
        const when = ctx.currentTime + delaySeconds;
        scheduleDawClipEnvelope(clipGain.gain, clip, when, 0, clipDuration);
        source.start(when, audioSourceOffset, clipDuration);
      } else {
        // Playhead is INSIDE the clip: start immediately with offset
        const elapsedIntoClip = playbackStartOffset - timelineClipStart;
        const remainingDuration = clipDuration - elapsedIntoClip;
        const newSourceOffset = audioSourceOffset + elapsedIntoClip;

        if (remainingDuration > 0) {
          scheduleDawClipEnvelope(clipGain.gain, clip, ctx.currentTime, elapsedIntoClip, remainingDuration);
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

      // Avoid re-rendering the entire React DAW tree at the display's 120 Hz
      // refresh rate; audio scheduling remains on the Web Audio clock.
      if (this.onTimeUpdateCallback && (this.getContext().currentTime - this.lastUiTick >= 1/30)) {
        this.lastUiTick = this.getContext().currentTime;
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
    sampleRate = 44100,
    masterVolume = 1,
    bitDepth: WavBitDepth = 24
  ): Promise<Blob> {
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const offlineMasterGain = offlineCtx.createGain();
    offlineMasterGain.gain.value = Math.max(0, Math.min(1.5, masterVolume));
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

      // Match the real-time channel strip exactly during offline bouncing.
      const low = offlineCtx.createBiquadFilter();
      low.type='lowshelf';low.frequency.value=180;
      low.gain.value=Math.max(-18,Math.min(18,track.fx?.lowShelfDb??0));
      const mid = offlineCtx.createBiquadFilter();
      mid.type='peaking';mid.frequency.value=1150;mid.Q.value=.8;
      mid.gain.value=Math.max(-18,Math.min(18,track.fx?.midDb??0));
      const high = offlineCtx.createBiquadFilter();
      high.type='highshelf';high.frequency.value=7200;
      high.gain.value=Math.max(-18,Math.min(18,track.fx?.highShelfDb??0));
      const compressor=offlineCtx.createDynamicsCompressor();
      compressor.knee.value=8;compressor.attack.value=.008;compressor.release.value=.13;
      compressor.threshold.value=Math.max(-48,Math.min(0,track.fx?.compressorThresholdDb??-18));
      compressor.ratio.value=track.fx?.compressorEnabled
        ? Math.max(1,Math.min(12,track.fx.compressorRatio??2)) : 1;
      trackPanner.connect(low);
      low.connect(mid);mid.connect(high);high.connect(compressor);
      compressor.connect(trackGain);
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
        clipGain.gain.value = 0;

        source.connect(clipGain);
        clipGain.connect(trackPanner);

        const actualDuration = Math.min(clip.duration, buffer.duration - clip.sourceStart, duration - clip.startTime);
        if (actualDuration <= 0) continue;
        scheduleDawClipEnvelope(clipGain.gain, clip, clip.startTime, 0, actualDuration);
        source.start(clip.startTime, clip.sourceStart, actualDuration);
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    let peak = 0;
    for (let channel = 0; channel < renderedBuffer.numberOfChannels; channel++) {
      const data = renderedBuffer.getChannelData(channel);
      for (let sample = 0; sample < data.length; sample++) {
        const magnitude = Math.abs(data[sample]);
        if (magnitude > peak) peak = magnitude;
      }
    }
    const gain = dawSafePeakGain(peak, -1);
    if (gain < 1) {
      for (let channel = 0; channel < renderedBuffer.numberOfChannels; channel++) {
        const data = renderedBuffer.getChannelData(channel);
        for (let sample = 0; sample < data.length; sample++) data[sample] *= gain;
      }
    }
    return encodeLabWav(renderedBuffer, bitDepth);
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
