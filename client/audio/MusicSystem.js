/**
 * Procedural factory music — bright but oppressive.
 * Inspired by Papers Please / Infinifactory.
 *
 * Layers:
 *   1. Bass drone (Gm pedal, sawtooth, low-pass filtered)
 *   2. Arpeggiated bright melody (square wave, Gm pentatonic)
 *   3. Industrial percussion (noise bursts, filtered clicks)
 *   4. Pad chord wash (triangle, slow Gm-Cm-D-Gm progression)
 *   5. High metallic ping (sine, random pentatonic notes)
 *
 * Dynamics follow musical phrasing, not randomness:
 *   - 4-bar phrases: build → peak at bar 3 → resolve bar 4
 *   - Beat accents: 1 strong, 3 medium, 2/4 ghost
 *   - Chord tension: i(p) → iv(mf) → V(f) → i(p)
 *
 * Reverb via procedural impulse response convolver.
 */
export class MusicSystem {
  constructor() {
    this._ctx = null;
    this._playing = false;
    this._masterGain = null;
    this._reverbSend = null;
    this._dryGain = null;
    this._layers = [];
    this._bpm = 110;
    this._beat = 0;
    this._bar = 0;         // which bar in 4-bar phrase (0-3)
    this._phraseBar = 0;   // absolute bar count
    this._intervalId = null;

    // Gm pentatonic: G3 Bb3 C4 D4 F4 G4 Bb4 C5 D5 F5 G5
    this._scale = [196, 233, 262, 294, 349, 392, 466, 523, 587, 698, 784];

    // Chord progression: Gm(i) - Cm(iv) - D(V) - Gm(i)
    // Each chord lasts 4 beats (1 bar)
    this._chords = [
      { notes: [196, 233, 294], tension: 0.7 },  // Gm: resolve (quiet)
      { notes: [262, 311, 392], tension: 0.85 },  // Cm: building
      { notes: [294, 370, 440], tension: 1.0 },   // D:  peak tension
      { notes: [196, 233, 294], tension: 0.6 },   // Gm: release
    ];
    this._chordIndex = 0;

    this._initialized = false;
  }

  init(audioCtx) {
    if (this._initialized) return;
    this._ctx = audioCtx;
    this._initialized = true;

    // ── Master bus ──
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0;
    this._masterGain.connect(this._ctx.destination);

    // ── Reverb (convolver with procedural IR) ──
    this._setupReverb();

    // ── Dry bus ──
    this._dryGain = this._ctx.createGain();
    this._dryGain.gain.value = 0.65; // dry level
    this._dryGain.connect(this._masterGain);
  }

  _setupReverb() {
    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const duration = 2.2; // reverb tail length
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    // Generate stereo impulse response: exponential decay + early reflections
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Main decay
        const envelope = Math.exp(-t * 3.0);
        // Early reflections (discrete echoes in first 80ms)
        let early = 0;
        if (t < 0.08) {
          const earlyTimes = [0.012, 0.024, 0.037, 0.053, 0.071];
          for (const et of earlyTimes) {
            if (Math.abs(t - et) < 0.001) early = 0.4 * (ch === 0 ? 1 : -1);
          }
        }
        // Diffuse noise tail
        const noise = (Math.random() * 2 - 1);
        data[i] = (noise * envelope * 0.3 + early) * 0.8;
      }
    }

    this._convolver = ctx.createConvolver();
    this._convolver.buffer = impulse;

    // Pre-delay (15ms)
    this._reverbDelay = ctx.createDelay(0.1);
    this._reverbDelay.delayTime.value = 0.015;

    // Reverb EQ: cut low end, boost high-mids for clarity
    this._reverbEQ = ctx.createBiquadFilter();
    this._reverbEQ.type = 'highpass';
    this._reverbEQ.frequency.value = 300;

    // Wet level
    this._wetGain = ctx.createGain();
    this._wetGain.gain.value = 0.35;

    // Chain: send → delay → convolver → EQ → wet gain → master
    this._reverbSend = ctx.createGain();
    this._reverbSend.gain.value = 1.0;
    this._reverbSend.connect(this._reverbDelay);
    this._reverbDelay.connect(this._convolver);
    this._convolver.connect(this._reverbEQ);
    this._reverbEQ.connect(this._wetGain);
    this._wetGain.connect(this._masterGain);
  }

  /** Connect a node to both dry and reverb buses. */
  _connectWithReverb(node, reverbAmount = 0.4) {
    node.connect(this._dryGain);
    const sendGain = this._ctx.createGain();
    sendGain.gain.value = reverbAmount;
    node.connect(sendGain);
    sendGain.connect(this._reverbSend);
  }

  start() {
    if (!this._ctx || this._playing) return;
    this._playing = true;
    this._beat = 0;
    this._bar = 0;
    this._phraseBar = 0;
    this._chordIndex = 0;

    // Fade in
    this._masterGain.gain.setValueAtTime(0, this._ctx.currentTime);
    this._masterGain.gain.linearRampToValueAtTime(0.4, this._ctx.currentTime + 3);

    this._startDrone();
    this._updatePad();

    const beatMs = (60 / this._bpm) * 1000;
    this._intervalId = setInterval(() => this._tick(), beatMs);
  }

  stop() {
    if (!this._playing) return;
    this._playing = false;
    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 1.5);
    }
    clearInterval(this._intervalId);
    this._intervalId = null;
    setTimeout(() => {
      for (const layer of this._layers) {
        try { layer.stop(); } catch { /* already stopped */ }
      }
      this._layers = [];
    }, 1800);
  }

  setVolume(v) {
    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(v, this._ctx.currentTime + 0.1);
    }
  }

  // ── Dynamics helpers ──

  /** Get dynamic multiplier for current beat within a bar (0-3). */
  _beatAccent(beatInBar) {
    // Beat 1: strong, Beat 3: medium, Beat 2/4: ghost
    const accents = [1.0, 0.55, 0.8, 0.5];
    return accents[beatInBar % 4];
  }

  /** Get phrase dynamic curve (4-bar phrase: build → peak → resolve). */
  _phraseDynamic() {
    // Bar 0: mp (0.65), Bar 1: mf (0.8), Bar 2: f (1.0), Bar 3: p (0.55)
    const dynamics = [0.65, 0.8, 1.0, 0.55];
    return dynamics[this._bar % 4];
  }

  /** Combined dynamic for current moment. */
  _dynamic(beatInBar) {
    const chord = this._chords[this._chordIndex % this._chords.length];
    return this._beatAccent(beatInBar) * this._phraseDynamic() * chord.tension;
  }

  // ── Bass drone ──

  _startDrone() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 98; // G2

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.06; // much quieter bass

    // Slow LFO on filter cutoff
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    osc.connect(filter);
    filter.connect(gain);
    this._connectWithReverb(gain, 0.2); // light reverb on bass
    osc.start();

    this._layers.push(osc, lfo);
  }

  // ── Pad chords ──

  _updatePad() {
    if (!this._playing) return;
    const ctx = this._ctx;
    const chord = this._chords[this._chordIndex % this._chords.length];
    const dur = (60 / this._bpm) * 4;
    const now = ctx.currentTime;

    // Pad volume follows chord tension
    const padVol = 0.025 * chord.tension;

    for (const freq of chord.notes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq / 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(padVol, now + 0.6);
      gain.gain.setValueAtTime(padVol, now + dur - 0.6);
      gain.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(gain);
      this._connectWithReverb(gain, 0.6); // heavy reverb on pad
      osc.start(now);
      osc.stop(now + dur + 0.2);
    }
  }

  // ── Per-beat tick ──

  _tick() {
    if (!this._playing || !this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const beatInBar = this._beat % 4;

    // Bar / phrase tracking
    if (beatInBar === 0 && this._beat > 0) {
      this._phraseBar++;
      this._bar = this._phraseBar % 4;
      // Chord change every bar
      this._chordIndex = this._phraseBar % this._chords.length;
      this._updatePad();
    }

    const dyn = this._dynamic(beatInBar);
    const chord = this._chords[this._chordIndex % this._chords.length];

    // ── Arpeggio (every beat) ──
    {
      const arpNote = chord.notes[beatInBar % chord.notes.length] * 2;
      const vol = 0.045 * dyn;

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = arpNote;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Brighter on strong beats
      filter.frequency.value = 1200 + dyn * 1200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      this._connectWithReverb(gain, 0.45);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    // ── 16th note runs on strong beats (1 and 3) ──
    if (beatInBar === 0 || beatInBar === 2) {
      const sixteenth = 60 / this._bpm / 4;
      for (let i = 1; i <= 3; i++) {
        const t = now + i * sixteenth;
        // Ascending velocity within the run
        const runVol = 0.02 * dyn * (0.5 + i * 0.18);
        const noteIdx = (this._phraseBar * 3 + i) % this._scale.length;
        const note = this._scale[noteIdx];

        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = note;
        const g = ctx.createGain();
        g.gain.setValueAtTime(runVol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g);
        this._connectWithReverb(g, 0.5);
        o.start(t);
        o.stop(t + 0.12);
      }
    }

    // ── Percussion ──
    this._playPerc(now, beatInBar, dyn);

    // ── Metallic ping (bar 3, beat 1 = peak of phrase) ──
    if (this._bar === 2 && beatInBar === 0) {
      const pingFreq = this._scale[7 + (this._phraseBar % 4)];
      const ping = ctx.createOscillator();
      ping.type = 'sine';
      ping.frequency.value = pingFreq;
      const pGain = ctx.createGain();
      pGain.gain.setValueAtTime(0.04 * dyn, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      ping.connect(pGain);
      this._connectWithReverb(pGain, 0.7); // lots of reverb on ping
      ping.start(now);
      ping.stop(now + 1.1);
    }

    this._beat++;
  }

  _playPerc(now, beatInBar, dyn) {
    const ctx = this._ctx;

    // Kick on 1 and 3 — dynamic volume
    if (beatInBar === 0 || beatInBar === 2) {
      const kickVol = beatInBar === 0 ? 0.08 * dyn : 0.05 * dyn;
      const kick = ctx.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(140, now);
      kick.frequency.exponentialRampToValueAtTime(35, now + 0.07);
      const kGain = ctx.createGain();
      kGain.gain.setValueAtTime(kickVol, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      kick.connect(kGain);
      kGain.connect(this._dryGain); // kick stays dry
      kick.start(now);
      kick.stop(now + 0.15);
    }

    // Hi-hat — accent on beat, ghost on offbeat
    {
      const hatVol = (beatInBar % 2 === 0) ? 0.03 * dyn : 0.015 * dyn;
      const bufLen = Math.floor(ctx.sampleRate * 0.035);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
      }
      const hat = ctx.createBufferSource();
      hat.buffer = buf;
      const hatFilter = ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.value = 9000;
      const hatGain = ctx.createGain();
      hatGain.gain.setValueAtTime(hatVol, now);
      hat.connect(hatFilter);
      hatFilter.connect(hatGain);
      this._connectWithReverb(hatGain, 0.25);
      hat.start(now);
    }

    // Industrial clank on 2 and 4 (offbeat) — softer, creates groove
    if (beatInBar === 1 || beatInBar === 3) {
      const clankVol = 0.035 * dyn;
      const clank = ctx.createOscillator();
      clank.type = 'triangle';
      // Pitch varies by phrase position for interest
      clank.frequency.value = 180 + (this._phraseBar % 3) * 40;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(clankVol, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      clank.connect(cGain);
      this._connectWithReverb(cGain, 0.4);
      clank.start(now);
      clank.stop(now + 0.06);
    }
  }
}
