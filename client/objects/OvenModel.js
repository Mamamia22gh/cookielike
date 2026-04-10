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
    const bodyW = 2.5, bodyH = 2.2, bodyD = 2.0;

    // ── Open-front oven body (5 panels, no front face) ──
    const bodyMat = createMaterial(colors.body, 0.4, 0.5);

    // Back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, 0.15), bodyMat);
    back.position.set(0, bodyH / 2, -bodyD / 2 + 0.075);
    back.castShadow = true;
    this.group.add(back);

    // Top
    const top = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.15, bodyD), bodyMat);
    top.position.set(0, bodyH, 0);
    top.castShadow = true;
    this.group.add(top);

    // Bottom
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.15, bodyD), bodyMat);
    bottom.position.set(0, 0.075, 0);
    bottom.receiveShadow = true;
    this.group.add(bottom);

    // Left wall
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.15, bodyH, bodyD), bodyMat);
    left.position.set(-bodyW / 2 + 0.075, bodyH / 2, 0);
    left.castShadow = true;
    this.group.add(left);

    // Right wall
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.15, bodyH, bodyD), bodyMat);
    right.position.set(bodyW / 2 - 0.075, bodyH / 2, 0);
    right.castShadow = true;
    this.group.add(right);


    // Shake reference (use back wall as body proxy)
    this.body = back;

    // ── Door pivot at bottom edge (drops down like real oven) ──
    this._doorPivot = new THREE.Group();
    this._doorPivot.position.set(0, 0.15, bodyD / 2); // bottom front edge
    this.group.add(this._doorPivot);

    // Door glass (offset so pivot is at bottom)
    const doorGeo = new THREE.BoxGeometry(bodyW - 0.2, bodyH - 0.3, 0.1);
    const doorMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.45,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.5,
      thickness: 0.1,
    });
    this.door = new THREE.Mesh(doorGeo, doorMat);
    this.door.position.set(0, (bodyH - 0.3) / 2, 0); // centered relative to pivot
    this._doorPivot.add(this.door);

    // Handle (attached to door, at the top)
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const handleMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, bodyH - 0.45, 0.12);
    handle.castShadow = true;
    this._doorPivot.add(handle);

    // Interior glow light
    this.glowLight = new THREE.PointLight(0xff6600, 0, 4);
    this.glowLight.position.set(0, bodyH / 2, 0);
    this.glowLight.castShadow = true;
    this.glowLight.shadow.bias = -0.002;
    this.group.add(this.glowLight);

    // Type indicator (top-left)
    const indicatorGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const indicatorMat = createMaterial(colors.accent, 0.2, 0.4);
    indicatorMat.emissive = new THREE.Color(colors.accent);
    indicatorMat.emissiveIntensity = 0.4;
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(-1.0, bodyH + 0.08, 0.8);
    this.group.add(indicator);
    this._indicator = indicator;

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
    const chimneyMat = createMaterial(colors.body, 0.5, 0.4);
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.6, bodyH + 0.4, -0.4);
    chimney.castShadow = true;
    this.group.add(chimney);

    // ── Baking tray (inside the oven) ──
    this.tray = new THREE.Group();
    this.tray.position.set(0, 0.5, 0);
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

    // Door open/close state
    this._doorOpen = 0; // 0 = closed, 1 = open
    this._doorTarget = 0;

    // Grab tray hitbox (visible only when door open + completed)
    const grabGeo = new THREE.BoxGeometry(2.0, 0.5, 1.5);
    const grabMat = new THREE.MeshBasicMaterial({ visible: false });
    this._grabHit = new THREE.Mesh(grabGeo, grabMat);
    this._grabHit.position.set(0, 0.6, 0.5);
    this._grabHit.userData = {
      interactable: false,
      action: 'grab_tray',
      ovenIndex: this.index,
      label: '[Click] Prendre le plateau',
    };
    this.group.add(this._grabHit);

    // Door click hitbox (visible only when completed + door closed)
    const doorHitGeo = new THREE.BoxGeometry(bodyW - 0.1, bodyH - 0.2, 0.3);
    const doorHitMat = new THREE.MeshBasicMaterial({ visible: false });
    this._doorHit = new THREE.Mesh(doorHitGeo, doorHitMat);
    this._doorHit.position.set(0, bodyH / 2, bodyD / 2 + 0.1);
    this._doorHit.userData = {
      interactable: false,
      action: 'open_oven_door',
      ovenIndex: this.index,
      label: '[Click] Ouvrir la porte',
    };
    this.group.add(this._doorHit);
  }

  loadBox(box) {
    this._box = box;
    this._clearCookies();

    // LED goes green during cooking
    this._indicator.material.color.setHex(0x22c55e);
    this._indicator.material.emissive.setHex(0x22c55e);
    this._indicator.material.emissiveIntensity = 0.8;

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

        // Progress ring (flat torus under cookie)
        const ringGeo = new THREE.TorusGeometry(0.12, 0.015, 4, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: ZONE_COLORS.RAW });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.01, z);
        this.cookieContainer.add(ring);

        this._cookieModels.push({
          mesh: cookie,
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

      let zone = 'RAW';
      let color = ZONE_COLORS.RAW;
      if (progress >= 0.85)      { zone = 'BURNED';  color = ZONE_COLORS.BURNED; }
      else if (progress >= 0.70) { zone = 'PERFECT'; color = ZONE_COLORS.PERFECT; }
      else if (progress >= 0.30) { zone = 'COOKED';  color = ZONE_COLORS.COOKED; }

      cm.ring.material.color.setHex(color);

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
    }
  }

  /** Mark a specific cookie as extracted — animate it flying away. */
  cookieExtracted(col, row, cookingResult) {
    const cm = this._cookieModels.find(c => c.col === col && c.row === row);
    if (!cm) return;
    cm.done = true;

    const zone = cookingResult?.zone || 'COOKED';
    const color = ZONE_COLORS[zone] || 0xcccccc;
    cm.ring.material.color.setHex(color);

    const startScale = cm.mesh.scale.x;
    const startY = cm.mesh.position.y;
    let t = 0;
    const animate = () => {
      t += 0.05;
      if (t >= 1) {
        cm.mesh.visible = false;
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
    this._shakeAmount = 0.3;
  }

  /** Mark box as ready — show door hitbox. */
  showReady() {
    this._doorHit.userData.interactable = true;
  }

  /** Open the door with animation (drops down). */
  openDoor() {
    this._doorTarget = 1;
    this._doorHit.userData.interactable = false;
    setTimeout(() => {
      this._grabHit.userData.interactable = true;
    }, 500);
  }

  /** Tray grabbed — hide tray + cookies, close door. */
  trayGrabbed() {
    this._grabHit.userData.interactable = false;
    this.tray.visible = false;
    setTimeout(() => {
      this._doorTarget = 0;
    }, 300);
  }

  /** Box fully completed — clear all cookies, reset door. */
  boxComplete() {
    this._clearCookies();
    this.glowLight.intensity = 0;
    this._box = null;
    this.tray.visible = true;
    this._doorTarget = 0;
    this._doorOpen = 0;
    this._doorPivot.rotation.x = 0;
    this._grabHit.userData.interactable = false;
    this._doorHit.userData.interactable = false;

    // LED back to accent color
    this._indicator.material.emissiveIntensity = 0.4;

    // Flash animation
    if (this.door.material) {
      this.door.material.emissive = new THREE.Color(0x22c55e);
      this.door.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        this.door.material.emissive = new THREE.Color(0x000000);
        this.door.material.emissiveIntensity = 0;
      }, 400);
    }
  }

  /** Set indicator LED: green (active) or red (inactive). */
  setIndicator(active) {
    const color = active ? 0x22c55e : 0xef4444;
    this._indicator.material.color.setHex(color);
    this._indicator.material.emissive.setHex(color);
    this._indicator.material.emissiveIntensity = active ? 0.4 : 0.6;
  }

  /** Get all active hitboxes for raycasting. */
  getCookieHitboxes() {
    const list = [];
    if (this._doorHit.userData.interactable) list.push(this._doorHit);
    if (this._grabHit.userData.interactable) list.push(this._grabHit);
    return list;
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

    // Glow light flicker when cooking
    const anyCooking = this._cookieModels.some(c => !c.done);
    if (anyCooking) {
      this.glowLight.intensity = 1.0 + Math.random() * 0.8;
    }

    // Door drop-down animation (pivot at bottom, rotates around X)
    if (this._doorOpen < this._doorTarget) {
      this._doorOpen = Math.min(this._doorTarget, this._doorOpen + dt * 2.0);
    } else if (this._doorOpen > this._doorTarget) {
      this._doorOpen = Math.max(this._doorTarget, this._doorOpen - dt * 2.0);
    }
    // Rotate around X: 0 = closed (vertical), π/2 = open (horizontal, dropped down)
    this._doorPivot.rotation.x = this._doorOpen * Math.PI * 0.45;
  }
}
