import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';
import { RECIPES, getRecipe } from '../../src/data/recipes.js';

/**
 * Unified cookie crafting machine.
 *
 * Combines recipe rolling (poll phase) + lever pull + craft animation.
 * Front face has 4 recipe display slots (2×2).
 * Right side has the lever.
 * Machine shakes & smokes during crafting.
 *
 * States: idle | rolling | locked | crafting | target_select
 */
export class SlotMachine {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'SlotMachine';

    // ── State ──
    this._state = 'idle';
    this._pullAnim = 0;
    this._craftTimer = 0;
    this._craftDuration = 2.4;
    this._craftCallback = null;   // called when crafting finishes
    this._shakeAmount = 0;

    // ── Roll state ──
    this._rollTime = 0;
    this._finalRecipes = [];
    this._lockTimes = [];
    this._lockedCount = 0;
    this._rerollsLeft = 0;

    // ── Sound callbacks (set by GameBridge) ──
    this.onTick = null;   // called each slot texture change
    this.onLock = null;   // called when a slot locks in
    this.onCraftStart = null;
    this.onCraftDone = null;

    // ── Texture cache ──
    this._texCache = {};
    this._recipeList = RECIPES.filter(r => !r.isWild);
    for (const r of RECIPES) {
      this._texCache[r.id] = this._renderRecipeTex(r);
    }
    this._blankTex = this._renderBlankTex();

    // ── Slots & buttons ──
    this._slots = [];
    this._rerollBtn = null;
    this._confirmBtn = null;
    this._targetTokens = [];

    // ── Craft particles ──
    this._craftParticles = [];

    this._build();
  }

  // ═══════════════════════════════════════════════════
  //  GEOMETRY
  // ═══════════════════════════════════════════════════

  _build() {
    // ── Base cabinet ──
    const cabinetGeo = new THREE.BoxGeometry(3.0, 4.0, 2.2);
    const cabinetMat = createMaterial(PALETTE.machineBody, 0.3, 0.6);
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinet.position.y = 2.0;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    this.group.add(cabinet);
    this._cabinet = cabinet;

    // ── Top arch ──
    const topGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 16, 1, false, 0, Math.PI);
    const topMat = createMaterial(PALETTE.gold, 0.2, 0.8);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 4.15, 0);
    top.rotation.z = Math.PI;
    top.castShadow = true;
    this.group.add(top);

    // ── Front dark panel (behind recipe displays) ──
    const panelGeo = new THREE.BoxGeometry(2.4, 2.4, 0.1);
    const panelMat = createMaterial(0x111122, 0.1, 0.0);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 2.6, 1.06);
    this.group.add(panel);

    // ── 4 recipe display slots (2×2) ──
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = -0.5 + col * 1.0;
      const y = 3.2 - row * 1.0;

      // Recess
      const recess = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.85, 0.05),
        createMaterial(0x050510, 0.9, 0.0),
      );
      recess.position.set(x, y, 1.08);
      this.group.add(recess);

      // Display plane
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.72),
        new THREE.MeshBasicMaterial({ map: this._blankTex, transparent: true }),
      );
      plane.position.set(x, y, 1.12);
      this.group.add(plane);

      // Border ring
      const bMat = createGlowMaterial(0x333355, 0.2);
      const border = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 4), bMat);
      border.rotation.set(0, 0, Math.PI / 4);
      border.position.set(x, y, 1.12);
      this.group.add(border);

      this._slots.push({
        plane, borderMesh: border,
        locked: false, cycleTimer: 0,
        displayIdx: Math.floor(Math.random() * this._recipeList.length),
        x, y,
      });
    }

    // ── Reroll / Confirm buttons ──
    this._rerollBtn = this._makeButton(-0.5, 1.55, 1.12, '🔄', 0x3b82f6, 'poll_reroll');
    this._confirmBtn = this._makeButton(0.5, 1.55, 1.12, '✅', 0x22c55e, 'poll_confirm');
    this._rerollBtn.visible = false;
    this._confirmBtn.visible = false;

    // ── Lever arm (right side) ──
    const leverBaseMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    const leverBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), leverBaseMat);
    leverBase.position.set(1.8, 2.0, 0);
    this.group.add(leverBase);

    this.leverPivot = new THREE.Group();
    this.leverPivot.position.set(1.8, 2.15, 0);
    this.group.add(this.leverPivot);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
    const arm = new THREE.Mesh(armGeo, leverBaseMat);
    arm.position.y = 0.75;
    arm.castShadow = true;
    this.leverPivot.add(arm);

    const ballGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const ballMat = createMaterial(PALETTE.red, 0.3, 0.2);
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.y = 1.55;
    ball.castShadow = true;
    this.leverPivot.add(ball);

    // Lever hitbox
    const leverHitGeo = new THREE.BoxGeometry(0.8, 2, 0.8);
    const leverHitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.lever = new THREE.Mesh(leverHitGeo, leverHitMat);
    this.lever.position.set(1.8, 2.5, 0);
    this.lever.userData = { interactable: true, action: 'pull_lever', label: '[Click] Tirer le levier' };
    this.group.add(this.lever);

    // ── Coin slot glow ──
    const slotGeo = new THREE.BoxGeometry(0.6, 0.05, 0.15);
    const slotMat = createMaterial(PALETTE.gold, 0.1, 0.9);
    slotMat.emissive = new THREE.Color(PALETTE.gold);
    slotMat.emissiveIntensity = 0.3;
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, 0.8, 1.06);
    this.group.add(slot);

    // ── Internal glow light (for crafting) ──
    this._craftLight = new THREE.PointLight(0xff6600, 0, 5);
    this._craftLight.position.set(0, 2.5, 0.5);
    this.group.add(this._craftLight);

    // ── Decorative trims ──
    const trimGeo = new THREE.BoxGeometry(3.2, 0.1, 2.4);
    const trimMat = createMaterial(PALETTE.gold, 0.15, 0.85);
    const trimBottom = new THREE.Mesh(trimGeo, trimMat);
    trimBottom.position.y = 0.05;
    this.group.add(trimBottom);
    const trimTop = new THREE.Mesh(trimGeo, trimMat);
    trimTop.position.y = 4.0;
    this.group.add(trimTop);

    // ── Side lights ──
    for (const xSide of [-1.45, 1.45]) {
      for (let ly = 1.5; ly <= 3.5; ly += 1) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 8),
          createGlowMaterial(0x3388ff, 0.4),
        );
        light.position.set(xSide, ly, 0.8);
        this.group.add(light);
      }
    }
  }

  _makeButton(x, y, z, label, color, action) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.35, 0.12),
      createMaterial(color, 0.35, 0.3),
    );
    grp.add(base);

    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    lbl.position.z = 0.07;
    grp.add(lbl);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 0.25),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData = {
      interactable: true, action,
      label: action === 'poll_reroll' ? '[Click] 🔄 Reroll' : '[Click] ✅ Confirmer',
    };
    grp.add(hit);
    grp.position.set(x, y, z);
    this.group.add(grp);
    grp._hit = hit;
    return grp;
  }

  // ═══════════════════════════════════════════════════
  //  TEXTURE HELPERS
  // ═══════════════════════════════════════════════════

  _renderRecipeTex(recipe) {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, 200, 200);
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(recipe.emoji, 100, 78);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(recipe.name, 100, 158);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _renderBlankTex() {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, 200, 200);
    ctx.font = '48px sans-serif';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 100, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ═══════════════════════════════════════════════════
  //  POLL (recipe rolling)
  // ═══════════════════════════════════════════════════

  startRoll(recipes, rerollsLeft) {
    this._finalRecipes = recipes;
    this._rerollsLeft = rerollsLeft;
    this._state = 'rolling';
    this._rollTime = 0;
    this._lockedCount = 0;
    this._rerollBtn.visible = false;
    this._confirmBtn.visible = false;

    this._lockTimes = [1.2, 1.7, 2.2, 2.7];
    for (const s of this._slots) {
      s.locked = false;
      s.cycleTimer = 0;
      s.displayIdx = Math.floor(Math.random() * this._recipeList.length);
      s.borderMesh.material.color.setHex(0x333355);
      s.borderMesh.material.emissive.setHex(0x333355);
      s.borderMesh.material.emissiveIntensity = 0.2;
    }
  }

  setRerolls(n) {
    this._rerollsLeft = n;
    if (this._state === 'locked') this._rerollBtn.visible = n > 0;
  }

  _showPollButtons() {
    this._rerollBtn.visible = this._rerollsLeft > 0;
    this._confirmBtn.visible = true;
  }

  // ═══════════════════════════════════════════════════
  //  CRAFT (lever pull + animation)
  // ═══════════════════════════════════════════════════

  /**
   * Start craft animation. Callback is invoked when animation finishes
   * (so FactoryScene can then show the cookie transfer).
   */
  animatePull(onDone) {
    this._pullAnim = 1.0;
    this._state = 'crafting';
    this._craftTimer = 0;
    this._craftCallback = onDone || null;
    this._shakeAmount = 0;
    this._craftLight.intensity = 0;

    if (this.onCraftStart) this.onCraftStart();
  }

  // ═══════════════════════════════════════════════════
  //  TARGET SELECTION (for choices: recipe_copy / recipe_remove)
  // ═══════════════════════════════════════════════════

  showTargetSelection(pool) {
    this._state = 'target_select';
    this.clearTargetSelection();

    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      const recipe = getRecipe(entry.recipeId);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - 1) * 1.0;
      const y = 3.0 - row * 1.2;

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.8),
        new THREE.MeshBasicMaterial({ map: this._texCache[entry.recipeId], transparent: true }),
      );
      plane.position.set(x, y, 1.5);
      this.group.add(plane);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.3),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x, y, 1.5);
      hit.userData = {
        interactable: true,
        action: 'target_select',
        recipeId: entry.recipeId,
        label: `[Click] ${recipe.emoji} ${recipe.name}`,
      };
      this.group.add(hit);

      this._targetTokens.push({ plane, hit });
    }
  }

  clearTargetSelection() {
    for (const t of this._targetTokens) {
      this.group.remove(t.plane);
      this.group.remove(t.hit);
    }
    this._targetTokens = [];
    if (this._state === 'target_select') this._state = 'idle';
  }

  // ═══════════════════════════════════════════════════
  //  INTERACTABLES
  // ═══════════════════════════════════════════════════

  getInteractables() {
    const list = [];

    if (this._state === 'locked') {
      if (this._rerollBtn.visible) list.push(this._rerollBtn._hit);
      if (this._confirmBtn.visible) list.push(this._confirmBtn._hit);
    }

    if (this._state === 'target_select') {
      for (const t of this._targetTokens) list.push(t.hit);
    }

    return list;
  }

  // ═══════════════════════════════════════════════════
  //  RESET
  // ═══════════════════════════════════════════════════

  reset() {
    this._state = 'idle';
    this._pullAnim = 0;
    this._craftTimer = 0;
    this._shakeAmount = 0;
    this._craftLight.intensity = 0;
    this.leverPivot.rotation.x = 0;
    this.clearTargetSelection();
    this._rerollBtn.visible = false;
    this._confirmBtn.visible = false;
    this._cabinet.position.x = 0;
    this._cabinet.position.z = 0;

    for (const s of this._slots) {
      s.locked = false;
      s.plane.material.map = this._blankTex;
      s.plane.material.needsUpdate = true;
      s.borderMesh.material.color.setHex(0x333355);
      s.borderMesh.material.emissive.setHex(0x333355);
      s.borderMesh.material.emissiveIntensity = 0.2;
    }

    // Clear craft particles
    for (const p of this._craftParticles) {
      if (p.mesh) this.group.remove(p.mesh);
    }
    this._craftParticles = [];
  }

  // ═══════════════════════════════════════════════════
  //  UPDATE
  // ═══════════════════════════════════════════════════

  update(dt) {
    // ── Rolling ──
    if (this._state === 'rolling') {
      this._updateRoll(dt);
    }

    // ── Lever spring-back ──
    if (this._pullAnim > 0) {
      this._pullAnim -= dt * 2.5;
      if (this._pullAnim < 0) this._pullAnim = 0;
      this.leverPivot.rotation.x = Math.sin(this._pullAnim * Math.PI) * 0.6;
    }

    // ── Crafting animation ──
    if (this._state === 'crafting') {
      this._updateCraft(dt);
    }

    // ── Shake recovery ──
    if (this._shakeAmount > 0 && this._state !== 'crafting') {
      this._shakeAmount -= dt * 3;
      if (this._shakeAmount < 0) this._shakeAmount = 0;
    }
    if (this._shakeAmount > 0) {
      this._cabinet.position.x = (Math.random() - 0.5) * this._shakeAmount * 0.08;
      this._cabinet.position.z = (Math.random() - 0.5) * this._shakeAmount * 0.06;
    } else {
      this._cabinet.position.x = 0;
      this._cabinet.position.z = 0;
    }

    // ── Idle screen pulse ──
    const t = Date.now() * 0.001;
    for (const light of this.group.children) {
      if (light.material && light.material.emissive && light.userData?._sideLight) {
        light.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + light.position.y) * 0.15;
      }
    }

    // ── Craft particles ──
    this._updateCraftParticles(dt);
  }

  _updateRoll(dt) {
    this._rollTime += dt;

    for (let i = 0; i < 4; i++) {
      const slot = this._slots[i];
      if (slot.locked) continue;

      if (this._rollTime >= this._lockTimes[i]) {
        // Lock in!
        slot.locked = true;
        this._lockedCount++;
        slot.plane.material.map = this._texCache[this._finalRecipes[i]] || this._blankTex;
        slot.plane.material.needsUpdate = true;
        slot.borderMesh.material.color.setHex(0x22c55e);
        slot.borderMesh.material.emissive.setHex(0x22c55e);
        slot.borderMesh.material.emissiveIntensity = 0.8;
        if (this.onLock) this.onLock();
      } else {
        // Cycling
        slot.cycleTimer -= dt;
        if (slot.cycleTimer <= 0) {
          const remaining = this._lockTimes[i] - this._rollTime;
          const slowdown = Math.max(0, 1 - remaining / 0.5);
          slot.cycleTimer = 0.05 + slowdown * 0.2;
          slot.displayIdx = (slot.displayIdx + 1) % this._recipeList.length;
          const rId = this._recipeList[slot.displayIdx].id;
          slot.plane.material.map = this._texCache[rId] || this._blankTex;
          slot.plane.material.needsUpdate = true;
          slot.borderMesh.material.emissiveIntensity = 0.5;
          if (this.onTick) this.onTick();
        } else {
          slot.borderMesh.material.emissiveIntensity *= 0.90;
        }
      }
    }

    if (this._lockedCount >= 4 && this._state === 'rolling') {
      this._state = 'locked';
      this._showPollButtons();
    }
  }

  _updateCraft(dt) {
    this._craftTimer += dt;
    const progress = Math.min(1, this._craftTimer / this._craftDuration);

    // Shake increases, peaks at 70%, then drops
    if (progress < 0.7) {
      this._shakeAmount = progress / 0.7;
    } else {
      this._shakeAmount = 1.0 - (progress - 0.7) / 0.3;
    }

    // Glow light pulses
    this._craftLight.intensity = 1.5 + Math.sin(this._craftTimer * 15) * 0.8;
    this._craftLight.color.setHex(progress < 0.5 ? 0xff6600 : 0xffaa00);

    // Spawn smoke particles
    if (Math.random() < dt * 12) {
      this._spawnCraftParticle();
    }

    // Done?
    if (progress >= 1) {
      this._state = 'idle';
      this._shakeAmount = 0;
      this._craftLight.intensity = 0;
      this._cabinet.position.x = 0;
      this._cabinet.position.z = 0;
      if (this.onCraftDone) this.onCraftDone();
      if (this._craftCallback) {
        this._craftCallback();
        this._craftCallback = null;
      }
    }
  }

  _spawnCraftParticle() {
    const geo = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0xffcc44 : 0xff8844,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 1.5,
      4.2 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.8,
    );
    this.group.add(mesh);
    this._craftParticles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 0.5,
      ),
      life: 0.5 + Math.random() * 0.5,
    });
  }

  _updateCraftParticles(dt) {
    for (let i = this._craftParticles.length - 1; i >= 0; i--) {
      const p = this._craftParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this._craftParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 1.5 * dt; // slight gravity on smoke
      p.mesh.material.opacity = Math.max(0, p.life * 1.5);
      p.mesh.scale.multiplyScalar(1 + dt * 0.8); // expand
    }
  }
}
