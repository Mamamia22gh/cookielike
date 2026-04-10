import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * Box packing station — a table with open cardboard boxes.
 * Player walks here while holding a tray to deposit cookies into a box.
 */
export class BoxStation {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'BoxStation';
    this._build();
  }

  _build() {
    // Table
    const tableMat = createMaterial(0x5a4a3e, 0.6, 0.15);
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.2), tableMat);
    tableTop.position.y = 0.9;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.group.add(tableTop);

    // Legs
    for (const x of [-1.1, 1.1]) {
      for (const z of [-0.5, 0.5]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.9, 0.08),
          tableMat,
        );
        leg.position.set(x, 0.45, z);
        leg.castShadow = true;
        this.group.add(leg);
      }
    }

    // Open cardboard boxes on the table
    const boxMat = createMaterial(0xb08850, 0.75, 0.0);
    const boxPositions = [-0.7, 0, 0.7];
    for (let i = 0; i < 3; i++) {
      const x = boxPositions[i];
      const bGroup = new THREE.Group();
      bGroup.position.set(x, 0.95, 0);

      // Bottom
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.45), boxMat);
      bGroup.add(bottom);

      // Walls (4 sides, open top)
      const wallH = 0.25;
      const sides = [
        { geo: [0.55, wallH, 0.03], pos: [0, wallH / 2, 0.21] },
        { geo: [0.55, wallH, 0.03], pos: [0, wallH / 2, -0.21] },
        { geo: [0.03, wallH, 0.45], pos: [0.26, wallH / 2, 0] },
        { geo: [0.03, wallH, 0.45], pos: [-0.26, wallH / 2, 0] },
      ];
      for (const s of sides) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(...s.geo), boxMat);
        wall.position.set(...s.pos);
        bGroup.add(wall);
      }

      // Flap (one side folded open)
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.2), boxMat);
      flap.position.set(0, wallH, 0.31);
      flap.rotation.x = -0.4;
      bGroup.add(flap);

      this.group.add(bGroup);
    }

    // Label removed as requested

    // Interaction hitbox
    const hitGeo = new THREE.BoxGeometry(2.6, 1.2, 1.4);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitZone = new THREE.Mesh(hitGeo, hitMat);
    this.hitZone.position.y = 1.0;
    this.hitZone.userData = {
      interactable: true,
      action: 'deposit_box',
      label: '[Click] 📦 Emballer le plateau',
    };
    this.group.add(this.hitZone);
  }
}
