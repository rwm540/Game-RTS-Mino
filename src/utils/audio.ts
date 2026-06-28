/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioSynth {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (val) {
      this.initCtx();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) return new AudioBuffer({ length: 1, sampleRate: 44100 });
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public playSelect() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playCommand() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Two rapid bips
    const playBip = (delay: number, freq: number) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
    };

    playBip(0, 600);
    playBip(0.06, 800);
  }

  public playLaser() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playHeavyCannon() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);

    // Mix in some noise for dust/impact feeling
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const noiseGain = this.ctx.createGain();
      const noiseFilter = this.ctx.createBiquadFilter();

      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(100, this.ctx.currentTime);

      noiseGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start();
      noise.stop(this.ctx.currentTime + 0.25);
    } catch (_) {}
  }

  public playExplosion() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Deep boom + sizzling noise
    const t = this.ctx.currentTime;
    
    // Deep boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(10, t + 0.6);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);

    // Blast noise
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const noiseFilter = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(200, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(50, t + 0.5);

      noiseGain.gain.setValueAtTime(0.25, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + 0.5);
    } catch (_) {}
  }

  public playBuildComplete() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const playNote = (freq: number, startDelay: number, duration: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + startDelay);
      gain.gain.setValueAtTime(0.06, t + startDelay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + startDelay + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + startDelay);
      osc.stop(t + startDelay + duration);
    };

    // Major arpeggio C4 - E4 - G4 - C5
    playNote(261.63, 0, 0.15);
    playNote(329.63, 0.08, 0.15);
    playNote(392.00, 0.16, 0.15);
    playNote(523.25, 0.24, 0.3);
  }

  public playAlarm() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Siren sweeps up and down twice
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.25);
    osc.frequency.linearRampToValueAtTime(400, t + 0.5);
    osc.frequency.linearRampToValueAtTime(600, t + 0.75);
    osc.frequency.linearRampToValueAtTime(400, t + 1.0);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 1.1);
  }

  public playVictory() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [
      [261.63, 329.63, 392.00], // C major
      [293.66, 349.23, 440.00], // D minor/F major
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33, 783.99] // G major / C5
    ];

    chords.forEach((chord, step) => {
      chord.forEach(freq => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + step * 0.25);
        gain.gain.setValueAtTime(0.05, t + step * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, t + step * 0.25 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + step * 0.25);
        osc.stop(t + step * 0.25 + 0.4);
      });
    });
  }

  public playDefeat() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [
      [392.00, 466.16, 587.33], // G minor
      [349.23, 415.30, 523.25], // F minor
      [311.13, 369.99, 466.16], // Eb minor
      [246.94, 293.66, 369.99, 110.0] // B minor / bass low A
    ];

    chords.forEach((chord, step) => {
      chord.forEach(freq => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t + step * 0.35);
        gain.gain.setValueAtTime(0.06, t + step * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, t + step * 0.35 + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, t);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + step * 0.35);
        osc.stop(t + step * 0.35 + 0.6);
      });
    });
  }
}

export const sound = new AudioSynth();
