import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';
import { CookieModel } from './CookieModel.js';

export class ConveyorBelt {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ConveyorBelt';

    this._scrollOffset = 0;
    this._transfers = [];

    this._build();
  }

  _build() {
    // Belt surface
    const beltLength = 8;
    const beltGeo = new THREE.BoxGeometry(beltLength, 0.08, 1.2);
    const beltMat = createMaterial(0x222222, 0.6, 0.3);
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(beltLength / 2, 0.6, 0);
    belt.receiveShadow = true;
    this.group.add(belt);
    this.belt = belt;

    // Belt texture lines (animated)
    this.beltLines = [];
    for (let i = 0; i < 16; i++) {
      const lineGeo = new THREE.BoxGeometry(0.04, 0.09, 1.1);
      const lineMat = createMaterial(0x333333, 0.5, 0.2);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(i * 0.5, 0.65, 0);
      this.group.add(line);
      this.beltLines.push(line);
    }

    // Side rails
    for (const z of [-0.65, 0.65]) {
      const railGeo = new THREE.BoxGeometry(beltLength, 0.3, 0.08);
      const railMat = createMaterial(PALETTE.metalDark, 0.3, 0.7);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(beltLength / 2, 0.75, z);
      rail.castShadow = true;
      this.group.add(rail);
    }

    // Legs
    for (const x of [0.5, 3.5, 6.5]) {
      for (const z of [-0.5, 0.5]) {
        const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6);
        const legMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, 0.3, z);
        leg.castShadow = true;
        this.group.add(leg);
      }
    }

    // Rollers at ends
    for (const x of [0.2, beltLength - 0.2]) {
      const rollerGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.3, 12);
      const rollerMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.position.set(x, 0.6, 0);
      roller.rotation.x = Math.PI / 2;
      this.group.add(roller);
    }
  }

  animateTransfer(fromPos, toPos, box) {
    const cookies = [];
    const count = Math.min(4, box.cookies?.length || 4);

    for (let i = 0; i < count; i++) {
      const recipeId = box.cookies?.[i]?.recipeId || 'choco';
      const mesh = CookieModel.createSmall(recipeId);
      const worldStart = fromPos.clone().add(new THREE.Vector3(0, 1.5, 0));
      mesh.position.copy(worldStart);
      this.group.parent.add(mesh);
      cookies.push({
        mesh,
        startPos: worldStart,
        endPos: toPos.clone().add(new THREE.Vector3(0, 1.5, 0)),
        t: -i * 0.12,
        duration: 0.6,
      });
    }

    this._transfers.push(...cookies);
  }

  clear() {
    for (const t of this._transfers) {
      if (t.mesh.parent) t.mesh.parent.remove(t.mesh);
    }
    this._transfers = [];
  }

  update(dt) {
    // Animate belt lines scrolling
    this._scrollOffset += dt * 2;
    for (let i = 0; i < this.beltLines.length; i++) {
      const base = (i * 0.5 + this._scrollOffset) % 8;
      this.beltLines[i].position.x = base;
    }

    // Animate cookie transfers
    const done = [];
    for (let i = 0; i < this._transfers.length; i++) {
      const transfer = this._transfers[i];
      transfer.t += dt;
      if (transfer.t < 0) continue;

      const progress = Math.min(1, transfer.t / transfer.duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      transfer.mesh.position.lerpVectors(transfer.startPos, transfer.endPos, ease);
      transfer.mesh.position.y += Math.sin(progress * Math.PI) * 1.5;
      transfer.mesh.rotation.y += dt * 8;

      if (progress >= 1) {
        done.push(i);
        if (transfer.mesh.parent) transfer.mesh.parent.remove(transfer.mesh);
      }
    }

    for (let i = done.length - 1; i >= 0; i--) {
      this._transfers.splice(done[i], 1);
    }
  }
}
