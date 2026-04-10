import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * CRT-style terminal for game menus.
 * Green phosphor text, scanlines, character-by-character typing.
 * Full menu navigation via clickable keyboard keys.
 */
export class CRTTerminal {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CRTTerminal';

    this._canvas = document.createElement('canvas');
    this._canvas.width = 800;
    this._canvas.height = 600;
    this._ctx = this._canvas.getContext('2d');
    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._texture.minFilter = THREE.LinearFilter;

    this._scanOffset = 0;
    this._keyboardHits = [];

    // ── Menu state ──
    this._menuMode = 'main'; // main | settings | ingame
    this._menuItems = [];
    this._selectedIndex = 0;
    this._onAction = null; // callback(actionName)

    this._build();
    this._setMainMenu();
    this._renderMenu();
  }

  _build() {
    const plasticMat = createMaterial(0xc8c0a8, 0.75, 0.05);
    const bodyW = 1.6, bodyH = 1.3, bodyD = 1.2;

    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), plasticMat);
    body.position.set(0, bodyH / 2, -bodyD / 2);
    body.castShadow = true;
    this.group.add(body);

    const bezelMat = createMaterial(0x3a3a30, 0.6, 0.05);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.1, bodyH - 0.15, 0.05), bezelMat);
    bezel.position.set(0, bodyH / 2, 0.03);
    this.group.add(bezel);

    const screenGeo = new THREE.PlaneGeometry(bodyW - 0.35, bodyH - 0.4);
    const screenMat = new THREE.MeshBasicMaterial({ map: this._texture });
    this._screen = new THREE.Mesh(screenGeo, screenMat);
    this._screen.position.set(0, bodyH / 2 + 0.02, 0.056);
    this.group.add(this._screen);

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ff44, transparent: true, opacity: 0.02, blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(bodyW - 0.3, bodyH - 0.35), glowMat);
    glow.position.set(0, bodyH / 2 + 0.02, 0.057);
    this.group.add(glow);

    this.screenLight = new THREE.PointLight(0x00ff44, 1.5, 6);
    this.screenLight.position.set(0, bodyH / 2, 0.4);
    this.screenLight.castShadow = true;
    this.screenLight.shadow.bias = -0.002;
    this.group.add(this.screenLight);
    this._targetLightColor = new THREE.Color(0x00ff44);

    this._led = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      createGlowMaterial(0x00ff44, 0.8),
    );
    this._led.position.set(bodyW / 2 - 0.15, 0.12, 0.03);
    this.group.add(this._led);

    const btnMat = createGlowMaterial(0x22aa33, 0.3);
    this._actionBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 10), btnMat);
    this._actionBtn.rotation.x = Math.PI / 2;
    this._actionBtn.position.set(-bodyW / 2 + 0.15, 0.12, 0.04);
    this._actionBtn.visible = false; // Hidden — replaced by keyboard interaction
    this.group.add(this._actionBtn);

    this._actionHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.25, 0.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this._actionHit.position.set(-bodyW / 2 + 0.15, 0.12, 0.1);
    this._actionHit.userData = { interactable: false };
    this.group.add(this._actionHit);
    this._actionHit.visible = false;

    // ── Post-its stuck on monitor bezel ──
    const postitColors = [0xffeb3b, 0xff99cc, 0xccff90, 0x80deea, 0xffb74d];
    const postitGeo = new THREE.BoxGeometry(0.076, 0.076, 0.002);
    const lineGeo = new THREE.BoxGeometry(0.05, 0.003, 0.004);
    const lineMat = createMaterial(0x444444, 0.8, 0.1);

    const postitPositions = [
      { x: bodyW / 2 - 0.08, y: bodyH - 0.15, z: 0.04, rz: 0.2 },
      { x: bodyW / 2 - 0.05, y: bodyH - 0.35, z: 0.04, rz: -0.15 },
      { x: -bodyW / 2 + 0.1, y: bodyH - 0.12, z: 0.04, rz: -0.25 },
      { x: bodyW / 2 - 0.12, y: 0.18, z: 0.04, rz: 0.1 },
    ];
    for (const pp of postitPositions) {
      const color = postitColors[Math.floor(Math.random() * postitColors.length)];
      const mat = createMaterial(color, 0.9, 0.1);
      const postit = new THREE.Mesh(postitGeo, mat);
      postit.position.set(pp.x, pp.y, pp.z);
      postit.rotation.z = pp.rz;
      for (let j = 0; j < 3; j++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set((Math.random() - 0.5) * 0.01, 0.02 - j * 0.012, 0.002);
        line.scale.x = 0.4 + Math.random() * 0.5;
        postit.add(line);
      }
      this.group.add(postit);
    }

    // ── Keyboard ──
    const kbMat = createMaterial(0xb0a890, 0.7, 0.05);
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.45), kbMat);
    keyboard.position.set(0, 0.02, 0.6);
    this.group.add(keyboard);

    const keyMat = createMaterial(0x8a8270, 0.6, 0.05);
    const keyGeo = new THREE.BoxGeometry(0.065, 0.025, 0.065);
    const keySpX = 0.085;
    const keySpZ = 0.095;
    const kbStartX = -0.46;
    const kbStartZ = 0.44;

    // Interactive key positions (on the grid)
    // Row 2 col 9: arrow up
    // Row 3 cols 8,9,10: arrow left, down, right
    // Row 3 col 11: enter
    // Row 0 col 11: backspace
    const interactiveSlots = new Set();
    interactiveSlots.add('2_9');  // up
    interactiveSlots.add('3_8');  // left
    interactiveSlots.add('3_9');  // down
    interactiveSlots.add('3_10'); // right
    interactiveSlots.add('3_11'); // enter
    interactiveSlots.add('0_11'); // backspace

    // Rows 0-2: regular keys (skip interactive slots)
    for (let row = 0; row < 3; row++) {
      const rowOffset = row * 0.015;
      for (let col = 0; col < 12; col++) {
        if (interactiveSlots.has(`${row}_${col}`)) continue;
        const x = kbStartX + rowOffset + col * keySpX;
        const z = kbStartZ + row * keySpZ;
        const key = new THREE.Mesh(keyGeo, keyMat);
        key.position.set(x, 0.055, z);
        this.group.add(key);
      }
    }

    // Row 3: spacebar (cols 3-7) + filler (cols 0-2)
    const row3Z = kbStartZ + 3 * keySpZ;
    for (let col = 0; col < 12; col++) {
      if (interactiveSlots.has(`3_${col}`)) continue;
      const x = kbStartX + 3 * 0.015 + col * keySpX;
      if (col >= 3 && col <= 7) {
        if (col === 5) {
          const space = new THREE.Mesh(keyGeo, keyMat);
          space.scale.set(5, 1, 1);
          space.position.set(kbStartX + 5 * keySpX, 0.055, row3Z);
          this.group.add(space);
        }
        continue;
      }
      const key = new THREE.Mesh(keyGeo, keyMat);
      key.position.set(x, 0.055, row3Z);
      this.group.add(key);
    }

    // ── Interactive keys (on the grid) ──
    this._glowKeys = [];

    const makeKeyHit = (row, col, action, label, w = 0.07, d = 0.07, color = 0x9a9280, glow = false) => {
      const rowOffset = row * 0.015;
      const x = kbStartX + rowOffset + col * keySpX;
      const z = kbStartZ + row * keySpZ;
      const mat = glow ? createGlowMaterial(color, 0.3) : createMaterial(color, 0.5, 0.15);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat);
      mesh.position.set(x, 0.055, z);
      this.group.add(mesh);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.copy(mesh.position);
      hit.userData = { interactable: true, action, label };
      this.group.add(hit);
      this._keyboardHits.push(hit);
      if (glow) this._glowKeys.push(mesh);
      return mesh;
    };

    // Arrow up: row 2 col 9
    makeKeyHit(2, 9, 'key_up', '▲ Haut', 0.065, 0.065, 0x44aa66, true);
    // Arrow left: row 3 col 8
    makeKeyHit(3, 8, 'key_left', '◄ Gauche', 0.065, 0.065, 0x44aa66, true);
    // Arrow down: row 3 col 9
    makeKeyHit(3, 9, 'key_down', '▼ Bas', 0.065, 0.065, 0x44aa66, true);
    // Arrow right: row 3 col 10
    makeKeyHit(3, 10, 'key_right', '► Droite', 0.065, 0.065, 0x44aa66, true);
    // Enter: row 3 col 11
    makeKeyHit(3, 11, 'key_enter', '[Entrée] ✓', 0.08, 0.065, 0xcc5544, true);
    // Backspace: row 0 col 11
    makeKeyHit(0, 11, 'key_back', '[Retour] ←', 0.08, 0.065, 0x888877, false);

    // ── Side vents ──
    for (const x of [-bodyW / 2 - 0.01, bodyW / 2 + 0.01]) {
      for (let y = 0.3; y <= 1.0; y += 0.12) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.04, 0.6),
          createMaterial(0xaaa890, 0.7, 0.05),
        );
        vent.position.set(x, y, -bodyD / 2);
        this.group.add(vent);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  MENU SYSTEM
  // ═══════════════════════════════════════════════════

  /** Set callback for menu actions. */
  setActionCallback(fn) { this._onAction = fn; }

  /** Handle a keyboard key press from the 3D keyboard. */
  handleKey(action) {
    if (action === 'key_up') {
      this._selectedIndex = Math.max(0, this._selectedIndex - 1);
      this._renderMenu();
    } else if (action === 'key_down') {
      this._selectedIndex = Math.min(this._menuItems.length - 1, this._selectedIndex + 1);
      this._renderMenu();
    } else if (action === 'key_enter') {
      this._activateSelected();
    } else if (action === 'key_back') {
      if (this._menuMode !== 'main' && this._menuMode !== 'ingame') {
        this._setMainMenu();
        this._renderMenu();
      }
    }
  }

  _activateSelected() {
    const item = this._menuItems[this._selectedIndex];
    if (!item) return;

    if (item.action === 'start_run') {
      if (this._onAction) this._onAction('start_run');
    } else if (item.action === 'goto_settings') {
      this._setSettingsMenu();
      this._renderMenu();
    } else if (item.action === 'goto_main') {
      this._setMainMenu();
      this._renderMenu();
    } else if (item.action === 'start_round') {
      if (this._onAction) this._onAction('start_round');
    } else if (item.action === 'continue_results') {
      if (this._onAction) this._onAction('continue_results');
    } else if (item.action) {
      if (this._onAction) this._onAction(item.action);
    }
  }

  _setMainMenu() {
    this._menuMode = 'main';
    this._selectedIndex = 0;
    this._menuItems = [
      { label: '▶  NOUVELLE PARTIE', action: 'start_run' },
      { label: '⚙  PARAMÈTRES', action: 'goto_settings' },
    ];
  }

  _setSettingsMenu() {
    this._menuMode = 'settings';
    this._selectedIndex = 0;
    this._menuItems = [
      { label: '◄  RETOUR', action: 'goto_main' },
    ];
  }

  // ═══════════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════════

  _clear() {
    const ctx = this._ctx;
    ctx.fillStyle = '#030806';
    ctx.fillRect(0, 0, 800, 600);
  }

  _drawScanlines() {
    const ctx = this._ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 600; y += 3) ctx.fillRect(0, y, 800, 1);
    this._scanOffset = (this._scanOffset + 0.5) % 600;
    ctx.fillStyle = 'rgba(0,255,60,0.04)';
    ctx.fillRect(0, this._scanOffset, 800, 4);
  }

  _drawVignette() {
    const ctx = this._ctx;
    const grad = ctx.createRadialGradient(400, 300, 150, 400, 300, 420);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
  }

  _text(str, x, y, { color = '#00ff44', size = 26, align = 'left', font = 'monospace' } = {}) {
    const ctx = this._ctx;
    ctx.font = `bold ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  _flush() {
    this._drawScanlines();
    this._drawVignette();
    this._texture.needsUpdate = true;
  }

  _renderMenu() {
    if (this._menuMode === 'main') this._renderMainMenu();
    else if (this._menuMode === 'settings') this._renderSettingsMenu();
    // ingame modes handled by showPreview/showResults/etc.
  }

  _renderMainMenu() {
    this._targetLightColor.setHex(0x00ff44);
    this._clear();

    // Title
    this._text('╔══════════════════════════════╗', 400, 120, { align: 'center', size: 28 });
    this._text('║    🍪 COOKIES AT HOME 🍪    ║', 400, 155, { align: 'center', size: 28 });
    this._text('╚══════════════════════════════╝', 400, 190, { align: 'center', size: 28 });

    this._text('> SYSTÈME DE PRODUCTION v0.2', 400, 245, { align: 'center', color: '#00bb44', size: 22 });

    // Menu items
    let y = 340;
    for (let i = 0; i < this._menuItems.length; i++) {
      const item = this._menuItems[i];
      const selected = i === this._selectedIndex;
      const color = selected ? '#00ff88' : '#007733';
      const prefix = selected ? '►  ' : '   ';
      this._text(prefix + item.label, 400, y, { align: 'center', size: 34, color });
      y += 55;
    }

    // Footer
    this._text('▲▼ NAVIGUER    ENTRÉE VALIDER', 400, 550, { align: 'center', size: 20, color: '#005522' });

    this._flush();
  }

  _renderSettingsMenu() {
    this._targetLightColor.setHex(0x00ff44);
    this._clear();

    this._text('═══ PARAMÈTRES ═══', 400, 100, { align: 'center', size: 28 });

    let y = 250;
    for (let i = 0; i < this._menuItems.length; i++) {
      const item = this._menuItems[i];
      const selected = i === this._selectedIndex;
      const color = selected ? '#00ff88' : '#007733';
      const prefix = selected ? '►  ' : '   ';
      this._text(prefix + item.label, 400, y, { align: 'center', size: 26, color });
      y += 50;
    }

    this._text('RETOUR pour revenir', 400, 550, { align: 'center', size: 16, color: '#005522' });
    this._flush();
  }

  // ═══════════════════════════════════════════════════
  //  IN-GAME PHASE DISPLAYS
  // ═══════════════════════════════════════════════════

  showIdle() {
    this._setMainMenu();
    this._renderMenu();
  }

  showPreview(data) {
    this._menuMode = 'ingame';
    this._targetLightColor.setHex(0x00ff44);
    const { round, quota, paste } = data;
    this._selectedIndex = 0;
    this._menuItems = [{ label: '▶  LANCER LE ROUND', action: 'start_round' }];

    this._clear();
    this._text(`═══ ORDRE #${round} ═══`, 400, 70, { align: 'center', size: 26 });
    this._text(`Round ........... ${round}/15`, 80, 140, { size: 22 });
    this._text(`Quota ........... ${quota} 🪙`, 80, 175, { size: 22 });
    this._text(`Pâte ............ ${paste}`, 80, 210, { size: 22 });
    this._text(`Timer ........... 300s`, 80, 245, { size: 22 });

    if (data.pool?.length) {
      this._text('── POOL ──', 480, 140, { size: 20, color: '#00bb44' });
      const total = data.pool.reduce((s, e) => s + e.weight, 0);
      let y = 175;
      for (const e of data.pool.slice(0, 5)) {
        const pct = total > 0 ? Math.round(e.weight / total * 100) : 0;
        this._text(`${e.recipeId} ×${e.weight} (${pct}%)`, 480, y, { size: 18, color: '#00aa44' });
        y += 28;
      }
    }

    const sel = this._selectedIndex === 0;
    this._text((sel ? '►  ' : '   ') + '[ LANCER ]', 400, 480, { align: 'center', size: 26, color: sel ? '#00ff88' : '#007733' });
    this._flush();
    this._showButton('start_round', '[Entrée] Lancer');
  }

  showResults(data) {
    this._menuMode = 'ingame';
    const { totalValue, quota, passed, surplus, shopCoins, round, boxes } = data;
    this._targetLightColor.setHex(passed ? 0x00ff44 : 0xff4444);

    if (passed) {
      this._selectedIndex = 0;
      this._menuItems = [{ label: '▶  CONTINUER', action: 'continue_results' }];
    } else {
      this._menuItems = [];
    }

    this._clear();
    this._text(`═══ RAPPORT #${round} ═══`, 400, 60, { align: 'center', size: 26 });

    if (boxes?.length) {
      let y = 110;
      for (const box of boxes.slice(0, 4)) {
        const bg = box.gridResult?.bestGroup;
        const info = bg ? `${bg.name} ×${bg.size}` : '—';
        this._text(`${info} → ${box.value} 🪙`, 80, y, { size: 18, color: '#00bb44' });
        y += 26;
      }
    }

    this._text(`Total: ${totalValue} 🪙`, 80, 280, { size: 24 });
    this._text(`Quota: ${quota} 🪙`, 80, 315, { size: 24 });

    if (passed) {
      this._text('>>> QUOTA ATTEINT <<<', 400, 390, { align: 'center', size: 30, color: '#00ff88' });
      this._text(`+${shopCoins} 💵`, 400, 430, { align: 'center', size: 24, color: '#00bb44' });
      this._text('►  [ CONTINUER ]', 400, 500, { align: 'center', size: 26, color: '#00ff88' });
      this._showButton('continue_results', '[Entrée] Continuer');
    } else {
      this._text('>>> QUOTA RATÉ <<<', 400, 400, { align: 'center', size: 30, color: '#ff4444' });
      this._hideButton();
    }
    this._flush();
  }

  showGameOver(data, run) {
    this._menuMode = 'ingame';
    this._targetLightColor.setHex(0xff4444);
    this._selectedIndex = 0;
    this._menuItems = [{ label: '▶  NOUVEAU RUN', action: 'start_run' }];

    this._clear();
    this._text('⚠ LICENCIEMENT ⚠', 400, 120, { align: 'center', size: 36, color: '#ff4444' });
    this._text(`Round: ${run?.round ?? '?'}/15`, 80, 230, { size: 26 });
    this._text(`Score: ${run?.score ?? 0} 🪙`, 80, 270, { size: 26 });
    this._text(`Étoiles: +${data.stars} ⭐`, 80, 310, { size: 26 });
    this._text('►  [ NOUVEAU RUN ]', 400, 480, { align: 'center', size: 26, color: '#00ff88' });
    this._flush();
    this._showButton('start_run', '[Entrée] Relancer');
  }

  showVictory(data, run) {
    this._menuMode = 'ingame';
    this._targetLightColor.setHex(0xffd700);
    this._selectedIndex = 0;
    this._menuItems = [{ label: '▶  REJOUER', action: 'start_run' }];

    this._clear();
    this._text('🏆 TERMINÉ 🏆', 400, 120, { align: 'center', size: 36, color: '#ffd700' });
    this._text(`Score: ${run?.score ?? 0} 🪙`, 80, 240, { size: 28, color: '#ffd700' });
    this._text(`Étoiles: +${data.stars} ⭐`, 80, 290, { size: 28, color: '#ffd700' });
    this._text('►  [ REJOUER ]', 400, 480, { align: 'center', size: 26, color: '#00ff88' });
    this._flush();
    this._showButton('start_run', '[Entrée] Rejouer');
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  _showButton(action, label) {
    this._actionHit.visible = true;
    this._actionHit.userData = { interactable: true, action, label };
    this._actionBtn.material.emissiveIntensity = 0.6;
  }

  _hideButton() {
    this._actionHit.visible = false;
    this._actionBtn.material.emissiveIntensity = 0.1;
  }

  hideButton() { this._hideButton(); }

  getInteractables() {
    const list = [...this._keyboardHits];
    if (this._actionHit.visible) list.push(this._actionHit);
    return list;
  }

  isInMainMenu() { return this._menuMode === 'main' || this._menuMode === 'settings'; }

  update(dt) {
    const t = Date.now() * 0.003;
    this._led.material.emissiveIntensity = 0.5 + Math.sin(t) * 0.3;
    this._scanOffset = (this._scanOffset + dt * 60) % 600;
    this.screenLight.color.lerp(this._targetLightColor, dt * 5);
    this.screenLight.intensity = 1.0 + Math.random() * 0.15;

    // Glow keys pulse during menu
    if (this._glowKeys && (this._menuMode === 'main' || this._menuMode === 'settings' || this._menuMode === 'ingame')) {
      const pulse = 0.3 + Math.sin(t * 1.5) * 0.3;
      for (const key of this._glowKeys) {
        key.material.emissiveIntensity = pulse;
      }
    }

    // Re-render main menu for blinking cursor effect
    if (this._menuMode === 'main') {
      this._renderMainMenu();
    }
  }
}
