import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

const ZONE_COLORS_HEX = {
  RAW: '#3b82f6',
  COOKED: '#eab308',
  PERFECT: '#22c55e',
  SWEET_SPOT: '#a855f7',
  BURNED: '#ef4444',
};

const ZONE_COLORS_NUM = {
  RAW: 0x3b82f6,
  COOKED: 0xeab308,
  PERFECT: 0x22c55e,
  SWEET_SPOT: 0xa855f7,
  BURNED: 0xef4444,
};

/**
 * Tactile screen next to an oven showing a virtual view of the cookie grid.
 * Player clicks individual cookies on this screen to extract them.
 */
export class OvenScreen {
  constructor(ovenIndex) {
    this.ovenIndex = ovenIndex;
    this.group = new THREE.Group();
    this.group.name = `OvenScreen_${ovenIndex}`;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 400;
    this._canvas.height = 500;
    this._ctx = this._canvas.getContext('2d');
    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._texture.minFilter = THREE.LinearFilter;

    this._cookieHitboxes = [];
    this._cookieStates = null;
    this._gridCols = 0;
    this._gridRows = 0;
    this._box = null;

    this._build();
  }

  _build() {
    // Monitor stand
    const standMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), standMat);
    pole.position.y = 0.5;
    this.group.add(pole);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 8), standMat);
    base.position.y = 0.03;
    this.group.add(base);

    // Screen frame
    const frameMat = createMaterial(0x222233, 0.3, 0.6);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.08), frameMat);
    frame.position.set(0, 1.7, 0);
    frame.castShadow = true;
    this.group.add(frame);

    // Screen display
    const screenGeo = new THREE.PlaneGeometry(1.0, 1.25);
    const screenMat = new THREE.MeshBasicMaterial({ map: this._texture });
    this._screen = new THREE.Mesh(screenGeo, screenMat);
    this._screen.position.set(0, 1.7, 0.045);
    this.group.add(this._screen);

    // Power LED
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      createGlowMaterial(0x22c55e, 0.6),
    );
    led.position.set(0.45, 1.05, 0.05);
    this.group.add(led);

    // Tilt slightly toward player
    this.group.rotation.x = -0.15;

    this._drawIdle();
  }

  _drawIdle() {
    const ctx = this._ctx;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 400, 500);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#334';
    ctx.textAlign = 'center';
    ctx.fillText('FOUR EN ATTENTE', 200, 250);
    this._texture.needsUpdate = true;
  }

  /** Load a box and create per-cookie hitboxes in front of the screen. */
  loadBox(box) {
    this._box = box;
    this._clearHitboxes();

    if (!box?.grid) return;
    this._gridCols = box.grid.length;
    this._gridRows = box.grid[0]?.length ?? 5;

    const cellW = 0.9 / this._gridCols;
    const cellH = 1.1 / this._gridRows;
    const startX = -0.45 + cellW / 2;
    const startY = 2.25 - cellH / 2;

    for (let col = 0; col < this._gridCols; col++) {
      for (let row = 0; row < this._gridRows; row++) {
        const x = startX + col * cellW;
        const y = startY - row * cellH;

        const hitGeo = new THREE.BoxGeometry(cellW * 0.85, cellH * 0.85, 0.15);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.set(x, y, 0.1);
        hitbox.userData = {
          interactable: true,
          action: 'extract_cookie',
          ovenIndex: this.ovenIndex,
          col,
          row,
          label: '',
        };
        this.group.add(hitbox);
        this._cookieHitboxes.push({ hitbox, col, row, done: false });
      }
    }
  }

  /** Update visual state from cookieStates array. */
  setCookieStates(cookieStates) {
    this._cookieStates = cookieStates;
    this._render();

    // Update hitbox labels
    if (!cookieStates) return;
    const rows = this._gridRows;
    for (const ch of this._cookieHitboxes) {
      if (ch.done) continue;
      const ci = ch.col * rows + ch.row;
      const cs = cookieStates[ci];
      if (!cs || cs.done) {
        ch.hitbox.userData.interactable = false;
        ch.done = true;
        continue;
      }
      const p = Math.min(1, cs.progress);
      let zone = 'RAW';
      if (p >= 0.85) zone = 'BURNED';
      else if (p >= 0.70) zone = 'PERFECT';
      else if (p >= 0.30) zone = 'COOKED';

      const icons = { RAW: '🔵', COOKED: '🟡', PERFECT: '🟢', BURNED: '🔴' };
      const names = { RAW: 'CRU', COOKED: 'CUIT', PERFECT: 'PARFAIT', BURNED: 'BRÛLÉ' };
      ch.hitbox.userData.label = `[Click] ${icons[zone]} ${names[zone]} (${Math.round(p * 100)}%)`;
    }
  }

  /** Mark a cookie as extracted on screen. */
  cookieExtracted(col, row) {
    const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);
    if (ch) {
      ch.done = true;
      ch.hitbox.userData.interactable = false;
    }
    this._render();
  }

  /** Mark cookie as burned on screen. */
  cookieBurned(col, row) {
    const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);
    if (ch) {
      ch.done = true;
      ch.hitbox.userData.interactable = false;
      ch.hitbox.userData.label = '💀 Brûlé';
    }
    this._render();
  }

  /** Box completed. */
  boxComplete() {
    this._clearHitboxes();
    this._box = null;
    this._cookieStates = null;
    this._drawIdle();
  }

  /** Get active hitboxes for raycasting. */
  getHitboxes() {
    return this._cookieHitboxes
      .filter(ch => !ch.done && ch.hitbox.userData.interactable)
      .map(ch => ch.hitbox);
  }

  _clearHitboxes() {
    for (const ch of this._cookieHitboxes) {
      this.group.remove(ch.hitbox);
    }
    this._cookieHitboxes = [];
  }

  /** Render the cookie grid on the canvas. */
  _render() {
    const ctx = this._ctx;
    const W = 400, H = 500;
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, W, H);

    if (!this._box || !this._cookieStates) {
      this._drawIdle();
      return;
    }

    const cols = this._gridCols;
    const rows = this._gridRows;
    const cellW = (W - 40) / cols;
    const cellH = (H - 60) / rows;
    const startX = 20;
    const startY = 40;

    // Title
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(`FOUR ${this.ovenIndex + 1}`, W / 2, 25);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const x = startX + col * cellW;
        const y = startY + row * cellH;
        const ci = col * rows + row;
        const cs = this._cookieStates[ci];
        const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);

        if (!cs) continue;

        const p = Math.min(1, cs.progress);
        let zone = 'RAW';
        if (cs.done && ch?.done) zone = 'EXTRACTED';
        else if (p >= 0.85) zone = 'BURNED';
        else if (p >= 0.70) zone = 'PERFECT';
        else if (p >= 0.30) zone = 'COOKED';

        // Cell background
        if (zone === 'EXTRACTED') {
          ctx.fillStyle = '#111';
          ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
          ctx.font = '16px sans-serif';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.fillText('✓', x + cellW / 2, y + cellH / 2 + 5);
          continue;
        }

        const color = ZONE_COLORS_HEX[zone] || '#333';

        // Cell border
        ctx.strokeStyle = color;
        ctx.lineWidth = zone === 'PERFECT' ? 3 : 1.5;
        ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);

        // Progress bar at bottom
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x + 4, y + cellH - 10, cellW - 8, 6);
        ctx.fillStyle = color;
        ctx.fillRect(x + 4, y + cellH - 10, (cellW - 8) * p, 6);

        // Cookie emoji
        const cell = this._box.grid[col]?.[row];
        if (cell) {
          ctx.font = `${Math.floor(cellW * 0.45)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(this._getEmoji(cell.recipeId), x + cellW / 2, y + cellH / 2 + 2);
        }

        // PERFECT pulse
        if (zone === 'PERFECT') {
          const pulse = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
          ctx.fillStyle = `rgba(34,197,94,${pulse})`;
          ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
        }

        // BURNED flicker
        if (zone === 'BURNED') {
          const flicker = 0.15 + Math.random() * 0.15;
          ctx.fillStyle = `rgba(239,68,68,${flicker})`;
          ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
        }

        // Percentage
        ctx.font = '11px monospace';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(p * 100)}%`, x + cellW / 2, y + 14);
      }
    }

    this._texture.needsUpdate = true;
  }

  _getEmoji(recipeId) {
    const map = {
      choco: '🍫', vanilla: '🍦', strawberry: '🍓', lemon: '🍋',
      peanut: '🥜', butter: '🧈', cinnamon: '🫚', hazelnut: '🌰',
      caramel: '🍯', matcha: '🍵', coconut: '🥥', macaron: '🧁',
      truffle: '🍬', golden: '✨', joker: '🃏',
    };
    return map[recipeId] || '🍪';
  }

  update(dt) {
    // Re-render if active
    if (this._cookieStates) this._render();
  }
}
