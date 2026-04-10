import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';
import { createTextSprite } from '../utils/TextSprite.js';

const ARCH_COLORS = {
  SKILLED: 0x22c55e,
  STRAT: 0x06b6d4,
  GAMBLER: 0xa855f7,
  NEUTRAL: 0x888899,
};

const ARCH_SHAPES = {
  SKILLED: () => new THREE.SphereGeometry(0.35, 12, 12),
  STRAT: () => new THREE.BoxGeometry(0.5, 0.5, 0.5),
  GAMBLER: () => new THREE.OctahedronGeometry(0.4),
  NEUTRAL: () => new THREE.DodecahedronGeometry(0.35),
};

/**
 * 3 pedestals for the CHOICE phase.
 * Each pedestal has a floating rotating shape + text labels.
 */
export class ChoicePedestals {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ChoicePedestals';
    this._pedestals = [];
    this._choices = [];
    this._build();
    this.group.visible = false;
  }

  _build() {
    for (let i = 0; i < 3; i++) {
      const p = this._createPedestal(i);
      p.group.position.set(-3 + i * 3, 0, 0);
      this.group.add(p.group);
      this._pedestals.push(p);
    }
  }

  _createPedestal(index) {
    const grp = new THREE.Group();

    // Column
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 1.3, 12),
      createMaterial(0x2a2a4e, 0.5, 0.4),
    );
    col.position.y = 0.65;
    col.castShadow = true;
    grp.add(col);

    // Top plate
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16),
      createMaterial(PALETTE.metalLight, 0.2, 0.8),
    );
    plate.position.y = 1.34;
    grp.add(plate);

    // Ground ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.04, 8, 32),
      createGlowMaterial(PALETTE.gold, 0.3),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    grp.add(ring);

    // Floating object (placeholder, replaced per choice)
    const floatGrp = new THREE.Group();
    floatGrp.position.y = 2.0;
    grp.add(floatGrp);

    // Hit zone
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 1.3;
    hit.userData = { interactable: true, action: 'choice', index };
    grp.add(hit);

    return {
      group: grp, column: col, plate, ring, floatGrp, hitZone: hit,
      floatingObj: null, nameSprite: null, descSprite: null, archSprite: null,
      baseObjY: 2.0,
    };
  }

  showChoices(choices) {
    this._choices = choices;
    this.group.visible = true;

    for (let i = 0; i < 3; i++) {
      const p = this._pedestals[i];
      // Clear old
      while (p.floatGrp.children.length) p.floatGrp.remove(p.floatGrp.children[0]);
      if (p.nameSprite) { p.group.remove(p.nameSprite); p.nameSprite = null; }
      if (p.descSprite) { p.group.remove(p.descSprite); p.descSprite = null; }
      if (p.archSprite) { p.group.remove(p.archSprite); p.archSprite = null; }

      if (i >= choices.length) { p.group.visible = false; continue; }
      p.group.visible = true;

      const ch = choices[i];
      const archColor = ARCH_COLORS[ch.archetype] || ARCH_COLORS.NEUTRAL;
      const geoFn = ARCH_SHAPES[ch.archetype] || ARCH_SHAPES.NEUTRAL;

      // Floating shape
      const shape = new THREE.Mesh(geoFn(), createGlowMaterial(archColor, 0.5));
      shape.castShadow = true;
      p.floatGrp.add(shape);
      p.floatingObj = shape;

      // Ring color
      p.ring.material.color.setHex(archColor);
      p.ring.material.emissive.setHex(archColor);

      // Name label
      p.nameSprite = createTextSprite(`[${i + 1}] ${ch.name}`, {
        fontSize: 28, color: '#fff', bgAlpha: 0.7, padding: 10,
      });
      p.nameSprite.position.set(0, 2.9, 0);
      p.group.add(p.nameSprite);

      // Description
      p.descSprite = createTextSprite(ch.description, {
        fontSize: 18, color: '#ccc', bgAlpha: 0.6, padding: 8, maxWidth: 400,
      });
      p.descSprite.position.set(0, 2.5, 0);
      p.group.add(p.descSprite);

      // Archetype badge
      p.archSprite = createTextSprite(ch.archetype, {
        fontSize: 16, color: '#' + archColor.toString(16).padStart(6, '0'),
        bgAlpha: 0.5, padding: 6,
      });
      p.archSprite.position.set(0, 3.3, 0);
      p.group.add(p.archSprite);

      // Update hit label
      p.hitZone.userData.label = `[Click] ${ch.name}`;
      p.hitZone.userData.index = i;
    }
  }

  hide() {
    this.group.visible = false;
    this._choices = [];
  }

  getInteractables() {
    if (!this.group.visible) return [];
    return this._pedestals
      .filter(p => p.group.visible)
      .map(p => p.hitZone);
  }

  update(dt) {
    if (!this.group.visible) return;
    const t = Date.now() * 0.001;
    for (let i = 0; i < this._pedestals.length; i++) {
      const p = this._pedestals[i];
      if (!p.group.visible || !p.floatingObj) continue;
      p.floatingObj.rotation.y += dt * 1.5;
      p.floatingObj.rotation.x = Math.sin(t + i) * 0.15;
      p.floatGrp.position.y = p.baseObjY + Math.sin(t * 2 + i * 1.2) * 0.12;
      p.ring.material.emissiveIntensity = 0.3 + Math.sin(t * 3 + i) * 0.15;
    }
  }
}
