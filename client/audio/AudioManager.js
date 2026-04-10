/**
 * Lightweight audio manager using Web Audio API.
 * Synthesizes sounds procedurally — no external audio files needed.
 */
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._initialized = false;

    const initOnClick = () => {
      if (!this._initialized) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._initialized = true;
      }
      document.removeEventListener('click', initOnClick);
      document.removeEventListener('keydown', initOnClick);
    };
    document.addEventListener('click', initOnClick);
    document.addEventListener('keydown', initOnClick);
  }

  play(type) {
    if (!this._enabled || !this._ctx) return;
    try {
      switch (type) {
        case 'pull':    this._playPull(); break;
        case 'extract': this._playExtract(); break;
        case 'perfect': this._playPerfect(); break;
        case 'burn':    this._playBurn(); break;
        case 'score':   this._playScore(); break;
        case 'fever':   this._playFever(); break;
        case 'success': this._playSuccess(); break;
        case 'fail':    this._playFail(); break;
        case 'click':   this._playClick(); break;
        case 'lock':    this._playLock(); break;
        case 'buy':     this._playBuy(); break;
        case 'combo':   this._playCombo(); break;
        case 'tick':    this._playTick(); break;
        case 'craft':   this._playCraft(); break;
      }
    } catch { /* ctx suspended */ }
  }

  /* ── New sounds ── */

  /** Quick soft tick during recipe roll slot changes. */
  _playTick() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  /** Grinding/mechanical crafting loop (~2.5s). */
  _playCraft() {
    const ctx = this._ctx;
    // Low rumble
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(120, ctx.currentTime + 1.2);
    osc1.frequency.linearRampToValueAtTime(80, ctx.currentTime + 2.4);
    gain1.gain.setValueAtTime(0.06, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime + 1.0);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 2.5);

    // High whirr
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(600, ctx.currentTime + 1.5);
    osc2.frequency.linearRampToValueAtTime(200, ctx.currentTime + 2.4);
    gain2.gain.setValueAtTime(0.03, ctx.currentTime);
    gain2.gain.setValueAtTime(0.05, ctx.currentTime + 1.0);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 2.5);

    // Rhythmic clank hits
    for (let i = 0; i < 8; i++) {
      const t = ctx.currentTime + i * 0.3;
      const noise = ctx.createOscillator();
      const ng = ctx.createGain();
      noise.connect(ng);
      ng.connect(ctx.destination);
      noise.type = 'triangle';
      noise.frequency.setValueAtTime(150 + Math.random() * 100, t);
      ng.gain.setValueAtTime(0.06, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      noise.start(t);
      noise.stop(t + 0.08);
    }
  }

  /* ── Existing sounds ── */

  _playPull() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  }

  _playExtract() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  }

  _playPerfect() {
    const ctx = this._ctx;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.3);
    });
  }

  _playBurn() {
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    source.connect(gain); gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  }

  _playScore() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
  }

  _playFever() {
    const ctx = this._ctx;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.4);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.4);
    });
  }

  _playSuccess() {
    const ctx = this._ctx;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  }

  _playFail() {
    const ctx = this._ctx;
    [400, 350, 300, 200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  }

  _playClick() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  }

  _playLock() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  }

  _playBuy() {
    const ctx = this._ctx;
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  }

  _playCombo() {
    const ctx = this._ctx;
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.10, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.35);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.35);
    });
  }

  toggle() { this._enabled = !this._enabled; return this._enabled; }
}
