/**
 * Lightweight audio manager using Web Audio API.
 * Synthesizes sounds procedurally — no external audio files needed.
 * Supports 3D positional audio via PannerNode.
 */
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._initialized = false;
  }

  /** Initialize with a shared AudioContext (from THREE.AudioListener). */
  init(audioCtx) {
    if (this._initialized) return;
    this._ctx = audioCtx;
    this._initialized = true;
  }

  /** Play a global (non-positional) sound. */
  play(type) {
    this._emit(type, null);
  }

  /** Play a 3D positional sound at a world position (THREE.Vector3). */
  playAt(type, position) {
    this._emit(type, position);
  }

  _emit(type, position) {
    if (!this._enabled || !this._ctx) return;
    try {
      const dest = position ? this._createPanner(position) : this._ctx.destination;
      switch (type) {
        case 'pull':    this._playPull(dest); break;
        case 'extract': this._playExtract(dest); break;
        case 'perfect': this._playPerfect(dest); break;
        case 'burn':    this._playBurn(dest); break;
        case 'score':   this._playScore(dest); break;
        case 'fever':   this._playFever(dest); break;
        case 'success': this._playSuccess(dest); break;
        case 'fail':    this._playFail(dest); break;
        case 'click':   this._playClick(dest); break;
        case 'lock':    this._playLock(dest); break;
        case 'buy':     this._playBuy(dest); break;
        case 'combo':   this._playCombo(dest); break;
        case 'tick':    this._playTick(dest); break;
        case 'craft':   this._playCraft(dest); break;
        case 'oven_start': this._playOvenStart(dest); break;
        case 'oven_hum':   this._playOvenHum(dest); break;
        case 'showcase':   this._playShowcase(dest); break;
        case 'notification': this._playNotification(dest); break;
      }
    } catch { /* ctx suspended */ }
  }

  _createPanner(pos) {
    const panner = this._ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.2;
    panner.positionX.setValueAtTime(pos.x, this._ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this._ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this._ctx.currentTime);
    panner.connect(this._ctx.destination);
    return panner;
  }

  /* ── Sounds ── */

  _playTick(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04);
  }

  _playCraft(dest) {
    const ctx = this._ctx;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(dest);
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(120, ctx.currentTime + 1.2);
    osc1.frequency.linearRampToValueAtTime(80, ctx.currentTime + 2.4);
    gain1.gain.setValueAtTime(0.06, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime + 1.0);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 2.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(dest);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(600, ctx.currentTime + 1.5);
    osc2.frequency.linearRampToValueAtTime(200, ctx.currentTime + 2.4);
    gain2.gain.setValueAtTime(0.03, ctx.currentTime);
    gain2.gain.setValueAtTime(0.05, ctx.currentTime + 1.0);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 2.5);

    for (let i = 0; i < 8; i++) {
      const t = ctx.currentTime + i * 0.3;
      const noise = ctx.createOscillator();
      const ng = ctx.createGain();
      noise.connect(ng); ng.connect(dest);
      noise.type = 'triangle';
      noise.frequency.setValueAtTime(150 + Math.random() * 100, t);
      ng.gain.setValueAtTime(0.06, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      noise.start(t); noise.stop(t + 0.08);
    }
  }

  _playPull(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  }

  _playExtract(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  }

  _playPerfect(dest) {
    const ctx = this._ctx;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.3);
    });
  }

  _playBurn(dest) {
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    source.connect(gain); gain.connect(dest);
    source.start(ctx.currentTime);
  }

  _playScore(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
  }

  _playFever(dest) {
    const ctx = this._ctx;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.4);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.4);
    });
  }

  _playSuccess(dest) {
    const ctx = this._ctx;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  }

  _playFail(dest) {
    const ctx = this._ctx;
    [400, 350, 300, 200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  }

  _playClick(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  }

  _playLock(dest) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  }

  _playBuy(dest) {
    const ctx = this._ctx;
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  }

  _playCombo(dest) {
    const ctx = this._ctx;
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.10, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.35);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.35);
    });
  }

  /** Cookie showcase pop — satisfying bright chime. */
  _playShowcase(dest) {
    const ctx = this._ctx;
    const t = ctx.currentTime;
    // Bright crystalline chime
    const freqs = [880, 1109, 1319];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.03);
      gain.gain.setValueAtTime(0.12, t + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.25);
      osc.start(t + i * 0.03);
      osc.stop(t + i * 0.03 + 0.25);
    });
    // Sub thump for weight
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.connect(subG); subG.connect(dest);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, t);
    sub.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    subG.gain.setValueAtTime(0.08, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    sub.start(t); sub.stop(t + 0.15);
  }

  /** CRT notification — two-tone digital beep. */
  _playNotification(dest) {
    const ctx = this._ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 1047 : 1319, t + i * 0.15);
      gain.gain.setValueAtTime(0.06, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.1);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.1);
    }
  }

  /** Oven start beep — two ascending tones. */
  _playOvenStart(dest) {
    const ctx = this._ctx;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.15);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.15);
    });
  }

  /** Oven hum — continuous low rumble for duration of cooking (~7s). */
  _playOvenHum(dest) {
    const ctx = this._ctx;
    const dur = 8;
    // Low electrical hum
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.04, ctx.currentTime + dur - 1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  }

  toggle() { this._enabled = !this._enabled; return this._enabled; }
}
