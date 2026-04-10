import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * Old-style radio that plays vintage French music with lo-fi effects.
 * Uses THREE.PositionalAudio for 3D spatialization.
 * Applies low-pass filter + crackle overlay for authentic old radio sound.
 */
export class RadioPlayer {
  constructor(listener) {
    this.group = new THREE.Group();
    this.group.name = 'RadioPlayer';
    this._listener = listener;
    this._sound = null;
    this._audioCtx = null;
    this._tracks = [];
    this._currentTrack = 0;
    this._playing = false;
    this._crackleSource = null;

    this._build();
    // Interaction hitbox — click to skip track
    const hitGeo = new THREE.BoxGeometry(1.2, 0.8, 0.6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitZone = new THREE.Mesh(hitGeo, hitMat);
    this.hitZone.position.y = 0.35;
    this.hitZone.userData = {
      interactable: true,
      action: 'radio_next',
      label: '[Click] 📻 Changer de chanson',
    };
    this.group.add(this.hitZone);
  }

  _build() {
    // ── Radio body (vintage wooden box) ──
    const woodMat = createMaterial(0x6a4a2a, 0.7, 0.05);

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.5), woodMat);
    body.position.y = 0.35;
    body.castShadow = true;
    this.group.add(body);

    // Speaker grille (front face)
    const grilleMat = createMaterial(0x3a2a1a, 0.8, 0.0);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.02), grilleMat);
    grille.position.set(0, 0.3, 0.26);
    this.group.add(grille);

    // Grille slats
    const slatMat = createMaterial(0x2a1a0a, 0.7, 0.0);
    for (let y = -0.15; y <= 0.15; y += 0.06) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.03), slatMat);
      slat.position.set(0, 0.3 + y, 0.27);
      this.group.add(slat);
    }

    // Tuning dial
    const dialMat = createMaterial(0xddcc88, 0.3, 0.5);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), dialMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.3, 0.55, 0.27);
    this.group.add(dial);

    // Volume knob
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), dialMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.3, 0.55, 0.27);
    this.group.add(knob);

    // Indicator light (glows when playing)
    this._indicatorMat = createGlowMaterial(0x22aa44, 0.0);
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      this._indicatorMat,
    );
    indicator.position.set(0, 0.6, 0.26);
    this.group.add(indicator);
    this._indicator = indicator;

    // Point light from indicator
    this._indicatorLight = new THREE.PointLight(0x22aa44, 0, 3);
    this._indicatorLight.position.set(0, 0.6, 0.3);
    this.group.add(this._indicatorLight);

    // Warm dial backlight
    this._dialLight = new THREE.PointLight(0xddcc88, 0, 2);
    this._dialLight.position.set(0, 0.55, 0.3);
    this.group.add(this._dialLight);

    // Top lip/rim
    const rimMat = createMaterial(0x5a3a1a, 0.6, 0.1);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 0.55), rimMat);
    rim.position.set(0, 0.72, 0);
    this.group.add(rim);

    // Antenna (thin wire)
    const antennaMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4),
      antennaMat,
    );
    antenna.position.set(0.35, 1.1, -0.1);
    antenna.rotation.z = -0.15;
    this.group.add(antenna);

    // Small table/shelf under the radio
    const shelfMat = createMaterial(0x5a4a3e, 0.65, 0.1);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.55), shelfMat);
    shelf.position.y = -0.01;
    shelf.receiveShadow = true;
    this.group.add(shelf);

    // Wall bracket
    const bracketMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    for (const x of [-0.5, 0.5]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), bracketMat);
      bracket.position.set(x, -0.03, -0.1);
      this.group.add(bracket);
    }
  }

  /**
   * Initialize audio and start playing tracks.
   * @param {AudioContext} audioCtx — shared audio context
   * @param {string[]} trackUrls — array of MP3 URLs
   */
  async start(audioCtx, trackUrls, withIntro = false) {
    if (this._playing) return;
    this._audioCtx = audioCtx;
    this._tracks = trackUrls;
    this._playing = true;

    // Indicator on
    this._indicatorMat.emissiveIntensity = 0.6;
    this._indicatorLight.intensity = 1.5;
    this._dialLight.intensity = 0.8;

    // Create positional audio
    this._sound = new THREE.PositionalAudio(this._listener);
    this._sound.setRefDistance(2);
    this._sound.setRolloffFactor(1.0);
    this._sound.setDistanceModel('inverse');
    this._sound.setMaxDistance(25);
    
    // Volume gain for fade-in effect
    this._masterGain = audioCtx.createGain();
      this._masterGain.gain.value = 0.2;
    this._sound.setVolume(0.5); // Manage volume through our masterGain

    this.group.add(this._sound);

    // Start background vinyl crackle
    this._startCrackle(audioCtx);

    // Fade in: start from crackle only, music fades in gradually
    if (withIntro) {
      this._masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      this._masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
      this._masterGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 3.0);
      this._masterGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 6.0);
      this._masterGain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 9.0);
    }

    // Shuffle playlist and start
    this._currentTrack = 0;
    this._shufflePlaylist();
    await this._playTrack();
  }

  /** Fisher-Yates shuffle of the track list. */
  _shufflePlaylist() {
    const arr = this._tracks;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  async _playTrack() {
    if (!this._playing || this._tracks.length === 0) return;

    const url = this._tracks[this._currentTrack % this._tracks.length];

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer);

      if (!this._playing) return;

      // Apply lo-fi radio processing via the gain node's context
      this._sound.setBuffer(audioBuffer);
      this._sound.setLoop(false);

      // Low-pass filter for old radio sound
      const filter = this._audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
      filter.Q.value = 0.7;

      // High-pass to remove sub-bass (small speaker)
      const hpFilter = this._audioCtx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 200;

      // Connect through our custom master gain
      this._sound.setFilters([hpFilter, filter, this._masterGain]);
      this._sound.play();
      this._trackEnded = false;
      this._trackStarted = true;
    } catch (e) {
      console.warn('Radio: failed to load track', url, e);
      // Skip to next track
      this._currentTrack++;
      setTimeout(() => this._playTrack(), 3000);
    }
  }

  _startCrackle(ctx) {
    // Continuous vinyl crackle — very quiet noise bursts
    const sampleRate = ctx.sampleRate;
    const duration = 4;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      // Mostly silence with occasional pops
      if (Math.random() < 0.002) {
        data[i] = (Math.random() - 0.5) * 0.3;
      } else {
        data[i] = (Math.random() - 0.5) * 0.008;
      }
    }

    this._crackleSound = new THREE.PositionalAudio(this._listener);
    this._crackleSound.setBuffer(buffer);
    this._crackleSound.setLoop(true);
    this._crackleSound.setVolume(0.15);
    this._crackleSound.setRefDistance(1.5);
    this._crackleSound.setRolloffFactor(1.5);
    this._crackleSound.setDistanceModel('inverse');
    this.group.add(this._crackleSound);
    this._crackleSound.play();
  }

  /** Skip to next track. */
  nextTrack() {
    if (!this._playing) return;
    if (this._sound?.isPlaying) this._sound.stop();
    this._currentTrack++;
    this._playTrack();
  }

  stop() {
    this._playing = false;
    if (this._sound?.isPlaying) this._sound.stop();
    if (this._crackleSound?.isPlaying) this._crackleSound.stop();
    this._indicatorMat.emissiveIntensity = 0.0;
    this._indicatorLight.intensity = 0;
    this._dialLight.intensity = 0;
  }

  update(dt) {
    if (!this._playing) return;
    // Indicator light pulsing
    const t = Date.now() * 0.002;
    const pulse = 0.4 + Math.sin(t) * 0.2;
    this._indicatorMat.emissiveIntensity = pulse;
    this._indicatorLight.intensity = 0.8 + Math.sin(t) * 0.5;
    this._dialLight.intensity = 0.5 + Math.sin(t * 0.7) * 0.2;

    // Auto-advance to next track when current finishes
    if (this._sound && !this._sound.isPlaying && !this._trackEnded && this._trackStarted) {
      this._trackEnded = true;
      this._trackStarted = false;
      this._currentTrack++;
      setTimeout(() => this._playTrack(), 1200 + Math.random() * 1800);
    }
  }
}
