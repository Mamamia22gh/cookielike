import * as THREE from 'three';

export const PALETTE = {
  bg: 0x3d3d55,
  floor: 0x6a6a7e,
  gold: 0xffd700,
  red: 0xef4444,
  green: 0x22c55e,
  blue: 0x3b82f6,
  purple: 0xa855f7,
  yellow: 0xeab308,
  cyan: 0x06b6d4,
  white: 0xeeeeee,
  dim: 0x888888,
  machineBody: 0xb04070,
  metalDark: 0x5a5a6e,
  metalLight: 0xaaaabc,
};

export const OVEN_COLORS = {
  classic: { body: 0x7777888, door: 0x9999aa, accent: 0xff6600 },
  turbo:   { body: 0x556688, door: 0x7788aa, accent: 0x00ccff },
  magic:   { body: 0x665588, door: 0x8877aa, accent: 0xffdd00 },
  cryo:    { body: 0x447788, door: 0x6699aa, accent: 0x44ddff },
  chaos:   { body: 0x665555, door: 0x887766, accent: 0xff44ff },
};

/**
 * Create a standard PBR material.
 */
export function createMaterial(color, roughness = 0.5, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

/**
 * Create a glowing emissive material.
 */
export function createGlowMaterial(color, emissiveIntensity = 0.5) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.3,
    metalness: 0.0,
  });
}
