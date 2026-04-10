import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';

/**
 * Industrial air vent with continuous hissing noise.
 * Uses Web Audio API positional audio for 3D spatialization.
 * Gets louder as player approaches — oppressive ambient element.
 */
export class AirVent {
  constructor(listener) {
    this.group = new THREE.Group();
    this.group.name = 'AirVent';
    this._listener = listener;
    this._sound = null;
    this._noiseSource = null;
    this._started = false;

    this._build();
  }

  _build() {
    // Vent housing (wall-mounted box)
    const housingMat = createMaterial(PALETTE.metalDark, 0.4, 0.7);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.3), housingMat);
    housing.castShadow = true;
    this.group.add(housing);

    // Grill slats
    const slatMat = createMaterial(0x444455, 0.3, 0.8);
    for (let y = -0.4; y <= 0.4; y += 0.16) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.32), slatMat);
      slat.position.set(0, y, 0.01);
      this.group.add(slat);
    }

    // Frame border
    const frameMat = createMaterial(0x555566, 0.3, 0.6);
    // Top/bottom
    for (const dy of [-0.55, 0.55]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.32), frameMat);
      bar.position.set(0, dy, 0.01);
      this.group.add(bar);
    }
    // Left/right
    for (const dx of [-0.85, 0.85]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.32), frameMat);
      bar.position.set(dx, 0, 0.01);
      this.group.add(bar);
    }

    // Screws
    const screwMat = createMaterial(0x888899, 0.2, 0.9);
    for (const dx of [-0.75, 0.75]) {
      for (const dy of [-0.45, 0.45]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 6), screwMat);
        screw.rotation.x = Math.PI / 2;
        screw.position.set(dx, dy, 0.16);
        this.group.add(screw);
      }
    }

    // Subtle dust particles drifting out
    this._dustParticles = [];

    // Shared geometry/material for dust (avoid per-spawn allocation)
    this._dustGeo = new THREE.SphereGeometry(0.015, 3, 3);
    this._dustMat = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.3,
    });
  }

  /**
   * Start the ambient hissing sound.
   * Must be called after a user interaction (AudioContext policy).
   */
  startSound(audioCtx) {
    if (this._started || !audioCtx) return;
    this._started = true;

    // Create positional audio
    this._sound = new THREE.PositionalAudio(this._listener);

    // Generate a very low-frequency rumble buffer (not white noise)
    const sampleRate = audioCtx.sampleRate;
    const duration = 3; // longer loop = less obvious repetition
    const bufferSize = sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Start with noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    // 12 passes of wide averaging = extremely heavy low-pass
    // This kills all mid/high frequencies, leaving only a sub-bass rumble
    for (let pass = 0; pass < 12; pass++) {
      for (let i = 4; i < bufferSize - 4; i++) {
        data[i] = (data[i-4] + data[i-3] + data[i-2] + data[i-1] + data[i] + data[i+1] + data[i+2] + data[i+3] + data[i+4]) / 9;
      }
    }

    // Normalize to low amplitude
    let max = 0;
    for (let i = 0; i < bufferSize; i++) max = Math.max(max, Math.abs(data[i]));
    if (max > 0) {
      for (let i = 0; i < bufferSize; i++) data[i] = (data[i] / max) * 0.12;
    }

    this._sound.setBuffer(buffer);
    this._sound.setLoop(true);
    this._sound.setVolume(0.08);
    this._sound.setRefDistance(3);
    this._sound.setRolloffFactor(2.0);
    this._sound.setDistanceModel('exponential');
    this._sound.setMaxDistance(15);

    this.group.add(this._sound);
    this._sound.play();
  }

  update(dt) {
    // Spawn occasional dust motes
    if (Math.random() < dt * 2) {
      this._spawnDust();
    }

    // Update dust
    for (let i = this._dustParticles.length - 1; i >= 0; i--) {
      const p = this._dustParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this._dustParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife * 0.3);
    }
  }

  _spawnDust() {
    // Clone material (need unique opacity per particle), reuse geometry
    const mat = this._dustMat.clone();
    const mesh = new THREE.Mesh(this._dustGeo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 0.8,
      0.2,
    );
    this.group.add(mesh);

    const maxLife = 2 + Math.random() * 3;
    this._dustParticles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.05,
        0.3 + Math.random() * 0.4,
      ),
      life: maxLife,
      maxLife,
    });
  }
}
