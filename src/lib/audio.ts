export class AudioContextManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  
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
        this.source.disconnect();
      }
      this.audioEl = audioEl;
      this.source = this.ctx.createMediaElementSource(audioEl);
      this.source.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    
    // Ensure context is resumed (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
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
}

export const audioManager = new AudioContextManager();
