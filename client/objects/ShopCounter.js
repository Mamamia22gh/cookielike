import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';
import { createTextSprite } from '../utils/TextSprite.js';

const RARITY_COLORS = {
  common: 0x888888,
  uncommon: 0x06b6d4,
  rare: 0xeab308,
  legendary: 0xa855f7,
};

/**
 * Shop étagère — tall wooden shelf unit against the west wall.
 * Artifacts displayed as floating gems on shelves.
 * Budget, reroll & done controls integrated into a small control panel at the bottom.
 */
export class ShopCounter {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ShopShelf';
    this._items = [];
    this._rerollHit = null;
    this._doneHit = null;
    this._budgetSprite = null;
    this._controlPanel = null;
    this._build();
  }

  _build() {
    const woodMat = createMaterial(0x5a4020, 0.7, 0.05);
    const darkWoodMat = createMaterial(0x3a2810, 0.75, 0.05);
    const metalMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);

    // ── Shelf frame ──
    const frameW = 3.6, frameH = 2.8, frameD = 0.55;

    // Back panel
    const back = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, 0.06), darkWoodMat);
    back.position.set(0, frameH / 2, -frameD / 2 + 0.03);
    back.castShadow = true; back.receiveShadow = true;
    this.group.add(back);

    // Side panels
    for (const dx of [-frameW / 2 + 0.04, frameW / 2 - 0.04]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, frameH, frameD), woodMat);
      side.position.set(dx, frameH / 2, 0);
      side.castShadow = true;
      this.group.add(side);
    }

    // Top
    const top = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.08, 0.06, frameD + 0.04), woodMat);
    top.position.set(0, frameH + 0.03, 0);
    top.castShadow = true;
    this.group.add(top);

    // Shelves (4 levels)
    this._shelfYs = [];
    for (let i = 0; i < 4; i++) {
      const sy = 0.15 + i * 0.7;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(frameW - 0.1, 0.05, frameD - 0.06), woodMat);
      shelf.position.set(0, sy, 0);
      shelf.receiveShadow = true;
      this.group.add(shelf);
      this._shelfYs.push(sy + 0.025);
    }

    // Decorative crown moulding
    const crownMat = createMaterial(0x6a5030, 0.6, 0.1);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.16, 0.12, 0.08), crownMat);
    crown.position.set(0, frameH + 0.06, frameD / 2 - 0.04);
    this.group.add(crown);

    // ── Sign at the top ──
    const signC = document.createElement('canvas');
    signC.width = 512; signC.height = 64;
    const sctx = signC.getContext('2d');
    sctx.fillStyle = '#1a1208'; sctx.fillRect(0, 0, 512, 64);
    sctx.font = 'bold 32px monospace'; sctx.fillStyle = '#c8a050';
    sctx.textAlign = 'center'; sctx.fillText('⚙ ATELIER ⚙', 256, 44);
    const signTex = new THREE.CanvasTexture(signC);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.3),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(0, frameH - 0.15, frameD / 2 + 0.01);
    this.group.add(sign);

    // ── Control panel (bottom shelf area) ──
    const ctrlGrp = new THREE.Group();
    ctrlGrp.position.set(0, this._shelfYs[0] + 0.02, frameD / 2 - 0.05);
    this.group.add(ctrlGrp);
    this._controlPanel = ctrlGrp;

    // Budget display
    this._budgetSprite = createTextSprite('💵 0', {
      fontSize: 28, color: '#00ffcc', bgAlpha: 0.0, padding: 0,
    });
    this._budgetSprite.position.set(0, 0.15, 0.01);
    ctrlGrp.add(this._budgetSprite);

    // Reroll button (left)
    const rerollGrp = this._makeShelfButton(-0.8, 0.05, 0, 0x3b82f6, '🔄', 'shop_reroll');
    ctrlGrp.add(rerollGrp);
    this._rerollHit = rerollGrp._hit;

    // Done button (right)
    const doneGrp = this._makeShelfButton(0.8, 0.05, 0, 0x22c55e, '✅', 'shop_done');
    ctrlGrp.add(doneGrp);
    this._doneHit = doneGrp._hit;
  }

  _makeShelfButton(x, y, z, colorHex, emoji, action) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const btnMat = createMaterial(colorHex, 0.4, 0.3);
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), btnMat);
    grp.add(btn);

    // Emoji label
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.15),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    lbl.position.z = 0.06;
    grp.add(lbl);

    const labels = { shop_reroll: '[Click] 🔄 Reroll', shop_done: '[Click] ✅ Terminé' };
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.userData = { interactable: true, action, label: labels[action] || action };
    grp.add(hit);
    grp._hit = hit;
    return grp;
  }

  /* ── API ── */
  showShop(run, offerings) {
    this._clearItems();

    // Update budget
    if (this._budgetSprite?.parent) {
      this._budgetSprite.parent.remove(this._budgetSprite);
    }
    this._budgetSprite = createTextSprite(`💵 ${run.shopCurrency}`, {
      fontSize: 28, color: '#00ffcc', bgAlpha: 0.0, padding: 0,
    });
    this._budgetSprite.position.set(0, 0.15, 0.01);
    this._controlPanel.add(this._budgetSprite);

    // Place offerings on shelves (top shelves, leaving bottom for controls)
    const availableShelves = this._shelfYs.slice(1); // shelves 1-3
    const perShelf = Math.ceil(offerings.length / availableShelves.length);

    for (let i = 0; i < offerings.length; i++) {
      const o = offerings[i];
      const shelfIdx = Math.min(availableShelves.length - 1, Math.floor(i / perShelf));
      const posInShelf = i % perShelf;
      const shelfCount = Math.min(perShelf, offerings.length - shelfIdx * perShelf);
      const spacing = 2.8 / Math.max(1, shelfCount);
      const x = -1.4 + spacing / 2 + posInShelf * spacing;
      const y = availableShelves[shelfIdx];
      const rarCol = RARITY_COLORS[o.rarity] || 0x888888;

      // Floating gem
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        createGlowMaterial(rarCol, 0.8),
      );
      gem.position.set(x, y + 0.2, 0.05);
      this.group.add(gem);

      // Name + price tag (canvas on small plane)
      const tagC = document.createElement('canvas');
      tagC.width = 256; tagC.height = 80;
      const tctx = tagC.getContext('2d');
      tctx.fillStyle = 'rgba(10,10,25,0.85)';
      tctx.fillRect(0, 0, 256, 80);
      tctx.font = '18px sans-serif'; tctx.fillStyle = '#fff';
      tctx.textAlign = 'center';
      tctx.fillText(`${o.emoji} ${o.name}`, 128, 28);
      tctx.font = 'bold 20px monospace';
      tctx.fillStyle = '#00ffcc';
      tctx.fillText(`${o.finalCost} 💵`, 128, 60);
      const tagTex = new THREE.CanvasTexture(tagC);
      tagTex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.22),
        new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }),
      );
      tag.position.set(x, y + 0.42, 0.06);
      this.group.add(tag);

      // Rarity bar under the gem
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.02, 0.02),
        createGlowMaterial(rarCol, 0.5),
      );
      bar.position.set(x, y + 0.01, 0.1);
      this.group.add(bar);

      // Hit zone
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(spacing * 0.9, 0.6, 0.4),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x, y + 0.25, 0.1);
      hit.userData = {
        interactable: true, action: 'shop_buy', index: i,
        label: `[Click] Acheter ${o.emoji} ${o.name} (${o.finalCost}💵)`,
      };
      this.group.add(hit);

      this._items.push({ gem, tag, bar, hit });
    }
  }

  _clearItems() {
    for (const item of this._items) {
      this.group.remove(item.gem);
      this.group.remove(item.tag);
      this.group.remove(item.bar);
      this.group.remove(item.hit);
    }
    this._items = [];
  }

  hide() {
    this._clearItems();
  }

  getInteractables() {
    if (this._items.length === 0) return [];
    const list = [];
    for (const item of this._items) list.push(item.hit);
    if (this._rerollHit) list.push(this._rerollHit);
    if (this._doneHit) list.push(this._doneHit);
    return list;
  }

  update(dt) {
    if (this._items.length === 0) return;
    const t = Date.now() * 0.001;
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      item.gem.rotation.y += dt * 1.2;
      item.gem.rotation.z = Math.sin(t * 2 + i) * 0.15;
      item.gem.position.y += Math.sin(t * 3 + i * 1.5) * 0.0003;
    }
  }
}
