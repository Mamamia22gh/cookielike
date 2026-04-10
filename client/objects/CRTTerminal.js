import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * CRT-style terminal for game menus.
 * Green phosphor text, scanlines, character-by-character typing.
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

    this._lines = [];
    this._typeQueue = [];
    this._typeTimer = 0;
    this._scanOffset = 0;

    this._build();
    this.showIdle();
  }

  _build() {
    // Monitor body
    const monMat = createMaterial(0x2a2a1e, 0.6, 0.3);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.8, 1.2), monMat);
    body.position.y = 0;
    body.castShadow = true;
    this.group.add(body);

    // Screen bezel
    const bezelMat = createMaterial(0x1a1a12, 0.5, 0.2);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 0.1), bezelMat);
    bezel.position.set(0, 0, 0.56);
    this.group.add(bezel);

    // CRT screen (curved look via plane)
    const screenGeo = new THREE.PlaneGeometry(3.8, 2.85);
    const screenMat = new THREE.MeshBasicMaterial({ map: this._texture });
    this._screen = new THREE.Mesh(screenGeo, screenMat);
    this._screen.position.set(0, 0, 0.62);
    this.group.add(this._screen);

    // Screen glow
    const glowGeo = new THREE.PlaneGeometry(4.0, 3.0);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ff44,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 0, 0.63);
    this.group.add(glow);

    // Buttons under screen
    const btnMat = createGlowMaterial(0x22aa33, 0.3);
    this._actionBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 12), btnMat);
    this._actionBtn.rotation.x = Math.PI / 2;
    this._actionBtn.position.set(0, -2.1, 0.5);
    this.group.add(this._actionBtn);

    // Button hit zone
    const hitGeo = new THREE.BoxGeometry(0.8, 0.5, 0.4);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this._actionHit = new THREE.Mesh(hitGeo, hitMat);
    this._actionHit.position.set(0, -2.1, 0.5);
    this._actionHit.userData = { interactable: true, action: 'start_run', label: '' };
    this.group.add(this._actionHit);
    this._actionHit.visible = false;

    // Side vents
    for (const x of [-2.2, 2.2]) {
      for (let y = -1; y <= 1; y += 0.4) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.08, 0.8),
          createMaterial(0x333322, 0.7, 0.1),
        );
        vent.position.set(x, y, 0);
        this.group.add(vent);
      }
    }

    // Power LED
    this._led = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      createGlowMaterial(0x00ff44, 0.8),
    );
    this._led.position.set(-1.6, -2.1, 0.55);
    this.group.add(this._led);

    // Desk/stand
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.12, 2.0),
      createMaterial(0x3a2a1e, 0.6, 0.2),
    );
    desk.position.set(0, -2.05, -0.3);
    this.group.add(desk);
    for (const x of [-2.4, 2.4]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.0, 0.12),
        createMaterial(0x3a2a1e, 0.6, 0.2),
      );
      leg.position.set(x, -3.1, -0.3);
      this.group.add(leg);
    }
  }

  /* ── Draw helpers ── */
  _clear() {
    const ctx = this._ctx;
    ctx.fillStyle = '#030806';
    ctx.fillRect(0, 0, 800, 600);
  }

  _drawScanlines() {
    const ctx = this._ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 600; y += 3) {
      ctx.fillRect(0, y, 800, 1);
    }
    // Moving scanline
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

  _text(str, x, y, { color = '#00ff44', size = 22, align = 'left', font = 'monospace' } = {}) {
    const ctx = this._ctx;
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  _flush() {
    this._drawScanlines();
    this._drawVignette();
    this._texture.needsUpdate = true;
  }

  /* ── Phase displays ── */
  showIdle() {
    this._clear();
    this._text('╔══════════════════════════════╗', 50, 120, { size: 18 });
    this._text('║                              ║', 50, 145, { size: 18 });
    this._text('║    🍪 COOKIELIKE FACTORY 🍪    ║', 50, 170, { size: 18 });
    this._text('║                              ║', 50, 195, { size: 18 });
    this._text('╚══════════════════════════════╝', 50, 220, { size: 18 });
    this._text('> Cookie Roguelike Factory v0.2', 50, 280, { color: '#009933', size: 18 });
    this._text('> Système de production initialisé', 50, 310, { color: '#009933', size: 18 });
    this._text('> En attente d\'opérateur...', 50, 340, { color: '#009933', size: 18 });
    this._text('[APPUYER POUR DÉMARRER]', 400, 480, { align: 'center', size: 24, color: '#00ff88' });
    this._flush();
    this._showButton('start_run', '[Click] Démarrer');
  }

  showPreview(data) {
    const { round, quota, paste, ovens, pool } = data;
    this._clear();
    this._text(`═══ ORDRE DE PRODUCTION #${round} ═══`, 400, 60, { align: 'center', size: 22 });
    this._text(`Round ${round}/15`, 50, 110, { size: 20 });
    this._text(`Quota cible ........... ${quota} 🪙`, 50, 150, { size: 18 });
    this._text(`Pâte disponible ....... ${paste}`, 50, 180, { size: 18 });
    this._text(`Timer ................. 300s`, 50, 210, { size: 18 });
    this._text(`Fours ................. ${ovens.map(o => o.typeId).join(', ')}`, 50, 240, { size: 18 });

    if (pool?.length) {
      this._text('── POOL RECETTES ──', 50, 290, { size: 16, color: '#009933' });
      const total = pool.reduce((s, e) => s + e.weight, 0);
      let y = 320;
      for (const e of pool) {
        const pct = total > 0 ? Math.round(e.weight / total * 100) : 0;
        this._text(`  ${e.recipeId} ×${e.weight} (${pct}%)`, 50, y, { size: 16, color: '#008844' });
        y += 22;
      }
    }

    this._text('[LANCER LA PRODUCTION]', 400, 520, { align: 'center', size: 22, color: '#00ff88' });
    this._flush();
    this._showButton('start_round', '[Click] Lancer');
  }

  showResults(data) {
    const { totalValue, quota, passed, surplus, shopCoins, round, boxes } = data;
    this._clear();
    this._text(`═══ RAPPORT ROUND ${round} ═══`, 400, 50, { align: 'center', size: 22 });

    if (boxes?.length) {
      let y = 100;
      for (const box of boxes.slice(0, 5)) {
        const bg = box.gridResult?.bestGroup;
        const info = bg ? `${bg.name} ×${bg.size}` : '—';
        this._text(`  Boîte: ${info} → ${box.value} 🪙`, 50, y, { size: 16, color: '#009933' });
        y += 24;
      }
    }

    this._text(`Total ................. ${totalValue} 🪙`, 50, 340, { size: 20 });
    this._text(`Quota ................. ${quota} 🪙`, 50, 370, { size: 20 });

    if (passed) {
      this._text('>>> QUOTA ATTEINT <<<', 400, 430, { align: 'center', size: 26, color: '#00ff88' });
      this._text(`Surplus: ${surplus} → +${shopCoins} 💵`, 400, 465, { align: 'center', size: 18, color: '#009933' });
      this._text('[CONTINUER]', 400, 530, { align: 'center', size: 22, color: '#00ff88' });
      this._showButton('continue_results', '[Click] Continuer');
    } else {
      this._text('>>> QUOTA NON ATTEINT <<<', 400, 430, { align: 'center', size: 26, color: '#ff4444' });
      this._hideButton();
    }
    this._flush();
  }

  showGameOver(data, run) {
    this._clear();
    this._text('╔══════════════════════════════╗', 50, 100, { size: 18, color: '#ff4444' });
    this._text('║    ⚠ AVIS DE LICENCIEMENT ⚠   ║', 50, 125, { size: 18, color: '#ff4444' });
    this._text('╚══════════════════════════════╝', 50, 150, { size: 18, color: '#ff4444' });
    this._text(`Round atteint: ${run?.round ?? '?'}/15`, 50, 210, { size: 20 });
    this._text(`Score final: ${run?.score ?? 0} 🪙`, 50, 245, { size: 20 });
    this._text(`Étoiles: +${data.stars} ⭐`, 50, 280, { size: 20 });
    if (run?.artifacts?.length) {
      this._text('Artefacts: ' + run.artifacts.map(a => a.emoji).join(' '), 50, 320, { size: 18, color: '#888' });
    }
    this._text('[NOUVEAU RUN]', 400, 500, { align: 'center', size: 22, color: '#00ff88' });
    this._flush();
    this._showButton('start_run', '[Click] Relancer');
  }

  showVictory(data, run) {
    this._clear();
    this._text('╔══════════════════════════════╗', 50, 100, { size: 18, color: '#ffd700' });
    this._text('║    🏆 PRODUCTION TERMINÉE 🏆   ║', 50, 125, { size: 18, color: '#ffd700' });
    this._text('╚══════════════════════════════╝', 50, 150, { size: 18, color: '#ffd700' });
    this._text(`Score: ${run?.score ?? 0} 🪙`, 50, 210, { size: 22, color: '#ffd700' });
    this._text(`Étoiles: +${data.stars} ⭐`, 50, 250, { size: 22, color: '#ffd700' });
    this._text('[NOUVEAU RUN]', 400, 500, { align: 'center', size: 22, color: '#00ff88' });
    this._flush();
    this._showButton('start_run', '[Click] Rejouer');
  }

  _showButton(action, label) {
    this._actionHit.visible = true;
    this._actionHit.userData.action = action;
    this._actionHit.userData.label = label;
    this._actionBtn.material.emissiveIntensity = 0.6;
  }

  _hideButton() {
    this._actionHit.visible = false;
    this._actionBtn.material.emissiveIntensity = 0.1;
  }

  hideButton() { this._hideButton(); }

  getInteractables() {
    if (this._actionHit.visible) return [this._actionHit];
    return [];
  }

  update(dt) {
    // LED blink
    const t = Date.now() * 0.003;
    this._led.material.emissiveIntensity = 0.5 + Math.sin(t) * 0.3;

    // Refresh scanlines periodically
    if (this._texture.needsUpdate === false) {
      // Light refresh for scanline movement
      this._scanOffset = (this._scanOffset + dt * 60) % 600;
    }
  }
}
