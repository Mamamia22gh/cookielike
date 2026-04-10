import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';

export class BenneModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Benne';

    this._boxes = [];
    this._bounceAnim = 0;

    this._build();
  }

  _build() {
    // Container body (open top box)
    const wallMat = createMaterial(0x3a6b35, 0.5, 0.4);

    // Bottom
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 2), wallMat);
    bottom.position.y = 0.08;
    bottom.receiveShadow = true;
    this.group.add(bottom);

    // Walls
    const wallThick = 0.12;
    const wallH = 1.8;

    const back = new THREE.Mesh(new THREE.BoxGeometry(3, wallH, wallThick), wallMat);
    back.position.set(0, wallH / 2, -1 + wallThick / 2);
    back.castShadow = true;
    this.group.add(back);

    const front = new THREE.Mesh(new THREE.BoxGeometry(3, wallH * 0.6, wallThick), wallMat);
    front.position.set(0, wallH * 0.3, 1 - wallThick / 2);
    front.castShadow = true;
    this.group.add(front);

    const left = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 2), wallMat);
    left.position.set(-1.5 + wallThick / 2, wallH / 2, 0);
    left.castShadow = true;
    this.group.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 2), wallMat);
    right.position.set(1.5 - wallThick / 2, wallH / 2, 0);
    right.castShadow = true;
    this.group.add(right);

    // Wheels
    for (const x of [-1, 1]) {
      const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 12);
      const wheelMat = createMaterial(0x222222, 0.7, 0.1);
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.2, 1.1);
      wheel.castShadow = true;
      this.group.add(wheel);
    }

    // Label plate
    const plateMat = createMaterial(PALETTE.gold, 0.2, 0.8);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.05), plateMat);
    plate.position.set(0, 1.2, 1.02);
    this.group.add(plate);

    // Cookie pile container
    this.pileGroup = new THREE.Group();
    this.pileGroup.position.set(0, 0.2, 0);
    this.group.add(this.pileGroup);
  }

  addBox(value) {
    this._bounceAnim = 0.5;

    // Add a "box" object to the pile
    const size = 0.3 + Math.random() * 0.2;
    const hue = Math.min(1, value / 300);
    const color = new THREE.Color().setHSL(0.1 + hue * 0.15, 0.6, 0.4 + hue * 0.2);

    const geo = new THREE.BoxGeometry(size, size * 0.6, size);
    const mat = createMaterial(color.getHex(), 0.5, 0.1);
    const box = new THREE.Mesh(geo, mat);

    const count = this._boxes.length;
    const layer = Math.floor(count / 6);
    const posInLayer = count % 6;
    const row = Math.floor(posInLayer / 3);
    const col = posInLayer % 3;

    box.position.set(
      -0.8 + col * 0.8 + (Math.random() - 0.5) * 0.15,
      layer * 0.4 + 0.15,
      -0.4 + row * 0.8 + (Math.random() - 0.5) * 0.15,
    );
    box.rotation.y = (Math.random() - 0.5) * 0.3;
    box.castShadow = true;

    this.pileGroup.add(box);
    this._boxes.push(box);
  }

  clear() {
    while (this.pileGroup.children.length > 0) {
      this.pileGroup.remove(this.pileGroup.children[0]);
    }
    this._boxes = [];
  }

  update(dt) {
    if (this._bounceAnim > 0) {
      this._bounceAnim -= dt * 3;
      if (this._bounceAnim < 0) this._bounceAnim = 0;
      this.pileGroup.position.y = 0.2 + Math.sin(this._bounceAnim * Math.PI) * 0.15;
    }
  }
}
