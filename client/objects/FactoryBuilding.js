import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';

export class FactoryBuilding {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FactoryBuilding';
    this._build();
  }

  _build() {
    const R = 10; // room half-size

    // ── Walls (4 sides) ──
    const wallMat = createMaterial(0x7a7a92, 0.65, 0.05);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 2, 8, 0.3), wallMat);
    backWall.position.set(0, 4, -R);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 2, 8, 0.3), wallMat);
    frontWall.position.set(0, 4, R);
    frontWall.receiveShadow = true;
    this.group.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, R * 2 + 2), wallMat);
    leftWall.position.set(-R, 4, 0);
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, R * 2 + 2), wallMat);
    rightWall.position.set(R, 4, 0);
    rightWall.receiveShadow = true;
    this.group.add(rightWall);

    // ── Ceiling ──
    const ceilMat = createMaterial(0x6a6a80, 0.65, 0.05);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + 2, R * 2 + 2), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 8;
    this.group.add(ceiling);

    // ── Ceiling beams ──
    const beamMat = createMaterial(0x808098, 0.55, 0.3);
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.3, 0.5), beamMat);
      beam.position.set(0, 7.8, i * 4);
      beam.castShadow = true;
      this.group.add(beam);
    }
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, R * 2), beamMat);
      beam.position.set(i * 4, 7.6, 0);
      this.group.add(beam);
    }

    // ── Hanging industrial lights (3×3 grid) ──
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const x = gx * 5;
        const z = gz * 5;

        // Wire
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4),
          createMaterial(0x111111, 0.5, 0.5),
        );
        wire.position.set(x, 7.25, z);
        this.group.add(wire);

        // Lamp shade
        const shade = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 0.4, 8, 1, true),
          createMaterial(0x444455, 0.4, 0.6),
        );
        shade.position.set(x, 6.3, z);
        shade.castShadow = true;
        this.group.add(shade);

        // Bulb glow
        const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const bulbMat = createMaterial(0xffffee, 0.1, 0.0);
        bulbMat.emissive = new THREE.Color(0xffffcc);
        bulbMat.emissiveIntensity = 1.0;
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(x, 6.4, z);
        this.group.add(bulb);
      }
    }

    // ── Pipes along back wall ──
    const pipeMat = createMaterial(0x7788aa, 0.3, 0.7);
    for (let y = 3; y <= 6; y += 1.5) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, R * 2, 8), pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, y, -R + 0.3);
      this.group.add(pipe);
    }

    // Vertical pipes
    for (const px of [-6, -2, 2, 6]) {
      const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 8), pipeMat);
      vPipe.position.set(px, 4.5, -R + 0.3);
      this.group.add(vPipe);
    }

    // ── Ventilation duct ──
    const ductMat = createMaterial(0x777788, 0.4, 0.5);
    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, R * 2 - 2), ductMat);
    duct.position.set(-R + 1, 6.5, 0);
    this.group.add(duct);

    // ── Warning stripes on floor ──
    const stripeMat = createMaterial(0xeab308, 0.7, 0.0);
    for (const z of [-R + 1, R - 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(R * 2 - 2, 0.01, 0.3), stripeMat);
      stripe.position.set(0, 0.01, z);
      this.group.add(stripe);
    }

    // ── Factory sign on back wall ──
    this._createSign(R);
  }

  _createSign(R) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a3a6e';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍪 COOKIELIKE FACTORY', 256, 80);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const signGeo = new THREE.PlaneGeometry(6, 1.5);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffd700,
      emissiveIntensity: 0.15,
      emissiveMap: tex,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 6.5, -R + 0.2);
    this.group.add(sign);
  }
}
