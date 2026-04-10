import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';
import { createTextSprite } from '../utils/TextSprite.js';
import { getRecipe } from '../../src/data/recipes.js';
import { BALANCE } from '../../src/data/balance.js';

const RARITY_COLORS = {
  common: 0x888888,
  uncommon: 0x06b6d4,
  rare: 0xeab308,
  legendary: 0xa855f7,
};

/**
 * 3D shop counter with floating artifact items.
 */
export class ShopCounter {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ShopCounter';
    this._items = [];
    this._rerollBtn = null;
    this._doneBtn = null;
    this._budgetSprite = null;
    this._build();
    this.group.visible = false;
  }

  _build() {
    // Counter body
    const counterMat = createMaterial(0x3a2a1e, 0.6, 0.2);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.5), counterMat);
    counter.position.y = 0.55;
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.group.add(counter);

    // Counter top
    const topMat = createMaterial(0x5a4a3e, 0.4, 0.3);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.08, 1.7), topMat);
    top.position.y = 1.14;
    this.group.add(top);

    // Back shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 0.6), counterMat);
    shelf.position.set(0, 2.0, -0.5);
    this.group.add(shelf);
    const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.5, 0.1), counterMat);
    shelfBack.position.set(0, 1.25, -0.85);
    this.group.add(shelfBack);

    // Sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#1e1a10';
    sCtx.fillRect(0, 0, 512, 96);
    sCtx.font = 'bold 44px sans-serif';
    sCtx.fillStyle = '#ffd700';
    sCtx.textAlign = 'center';
    sCtx.fillText('🛒 ATELIER', 256, 62);
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 0.65),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(0, 3.0, -0.8);
    this.group.add(sign);

    // Budget display
    this._budgetSprite = createTextSprite('0 💵', {
      fontSize: 36, color: '#ffd700', bgAlpha: 0.7, padding: 12,
    });
    this._budgetSprite.position.set(0, 3.8, 0);
    this.group.add(this._budgetSprite);

    // Buttons
    this._rerollBtn = this._makeBtn(-2, 1.3, 0.6, '🔄 Reroll', 'shop_reroll');
    this._doneBtn = this._makeBtn(2, 1.3, 0.6, '✅ Terminé', 'shop_done');
  }

  _makeBtn(x, y, z, label, action) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.3, 0.3),
      createMaterial(action === 'shop_done' ? 0x22c55e : 0x3b82f6, 0.35, 0.3),
    );
    grp.add(base);

    const c = document.createElement('canvas');
    c.width = 192; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 96, 24);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.27),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    lbl.position.z = 0.16;
    grp.add(lbl);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 0.5),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData = { interactable: true, action, label: `[Click] ${label}` };
    grp.add(hit);
    grp._hit = hit;
    grp.position.set(x, y, z);
    this.group.add(grp);
    return grp;
  }

  /* ── API ── */
  showShop(run, offerings) {
    this.group.visible = true;
    this._clearItems();

    // Budget — recreate sprite with updated value
    this.group.remove(this._budgetSprite);
    this._budgetSprite = createTextSprite(`${run.shopCurrency} 💵`, {
      fontSize: 36, color: '#ffd700', bgAlpha: 0.7, padding: 12,
    });
    this._budgetSprite.position.set(0, 3.8, 0);
    this.group.add(this._budgetSprite);

    // Display offerings
    for (let i = 0; i < offerings.length; i++) {
      const o = offerings[i];
      const x = -2 + i * 1.5;
      const rarCol = RARITY_COLORS[o.rarity] || 0x888888;

      // Floating sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        createGlowMaterial(rarCol, 0.6),
      );
      sphere.position.set(x, 2.5, -0.3);
      this.group.add(sphere);

      // Name label
      const nameS = createTextSprite(`${o.emoji} ${o.name}`, {
        fontSize: 18, color: '#fff', bgAlpha: 0.6, padding: 6,
      });
      nameS.position.set(x, 3.0, -0.3);
      this.group.add(nameS);

      // Cost label
      const costS = createTextSprite(`${o.finalCost} 💵`, {
        fontSize: 16, color: '#ffd700', bgAlpha: 0.5, padding: 4,
      });
      costS.position.set(x, 2.15, -0.3);
      this.group.add(costS);

      // Hit zone
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.5, 0.8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x, 2.5, -0.3);
      hit.userData = {
        interactable: true, action: 'shop_buy', index: i,
        label: `[Click] ${o.emoji} ${o.name} (${o.finalCost}💵)`,
      };
      this.group.add(hit);

      this._items.push({ sphere, nameS, costS, hit });
    }
  }

  _clearItems() {
    for (const item of this._items) {
      this.group.remove(item.sphere);
      this.group.remove(item.nameS);
      this.group.remove(item.costS);
      this.group.remove(item.hit);
    }
    this._items = [];
  }

  hide() {
    this.group.visible = false;
    this._clearItems();
  }

  getInteractables() {
    if (!this.group.visible) return [];
    const list = [];
    for (const item of this._items) list.push(item.hit);
    list.push(this._rerollBtn._hit);
    list.push(this._doneBtn._hit);
    return list;
  }

  update(dt) {
    if (!this.group.visible) return;
    const t = Date.now() * 0.001;
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      item.sphere.rotation.y += dt * 2;
      item.sphere.position.y = 2.5 + Math.sin(t * 2.5 + i) * 0.1;
    }
  }
}
