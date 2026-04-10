import * as THREE from 'three';

/**
 * Ambient horror system.
 *  - Random room-wide light flicker (central + fluorescent + ambient)
 *    with electrical pop/buzz sounds.
 *  - Distant oppressive sounds coming from outside the walls:
 *    thuds, metal scraping, pipe groans, rumbles, muffled impacts, alarms.
 */
export class AmbientHorror {
  constructor(listener) {
    this.group = new THREE.Group();
    this.group.name = 'AmbientHorror';
    this._listener = listener;
    this._started = false;
    this._audioCtx = null;

    // Timers
    this._flickerTimer = 20 + Math.random() * 40;
    this._distantTimer = 25 + Math.random() * 25;

    // Stress level (0–1), spikes on events, decays over time
    this.stress = 0;

    // Light references (set via setLights)
    this._centralLight = null;
    this._ambientLight = null;
    this._fluorescentLights = [];
    this._centralBaseIntensity = 6.0;
    this._ambientBaseIntensity = 0.05;

    // Positions outside the room walls
    this._outsidePositions = [
      new THREE.Vector3(0, 1.5, -9),
      new THREE.Vector3(0, 1.5, 9),
      new THREE.Vector3(-9, 1.5, 0),
      new THREE.Vector3(9, 1.5, 0),
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(-9, 0.5, -9),
      new THREE.Vector3(9, 0.5, 9),
      new THREE.Vector3(0, -2, 0),
      new THREE.Vector3(-9, 2, 5),
      new THREE.Vector3(9, 2, -5),
    ];
  }

  setLights(centralLight, ambientLight, fluorescentLights) {
    this._centralLight = centralLight;
    this._ambientLight = ambientLight;
    this._fluorescentLights = fluorescentLights || [];
    if (centralLight) this._centralBaseIntensity = centralLight.intensity;
    if (ambientLight) this._ambientBaseIntensity = ambientLight.intensity;
  }

  startSound(audioCtx) {
    if (this._started || !audioCtx) return;
    this._started = true;
    this._audioCtx = audioCtx;
  }

  update(dt) {
    if (!this._started) return;

    // Decay stress
    this.stress *= Math.exp(-dt * 1.2);
    if (this.stress < 0.01) this.stress = 0;

    this._flickerTimer -= dt;
    if (this._flickerTimer <= 0) {
      this._triggerFlicker();
      this._flickerTimer = 30 + Math.random() * 60;
    }

    this._distantTimer -= dt;
    if (this._distantTimer <= 0) {
      this._playDistantSound();
      this._distantTimer = 18 + Math.random() * 45;
    }
  }

  /* ══════════════════════════════════════════════════
   *  LIGHT FLICKER
   * ══════════════════════════════════════════════════ */

  _triggerFlicker() {
    const r = Math.random();
    if (r < 0.35) this._quickStutter();
    else if (r < 0.65) this._brownout();
    else this._singlePop();
    this._playElectricalPop();
    this.stress = Math.min(1, this.stress + 0.5 + Math.random() * 0.4);
  }

  /** Rapid on/off stuttering. */
  _quickStutter() {
    if (!this._centralLight) return;
    const flickers = 4 + Math.floor(Math.random() * 8);
    let count = 0;
    const id = setInterval(() => {
      const on = count % 2 === 1;
      this._setAllLights(
        on ? this._centralBaseIntensity : this._centralBaseIntensity * 0.03,
        on ? this._ambientBaseIntensity : 0.008,
        !on,
      );
      count++;
      if (count > flickers) {
        clearInterval(id);
        this._restoreLights();
      }
    }, 25 + Math.random() * 45);
  }

  /** Slow dim → hold → surge back. */
  _brownout() {
    if (!this._centralLight) return;
    const steps = 12;
    const holdMs = 800 + Math.random() * 2000;
    let step = 0;

    const dimId = setInterval(() => {
      step++;
      const t = step / steps;
      this._setAllLights(
        this._centralBaseIntensity * (1 - t * 0.9),
        this._ambientBaseIntensity * (1 - t * 0.8),
        t > 0.4,
      );
      if (step >= steps) {
        clearInterval(dimId);
        setTimeout(() => {
          // surge back with brief overshoot
          let s = 0;
          const surgeId = setInterval(() => {
            s++;
            const overshoot = s < 4 ? 1.3 - s * 0.075 : 1;
            this._setAllLights(
              this._centralBaseIntensity * overshoot,
              this._ambientBaseIntensity,
              false,
            );
            if (s >= 5) {
              clearInterval(surgeId);
              this._restoreLights();
            }
          }, 40);
          this._playElectricalPop();
        }, holdMs);
      }
    }, 30);
  }

  /** Single blackout pop → instant return. */
  _singlePop() {
    if (!this._centralLight) return;
    this._setAllLights(0, 0.005, true);
    setTimeout(() => {
      this._setAllLights(this._centralBaseIntensity * 1.35, this._ambientBaseIntensity, false);
      setTimeout(() => this._restoreLights(), 90);
    }, 60 + Math.random() * 160);
  }

  _setAllLights(central, ambient, fluorDim) {
    if (this._centralLight) this._centralLight.intensity = central;
    if (this._ambientLight) this._ambientLight.intensity = ambient;
    for (const fl of this._fluorescentLights) {
      if (fluorDim) {
        fl._tubeMat.emissiveIntensity = 0.08;
        for (const l of fl._lights) l.intensity = 0.03;
      } else {
        fl._tubeMat.emissiveIntensity = 1.0;
        for (const l of fl._lights) l.intensity = fl._baseIntensity;
      }
    }
  }

  _restoreLights() {
    this._setAllLights(this._centralBaseIntensity, this._ambientBaseIntensity, false);
  }

  /* ══════════════════════════════════════════════════
   *  ELECTRICAL POP (at ceiling light)
   * ══════════════════════════════════════════════════ */

  _playElectricalPop() {
    const ctx = this._audioCtx;
    if (!ctx) return;

    const sound = new THREE.PositionalAudio(this._listener);
    sound.setRefDistance(3);
    sound.setRolloffFactor(1.0);
    sound.setDistanceModel('exponential');
    sound.setMaxDistance(20);

    const sr = ctx.sampleRate;
    const dur = 0.18;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 35);
      const pop = (Math.random() * 2 - 1) * env;
      const thump = Math.sin(t * Math.PI * 2 * 80) * env * 0.5;
      const crackle = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.6;
      d[i] = (pop + thump + crackle) * 0.25;
    }

    sound.setBuffer(buf);
    sound.setVolume(0.25 + Math.random() * 0.2);
    this.group.add(sound);
    sound.play();
    setTimeout(() => {
      if (sound.isPlaying) sound.stop();
      this.group.remove(sound);
    }, 400);
  }

  /* ══════════════════════════════════════════════════
   *  DISTANT OPPRESSIVE SOUNDS (outside walls)
   * ══════════════════════════════════════════════════ */

  _playDistantSound() {
    const ctx = this._audioCtx;
    if (!ctx) return;

    const type = Math.floor(Math.random() * 7);
    const pos = this._outsidePositions[Math.floor(Math.random() * this._outsidePositions.length)];

    this.stress = Math.min(1, this.stress + 0.15 + Math.random() * 0.25);

    switch (type) {
      case 0: this._playDeepThud(pos); break;
      case 1: this._playMetalScrape(pos); break;
      case 2: this._playPipeGroan(pos); break;
      case 3: this._playDistantRumble(pos); break;
      case 4: this._playMuffledImpact(pos); break;
      case 5: this._playDistantAlarm(pos); break;
      case 6: this._playHeavyDoor(pos); break;
    }
  }

  _createDistantAudio(pos) {
    const sound = new THREE.PositionalAudio(this._listener);
    sound.setRefDistance(5);
    sound.setRolloffFactor(0.6);
    sound.setDistanceModel('exponential');
    sound.setMaxDistance(35);

    const anchor = new THREE.Object3D();
    anchor.position.copy(pos);
    this.group.add(anchor);
    anchor.add(sound);
    return { sound, anchor };
  }

  _cleanupDistant(obj, ms) {
    setTimeout(() => {
      if (obj.sound.isPlaying) obj.sound.stop();
      obj.anchor.remove(obj.sound);
      this.group.remove(obj.anchor);
    }, ms + 600);
  }

  /** Heavy metallic thud. */
  _playDeepThud(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 1.0;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 4.5);
      const hit = Math.sin(t * Math.PI * 2 * 38) * env;
      const rattle = Math.sin(t * Math.PI * 2 * 110) * Math.exp(-t * 10) * 0.25;
      const noise = (Math.random() * 2 - 1) * env * 0.12;
      d[i] = (hit + rattle + noise) * 0.3;
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.15 + Math.random() * 0.1);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Slow grinding scrape. */
  _playMetalScrape(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 2.0 + Math.random() * 1.5;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    const baseFreq = 600 + Math.random() * 500;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin(t / dur * Math.PI);
      const noise = Math.random() * 2 - 1;
      const sweep = Math.sin(t * Math.PI * 2 * (baseFreq + Math.sin(t * 0.8) * 300));
      d[i] = (noise * 0.35 + sweep * 0.25) * env * 0.1;
    }
    // Muffle through walls
    for (let p = 0; p < 5; p++) {
      for (let i = 1; i < len - 1; i++) d[i] = (d[i - 1] + d[i] + d[i + 1]) / 3;
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.08 + Math.random() * 0.06);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Low metallic moan. */
  _playPipeGroan(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 3.0 + Math.random();
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    const base = 45 + Math.random() * 25;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin(t / dur * Math.PI) * Math.min(1, t * 2.5);
      const vibrato = Math.sin(t * Math.PI * 2 * 5.5) * 10;
      const freq = base + vibrato + Math.sin(t * 0.4) * 12;
      const saw = ((t * freq) % 1) * 2 - 1;
      const harm = Math.sin(t * Math.PI * 2 * freq * 2) * 0.25;
      d[i] = (saw * 0.55 + harm) * env * 0.1;
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.12 + Math.random() * 0.08);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Sub-bass vibration. */
  _playDistantRumble(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 4.0 + Math.random() * 2;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin(t / dur * Math.PI);
      const sub = Math.sin(t * Math.PI * 2 * 22) * 0.5;
      const noise = (Math.random() * 2 - 1) * 0.25;
      d[i] = (sub + noise) * env * 0.12;
    }
    // Heavy low-pass
    for (let p = 0; p < 10; p++) {
      for (let i = 2; i < len - 2; i++) {
        d[i] = (d[i - 2] + d[i - 1] + d[i] + d[i + 1] + d[i + 2]) / 5;
      }
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.18 + Math.random() * 0.1);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Something hitting a wall. */
  _playMuffledImpact(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 0.6;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 7);
      const hit = Math.sin(t * Math.PI * 2 * 55) * env;
      const rattle = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.35;
      d[i] = (hit + rattle) * 0.22;
    }
    // Muffle
    for (let p = 0; p < 8; p++) {
      for (let i = 1; i < len - 1; i++) d[i] = (d[i - 1] + d[i] + d[i + 1]) / 3;
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.12 + Math.random() * 0.1);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Muffled alternating alarm tones. */
  _playDistantAlarm(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 2.5 + Math.random() * 2;
    const cycles = 3 + Math.floor(Math.random() * 5);
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    const freqA = 550 + Math.random() * 250;
    const freqB = freqA * 1.3;
    const cycleLen = dur / cycles;

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin(t / dur * Math.PI);
      const freq = (t % cycleLen) / cycleLen < 0.5 ? freqA : freqB;
      d[i] = Math.sin(t * Math.PI * 2 * freq) * env * 0.06;
    }
    // Heavy muffle (through walls)
    for (let p = 0; p < 12; p++) {
      for (let i = 2; i < len - 2; i++) {
        d[i] = (d[i - 2] + d[i - 1] + d[i] + d[i + 1] + d[i + 2]) / 5;
      }
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.05 + Math.random() * 0.04);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }

  /** Heavy door slam + metallic echo. */
  _playHeavyDoor(pos) {
    const ctx = this._audioCtx;
    const sr = ctx.sampleRate;
    const dur = 1.5;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // Initial slam
      const slam = Math.exp(-t * 6) * Math.sin(t * Math.PI * 2 * 50);
      // Metallic ringing echo
      const ring = Math.exp(-t * 3) * Math.sin(t * Math.PI * 2 * 180) * 0.15;
      // Rattle
      const rattle = Math.exp(-t * 5) * (Math.random() * 2 - 1) * 0.2;
      // Late resonance
      const res = Math.exp(-(t - 0.15) * 4) * Math.sin(t * Math.PI * 2 * 90) * 0.12 * (t > 0.12 ? 1 : 0);
      d[i] = (slam + ring + rattle + res) * 0.2;
    }
    // Slight muffle
    for (let p = 0; p < 4; p++) {
      for (let i = 1; i < len - 1; i++) d[i] = (d[i - 1] + d[i] + d[i + 1]) / 3;
    }

    const obj = this._createDistantAudio(pos);
    obj.sound.setBuffer(buf);
    obj.sound.setVolume(0.14 + Math.random() * 0.1);
    obj.sound.play();
    this._cleanupDistant(obj, dur * 1000);
  }
}
