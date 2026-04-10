import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';

const COOKIE_COLORS = {
  choco:      { base: 0x5c3a1e, chips: 0x3b2410 },
  vanilla:    { base: 0xfff5d4, chips: 0xe8d9a0 },
  strawberry: { base: 0xff6b8a, chips: 0xcc3355 },
  lemon:      { base: 0xfff44f, chips: 0xcccc00 },
  peanut:     { base: 0xd4a574, chips: 0x8b6914 },
  butter:     { base: 0xffd700, chips: 0xdaa520 },
  cinnamon:   { base: 0xb5651d, chips: 0x8b4513 },
  hazelnut:   { base: 0x8b6914, chips: 0x654321 },
  caramel:    { base: 0xe08c3a, chips: 0xb36b1e },
  matcha:     { base: 0x7ec850, chips: 0x5a9e32 },
  coconut:    { base: 0xf5f5dc, chips: 0xd2b48c },
  macaron:    { base: 0xffb6c1, chips: 0xff69b4 },
  truffle:    { base: 0x4a2040, chips: 0x2e1028 },
  golden:     { base: 0xffd700, chips: 0xffaa00 },
  joker:      { base: 0xaa44ff, chips: 0x6622cc },
};

export class CookieModel {
  /**
   * Create a small cookie for conveyor transfer.
   */
  static createSmall(recipeId) {
    const colors = COOKIE_COLORS[recipeId] || COOKIE_COLORS.choco;
    const geo = new THREE.SphereGeometry(0.25, 8, 6);
    geo.scale(1, 0.4, 1);
    const mat = createMaterial(colors.base, 0.7, 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    // Chips/bumps
    for (let i = 0; i < 3; i++) {
      const chipGeo = new THREE.SphereGeometry(0.05, 4, 4);
      const chipMat = createMaterial(colors.chips, 0.6, 0.1);
      const chip = new THREE.Mesh(chipGeo, chipMat);
      const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
      chip.position.set(Math.cos(angle) * 0.15, 0.08, Math.sin(angle) * 0.15);
      mesh.add(chip);
    }

    return mesh;
  }

  /**
   * Create a mini cookie for oven grid display.
   */
  static createMini(recipeId) {
    const colors = COOKIE_COLORS[recipeId] || COOKIE_COLORS.choco;
    const geo = new THREE.SphereGeometry(0.1, 6, 4);
    geo.scale(1, 0.5, 1);
    const mat = createMaterial(colors.base, 0.7, 0.05);
    mat.emissive = new THREE.Color(0x000000);
    mat.emissiveIntensity = 0;
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  /**
   * Create a large display cookie (results, shop).
   */
  static createLarge(recipeId) {
    const colors = COOKIE_COLORS[recipeId] || COOKIE_COLORS.choco;
    const geo = new THREE.SphereGeometry(0.5, 16, 12);
    geo.scale(1, 0.35, 1);
    const mat = createMaterial(colors.base, 0.65, 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    for (let i = 0; i < 5; i++) {
      const chipGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const chipMat = createMaterial(colors.chips, 0.55, 0.1);
      const chip = new THREE.Mesh(chipGeo, chipMat);
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
      const r = 0.2 + Math.random() * 0.15;
      chip.position.set(Math.cos(angle) * r, 0.12, Math.sin(angle) * r);
      mesh.add(chip);
    }

    // Golden cookie special
    if (recipeId === 'golden') {
      mat.emissive = new THREE.Color(0xffd700);
      mat.emissiveIntensity = 0.3;
    }

    // Joker special
    if (recipeId === 'joker') {
      mat.emissive = new THREE.Color(0xaa44ff);
      mat.emissiveIntensity = 0.4;
    }

    return mesh;
  }
}
