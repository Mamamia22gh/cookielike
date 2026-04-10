import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * Overhead industrial LED/fluorescent bar.
 * Emits light and a constant electrical hum with occasional crackling.
 */
export class FluorescentLight {
  constructor(listener, length = 9.0) {
    this.group = new THREE.Group();
    this.group.name = 'FluorescentLight';
    this._listener = listener;
    this._sound = null;
    this._started = false;
    this._crackleTimer = 0;
    this._baseIntensity = 0.5; // Lower intensity per light since we'll use multiple
    this._lights = [];

    this._build(length);
  }

  _build(length) {
    // Housing
    const housingMat = createMaterial(0x333333, 0.4, 0.6);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 0.2), housingMat);
    housing.position.y = 0.05;
    this.group.add(housing);

    // Tube
    this._tubeMat = createGlowMaterial(0xff2222, 1.0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, length - 0.1, 8), this._tubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.y = -0.02;
    this.group.add(tube);

    // Multiple point lights to simulate an area light / long tube
    const numLights = Math.floor(length / 2) || 1;
    const spacing = length / numLights;
    const startX = -length / 2 + spacing / 2;

    for (let i = 0; i < numLights; i++) {
      const light = new THREE.PointLight(0xff2222, this._baseIntensity, 8);
      light.position.set(startX + i * spacing, -0.1, 0);
      light.castShadow = true;
      light.shadow.bias = -0.002;
      this.group.add(light);
      this._lights.push(light);
    }

    // Hanging chains (shortened)
    const chainMat = createMaterial(PALETTE.metalDark, 0.2, 0.8);
    for (const x of [-length / 2 + 0.2, length / 2 - 0.2]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4), chainMat);
      chain.position.set(x, 0.05, 0);
      this.group.add(chain);
    }
  }

  startSound(audioCtx) {
    if (this._started || !audioCtx) return;
    this._started = true;

    this._sound = new THREE.PositionalAudio(this._listener);

    // Generate electric hum buffer (mix of 50Hz and 100Hz sine/saw)
    const sampleRate = audioCtx.sampleRate;
    const duration = 1.0;
    const bufferSize = sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 50Hz hum
      const hum50 = Math.sin(t * Math.PI * 2 * 50);
      // 100Hz buzz (rectified/harmonic)
      const buzz100 = Math.sin(t * Math.PI * 2 * 100) * 0.5;
      data[i] = (hum50 + buzz100) * 0.05;
    }

    this._sound.setBuffer(buffer);
    this._sound.setLoop(true);
    this._sound.setVolume(0.15); // quiet ambient hum
    this._sound.setRefDistance(2);
    this._sound.setRolloffFactor(1.5);
    this._sound.setDistanceModel('exponential');
    this._sound.setMaxDistance(10);

    this.group.add(this._sound);
    this._sound.play();

    // Crackle buffer (noise) for dynamic playback
    this._audioCtx = audioCtx;
    const crackleLen = sampleRate * 0.1; // 100ms
    this._crackleBuffer = audioCtx.createBuffer(1, crackleLen, sampleRate);
    const cData = this._crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleLen; i++) {
      cData[i] = (Math.random() - 0.5) * 0.15;
    }
  }

  update(dt) {
    if (!this._started) return;

    this._crackleTimer -= dt;

    if (this._crackleTimer <= 0) {
      if (Math.random() < 0.1) {
        // Trigger a crackle event
        this._playCrackle();
        this._crackleTimer = 10.0 + Math.random() * 20.0; // Wait 10-30s before next possible crackle burst
      } else {
        this._crackleTimer = 0.5; // check frequently
      }
    }
  }

  _playCrackle() {
    // Audio pop
    if (this._audioCtx && this._crackleBuffer) {
      const pop = new THREE.PositionalAudio(this._listener);
      pop.setBuffer(this._crackleBuffer);
      pop.setVolume(0.2 + Math.random() * 0.3);
      pop.setRefDistance(2);
      this.group.add(pop);
      pop.play();
      
      // Cleanup pop after it finishes
      setTimeout(() => {
        if (pop.isPlaying) pop.stop();
        this.group.remove(pop);
      }, 200);
    }

    // Flicker visual
    const flickers = 3 + Math.floor(Math.random() * 5);
    let count = 0;
    const flickerInterval = setInterval(() => {
      if (count % 2 === 0) {
        this._tubeMat.emissiveIntensity = 0.2;
        for (const l of this._lights) l.intensity = 0.1;
      } else {
        this._tubeMat.emissiveIntensity = 1.0;
        for (const l of this._lights) l.intensity = this._baseIntensity;
      }
      count++;
      if (count > flickers) {
        clearInterval(flickerInterval);
        this._tubeMat.emissiveIntensity = 1.0;
        for (const l of this._lights) l.intensity = this._baseIntensity;
      }
    }, 40);
  }
}