import type { GameEvent } from '../game/types';
import type { Preferences } from './storage';

/** Small, original oscillator cues. Audio context is created only after a user gesture. */
export class ArcadeAudio {
  private context: AudioContext | null = null;
  private preferences: Preferences;

  constructor(preferences: Preferences) { this.preferences = preferences; }

  unlock(): void {
    if (!this.context) {
      const AudioCtor = window.AudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setPreferences(preferences: Preferences): void { this.preferences = preferences; }

  private tone(frequency: number, endFrequency: number, duration: number, wave: OscillatorType, strength = 0.13): void {
    if (this.preferences.muted || this.preferences.volume <= 0 || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, strength * this.preferences.volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  ui(): void { this.tone(520, 690, 0.08, 'sine', 0.09); }

  play(event: GameEvent): void {
    switch (event.type) {
      case 'shot': this.tone(event.owner === 'player' ? 780 : 210, event.owner === 'player' ? 260 : 130, event.owner === 'player' ? 0.1 : 0.13, 'square', event.owner === 'player' ? 0.055 : 0.035); break;
      case 'explosion': this.tone(event.target === 'player' ? 180 : 340, 45, event.target === 'player' ? 0.42 : 0.18, 'sawtooth', 0.11); break;
      case 'extra-life': this.tone(520, 1040, 0.28, 'triangle', 0.13); break;
      case 'wave-clear': this.tone(320, 820, 0.42, 'triangle', 0.12); break;
      case 'game-over': this.tone(260, 70, 0.65, 'sawtooth', 0.1); break;
    }
  }
}
