import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * Dough hopper mounted above the slot machine.
 * Player clicks to "drop paste" into the machine before pulling the lever.
 */
export class DoughProvider {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DoughProvider';
    this._pourAnim = 0;
    this._particles = [];
    this._build();
  }

  _build() {
    // Hopper body (inverted truncated cone)
    const hopperGeo = new THREE.CylinderGeometry(0.8, 0.35, 1.4, 12);
    const hopperMat = createMaterial(0x7a6a5a, 0.55, 0.35);
    const hopper = new THREE.Mesh(hopperGeo, hopperMat);
    hopper.position.y = 4.8;
    hopper.castShadow = true;
    this.group.add(hopper);

    // Dough fill (visible inside)
    const doughGeo = new THREE.CylinderGeometry(0.72, 0.30, 1.0, 12);
    const doughMat = createMaterial(0xf5deb3, 0.8, 0.0);
    doughMat.emissive = new THREE.Color(0xf5deb3);
    doughMat.emissiveIntensity = 0.15;
    this.doughFill = new THREE.Mesh(doughGeo, doughMat);
    this.doughFill.position.y = 4.9;
    this.group.add(this.doughFill);

    // Nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const nozzleMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.y = 3.9;
    this.group.add(nozzle);

    // Support brackets
    for (const x of [-0.6, 0.6]) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.2, 0.08),
        createMaterial(PALETTE.metalDark, 0.3, 0.8),
      );
      bracket.position.set(x, 4.2, 0);
      bracket.castShadow = true;
      this.group.add(bracket);
    }

    // Label
    const lblCanvas = document.createElement('canvas');
    lblCanvas.width = 256; lblCanvas.height = 64;
    const ctx = lblCanvas.getContext('2d');
    ctx.fillStyle = '#2a2a1a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('🧈 PÂTE', 128, 42);
    const lblTex = new THREE.CanvasTexture(lblCanvas);
    lblTex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.3),
      new THREE.MeshBasicMaterial({ map: lblTex }),
    );
    lbl.position.set(0, 5.6, 0.01);
    this.group.add(lbl);

    // Hit zone
    const hitGeo = new THREE.CylinderGeometry(1.0, 0.5, 1.8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitZone = new THREE.Mesh(hitGeo, hitMat);
    this.hitZone.position.y = 4.8;
    this.hitZone.userData = {
      interactable: true,
      action: 'pour_dough',
      label: '[Click] Verser la pâte 🧈',
    };
    this.group.add(this.hitZone);
  }

  /** Trigger pour animation. */
  pour() {
    this._pourAnim = 1.0;
    // Spawn falling dough particles
    for (let i = 0; i < 12; i++) {
      this._particles.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          3.7,
          (Math.random() - 0.5) * 0.15,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          -2 - Math.random() * 2,
          (Math.random() - 0.5) * 0.3,
        ),
        life: 0.6 + Math.random() * 0.3,
        mesh: null,
      });
    }

    for (const p of this._particles) {
      if (p.mesh) continue;
      const geo = new THREE.SphereGeometry(0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf5deb3 });
      p.mesh = new THREE.Mesh(geo, mat);
      p.mesh.position.copy(p.pos);
      this.group.add(p.mesh);
    }
  }

  /** Update fill level visual. */
  setPasteLevel(current, max) {
    const pct = max > 0 ? current / max : 0;
    this.doughFill.scale.y = Math.max(0.05, pct);
    this.doughFill.position.y = 4.4 + pct * 0.5;
  }

  update(dt) {
    // Pour animation
    if (this._pourAnim > 0) {
      this._pourAnim -= dt * 2;
      if (this._pourAnim < 0) this._pourAnim = 0;
      this.doughFill.scale.y = Math.max(0.05, this.doughFill.scale.y - dt * 0.3);
    }

    // Particles
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.mesh) { this.group.remove(p.mesh); }
        this._particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.mesh) p.mesh.position.copy(p.pos);
    }
  }
}
