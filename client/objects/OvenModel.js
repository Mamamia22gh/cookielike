import * as THREE from 'three';
import { PALETTE, createMaterial, OVEN_COLORS } from '../utils/Materials.js';
import { CookieModel } from './CookieModel.js';

const ZONE_COLORS = {
  RAW: 0x3b82f6,
  COOKED: 0xeab308,
  PERFECT: 0x22c55e,
  SWEET_SPOT: 0xa855f7,
  BURNED: 0xef4444,
};

export class OvenModel {
  constructor(typeId, index) {
    this.typeId = typeId;
    this.index = index;
    this.group = new THREE.Group();
    this.group.name = `Oven_${index}`;

    this._cookieModels = [];  // { mesh, hitbox, col, row, done }
    this._box = null;
    this._shakeAmount = 0;

    this._build();
  }

  _build() {
    const colors = OVEN_COLORS[this.typeId] || OVEN_COLORS.classic;

    // Oven body
    const bodyGeo = new THREE.BoxGeometry(2.5, 2.2, 2);
    const bodyMat = createMaterial(colors.body, 0.4, 0.5);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    this.body = body;

    // Door (glass, semi-transparent)
    const doorGeo = new THREE.BoxGeometry(2.0, 1.5, 0.15);
    const doorMat = new THREE.MeshPhysicalMaterial({
      color: colors.door,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.3,
      transmission: 0.3,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.2, 1.08);
    door.castShadow = true;
    this.group.add(door);
    this.door = door;

    // Interior glow light
    this.glowLight = new THREE.PointLight(0xff6600, 0, 4);
    this.glowLight.position.set(0, 1.2, 0);
    this.group.add(this.glowLight);

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const handleMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.9, 1.2);
    handle.castShadow = true;
    this.group.add(handle);

    // Type indicator
    const indicatorGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const indicatorMat = createMaterial(colors.accent, 0.2, 0.4);
    indicatorMat.emissive = new THREE.Color(colors.accent);
    indicatorMat.emissiveIntensity = 0.4;
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(1.0, 2.35, 1.15);
    this.group.add(indicator);

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
    const chimneyMat = createMaterial(colors.body, 0.5, 0.4);
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.6, 2.6, -0.4);
    chimney.castShadow = true;
    this.group.add(chimney);

    // Baking tray (extends from front)
    this.tray = new THREE.Group();
    this.tray.position.set(0, 0.95, 1.4);
    this.group.add(this.tray);

    const trayGeo = new THREE.BoxGeometry(2.0, 0.06, 1.6);
    const trayMat = createMaterial(PALETTE.metalLight, 0.3, 0.8);
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.receiveShadow = true;
    this.tray.add(trayMesh);

    // Tray rim
    const rimMat = createMaterial(PALETTE.metalDark, 0.3, 0.9);
    for (const x of [-1.0, 1.0]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1.6), rimMat);
      rim.position.set(x, 0.06, 0);
      this.tray.add(rim);
    }
    for (const z of [-0.8, 0.8]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.05), rimMat);
      rim.position.set(0, 0.06, z);
      this.tray.add(rim);
    }

    // Cookie container on tray
    this.cookieContainer = new THREE.Group();
    this.cookieContainer.position.y = 0.1;
    this.tray.add(this.cookieContainer);

    // Click zone (invisible hitbox for generic interaction — fallback)
    const hitGeo = new THREE.BoxGeometry(2.6, 2.5, 2.2);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.clickZone = new THREE.Mesh(hitGeo, hitMat);
    this.clickZone.position.y = 1.2;
    this.group.add(this.clickZone);
  }

  loadBox(box) {
    this._box = box;
    this._clearCookies();

    if (!box.grid) return;
    const cols = box.grid.length;
    const rows = box.grid[0]?.length ?? 5;

    const spacingX = 0.42;
    const spacingZ = 0.28;
    const offsetX = -(cols - 1) * spacingX / 2;
    const offsetZ = -(rows - 1) * spacingZ / 2;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cell = box.grid[col][row];
        const cookie = CookieModel.createMini(cell.recipeId);
        cookie.scale.setScalar(1.5);

        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;
        cookie.position.set(x, 0.05, z);
        this.cookieContainer.add(cookie);

        // Per-cookie hitbox
        const hitGeo = new THREE.BoxGeometry(spacingX * 0.9, 0.35, spacingZ * 0.9);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.set(x, 0.1, z);
        hitbox.userData = {
          interactable: true,
          action: 'extract_cookie',
          ovenIndex: this.index,
          col,
          row,
          label: '',
        };
        this.cookieContainer.add(hitbox);

        // Progress ring (flat torus under cookie)
        const ringGeo = new THREE.TorusGeometry(0.12, 0.015, 4, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: ZONE_COLORS.RAW });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.01, z);
        this.cookieContainer.add(ring);

        this._cookieModels.push({
          mesh: cookie,
          hitbox,
          ring,
          col,
          row,
          done: false,
          recipeId: cell.recipeId,
        });
      }
    }

    this.glowLight.intensity = 0.5;
  }

  /** Update all cookies' visual state based on per-cookie progress data. */
  setProgresses(cookieStates) {
    if (!cookieStates || !this._cookieModels.length) return;

    const rows = this._box?.grid?.[0]?.length ?? 5;

    for (let i = 0; i < this._cookieModels.length; i++) {
      const cm = this._cookieModels[i];
      if (cm.done) continue;

      const ci = cm.col * rows + cm.row;
      const cs = cookieStates[ci];
      if (!cs) continue;

      const progress = Math.min(1, cs.progress);

      // Determine zone by progress thresholds
      let zone = 'RAW';
      let color = ZONE_COLORS.RAW;
      if (progress >= 0.85)      { zone = 'BURNED';  color = ZONE_COLORS.BURNED; }
      else if (progress >= 0.70) { zone = 'PERFECT'; color = ZONE_COLORS.PERFECT; }
      else if (progress >= 0.30) { zone = 'COOKED';  color = ZONE_COLORS.COOKED; }

      // Ring color
      cm.ring.material.color.setHex(color);

      // Cookie visual
      const mat = cm.mesh.material;
      if (zone === 'PERFECT') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.015) * 0.3;
        cm.mesh.scale.setScalar(1.5 + Math.sin(Date.now() * 0.012) * 0.08);
      } else if (zone === 'BURNED') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 0.3 + Math.random() * 0.3;
        cm.mesh.scale.setScalar(1.3);
      } else if (zone === 'COOKED') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0xeab308);
        mat.emissiveIntensity = 0.15;
        cm.mesh.scale.setScalar(1.5);
      } else {
        if (mat.emissive) mat.emissiveIntensity = 0;
        cm.mesh.scale.setScalar(1.5);
      }

      // Hitbox hint label
      const zoneLabel = zone === 'PERFECT' ? '🟢 PARFAIT' :
        zone === 'COOKED' ? '🟡 CUIT' :
        zone === 'BURNED' ? '🔴 BRÛLÉ' : '🔵 CRU';
      cm.hitbox.userData.label = `[Click] ${zoneLabel} (${Math.round(progress * 100)}%)`;
    }
  }

  /** Mark a specific cookie as extracted — animate it flying away. */
  cookieExtracted(col, row, cookingResult) {
    const cm = this._cookieModels.find(c => c.col === col && c.row === row);
    if (!cm) return;
    cm.done = true;

    const zone = cookingResult?.zone || 'COOKED';
    const color = ZONE_COLORS[zone] || 0xcccccc;

    // Flash the ring
    cm.ring.material.color.setHex(color);

    // Shrink and fade out
    const startScale = cm.mesh.scale.x;
    const startY = cm.mesh.position.y;
    let t = 0;
    const animate = () => {
      t += 0.05;
      if (t >= 1) {
        cm.mesh.visible = false;
        cm.hitbox.userData.interactable = false;
        cm.ring.visible = false;
        return;
      }
      const ease = 1 - Math.pow(1 - t, 3);
      cm.mesh.position.y = startY + ease * 1.5;
      cm.mesh.scale.setScalar(startScale * (1 - ease * 0.8));
      cm.mesh.rotation.y += 0.3;
      if (cm.mesh.material.opacity !== undefined) {
        cm.mesh.material.transparent = true;
        cm.mesh.material.opacity = 1 - ease;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Mark a cookie as burned visually. */
  cookieBurned(col, row) {
    const cm = this._cookieModels.find(c => c.col === col && c.row === row);
    if (!cm) return;
    cm.done = true;

    cm.mesh.material.color.setHex(0x1a1a1a);
    if (cm.mesh.material.emissive) {
      cm.mesh.material.emissive.setHex(0x330000);
      cm.mesh.material.emissiveIntensity = 0.2;
    }
    cm.mesh.scale.setScalar(1.1);
    cm.ring.material.color.setHex(ZONE_COLORS.BURNED);
    cm.hitbox.userData.interactable = false;
    cm.hitbox.userData.label = '💀 Brûlé';
    this._shakeAmount = 0.3;
  }

  /** Box fully completed — clear all cookies, flash door. */
  boxComplete() {
    this._clearCookies();
    this.glowLight.intensity = 0;
    this._box = null;

    // Flash animation
    if (this.door.material) {
      const origOpacity = this.door.material.opacity;
      this.door.material.emissive = new THREE.Color(0x22c55e);
      this.door.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        this.door.material.emissive = new THREE.Color(0x000000);
        this.door.material.emissiveIntensity = 0;
        this.door.material.opacity = origOpacity;
      }, 400);
    }
  }

  /** Get all active cookie hitboxes for raycasting. */
  getCookieHitboxes() {
    return this._cookieModels
      .filter(cm => !cm.done && cm.hitbox.userData.interactable)
      .map(cm => cm.hitbox);
  }

  _clearCookies() {
    while (this.cookieContainer.children.length > 0) {
      this.cookieContainer.remove(this.cookieContainer.children[0]);
    }
    this._cookieModels = [];
  }

  update(dt) {
    // Shake on burn
    if (this._shakeAmount > 0) {
      this._shakeAmount -= dt * 3;
      if (this._shakeAmount < 0) this._shakeAmount = 0;
      this.body.position.x = (Math.random() - 0.5) * this._shakeAmount * 0.15;
      this.body.position.z = (Math.random() - 0.5) * this._shakeAmount * 0.1;
    } else {
      this.body.position.x = 0;
      this.body.position.z = 0;
    }
  }
}
