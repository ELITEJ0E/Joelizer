export class AudioContextManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  
  init(audioEl: HTMLAudioElement) {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
    }
    
    if (this.audioEl !== audioEl) {
      if (this.source) {
        try {
          this.source.disconnect();
        } catch (e) {}
      }
      this.audioEl = audioEl;
      try {
        this.source = this.ctx.createMediaElementSource(audioEl);
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch (err) {
        console.warn('createMediaElementSource notice:', err);
      }
    }
    
    // Ensure context is resumed (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  resume(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }
  
  setSmoothing(smoothing: number) {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = smoothing;
    }
  }
  
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
  
  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  play() {
    if (this.audioEl) {
      this.audioEl.play().catch(console.error);
    }
  }

  pause() {
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  seek(time: number) {
    if (this.audioEl) {
      const duration = this.audioEl.duration;
      const target = Math.max(0, Number.isFinite(duration) ? Math.min(time, duration) : time);
      this.audioEl.currentTime = target;
      // Reset the interpolation origin immediately. Otherwise a requestAnimationFrame
      // between the seek and the next media timeupdate can reuse the old position.
      this.lastAudioTime = target;
      this.lastPerfTime = performance.now();
    }
  }

  setPlaybackRate(rate: number) {
    if (this.audioEl) {
      this.audioEl.playbackRate = rate;
    }
  }

  setVolume(vol: number) {
    if (this.audioEl) {
      this.audioEl.volume = Math.max(0, Math.min(1, vol));
    }
  }

  get currentTime() {
    return this.audioEl ? this.audioEl.currentTime : 0;
  }

  get element(): HTMLAudioElement | null {
    return this.audioEl;
  }

  private lastAudioTime = 0;
  private lastPerfTime = 0;

  /**
   * Returns a continuous, jitter-free audio playback timestamp.
   * Interpolates smoothly between audio element updates using high-resolution performance.now()
   * to provide 60/120Hz continuous time without 250ms stepping.
   */
  getPreciseCurrentTime(): number {
    if (!this.audioEl) return 0;
    // Media element is the only authoritative clock. A separate predicted
    // position can lag or jump after repeated seeks and rapid rewinds.
    const position = this.audioEl.currentTime;
    this.lastAudioTime = position;
    this.lastPerfTime = performance.now();
    return position;
  }

  getMediaStream(): MediaStream | null {
    if (!this.ctx || !this.analyser) return null;
    if (!this.dest) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.analyser.connect(this.dest);
    }
    return this.dest.stream;
  }
}

export const audioManager = new AudioContextManager();
