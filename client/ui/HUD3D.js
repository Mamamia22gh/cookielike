import * as THREE from 'three';

/**
 * Retro CRT horror HUD — rendered as THREE.js ortho overlay.
 * Phosphor green on black, scanlines, glitch tears, static noise,
 * segmented LED bars, text corruption on fade.
 */
export class HUD3D {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }),
    );
    this.scene.add(plane);

    this._timer = 0;
    this._paste = [0, 0];
    this._score = [0, 0];
    this._streak = 0;
    this._fever = null;
    this._phase = 'IDLE';
    this._round = 1;
    this._messages = [];
    this._hint = '';

    // CRT state
    this._time = 0;
    this._glitchTimer = 0;
    this._glitchOffset = 0;
    this._glitchBandY = -1;
    this._glitchBandH = 0;
    this._staticIntensity = 0.02;
    this._flickerAlpha = 1;
  }

  setTimer(t) { this._timer = t; }
  setPaste(c, m) { this._paste = [c, m]; }
  setScore(s, q) { this._score = [s, q]; }
  setStreak(s, f) { this._streak = s; this._fever = f; }
  setPhase(p) { this._phase = p; }
  setRound(r) { this._round = r; }
  setHint(t) { this._hint = t; }

  addMessage(text) {
    this._messages.push({ text, time: Date.now() });
    if (this._messages.length > 8) this._messages.shift();
  }

  /* ═══════════════════════════════════════════
   *  MAIN RENDER
   * ═══════════════════════════════════════════ */

  render() {
    const ctx = this.ctx;
    const W = 1920, H = 1080;
    const now = Date.now();
    this._time = now * 0.001;

    ctx.clearRect(0, 0, W, H);

    this._updateGlitch();

    // Global CRT flicker
    this._flickerAlpha = 0.90 + Math.random() * 0.10;
    ctx.globalAlpha = this._flickerAlpha;

    const cx = W / 2, cy = H / 2;

    // Scanlines (always)
    this._drawScanlines(ctx, W, H);

    // Crosshair
    if (this._phase !== 'IDLE') {
      this._drawCrosshair(ctx, cx, cy);
    }

    // Interaction hint
    if (this._hint) {
      this._crt(ctx, this._hint, cx, cy + 65, 24, '#33ff88', 'center');
    }

    // Production HUD
    if (this._phase === 'PRODUCTION') this._drawProductionHUD(ctx, W, H, cx);

    // Messages
    this._drawMessages(ctx, W, H, now);

    // Static noise
    this._drawStatic(ctx, W, H);

    // Glitch tear
    if (this._glitchBandY >= 0) this._drawGlitchTear(ctx, W);

    // CRT vignette
    this._drawVignette(ctx, W, H);

    ctx.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }

  /* ═══════════════════════════════════════════
   *  GLITCH STATE
   * ═══════════════════════════════════════════ */

  _updateGlitch() {
    this._glitchTimer -= 0.016;
    if (this._glitchTimer <= 0) {
      const glitchChance = this._phase === 'POLL' ? 0.25 : 0.04;
      const glitchScale = this._phase === 'POLL' ? 3.0 : 1.0;
      if (Math.random() < glitchChance) {
        this._glitchOffset = (Math.random() - 0.5) * 25 * glitchScale;
        this._glitchBandY = Math.random() * 1080;
        this._glitchBandH = (2 + Math.random() * 8) * glitchScale;
        this._glitchTimer = 0.04 + Math.random() * 0.08;
        this._staticIntensity = (0.04 + Math.random() * 0.06) * glitchScale;
      } else {
        this._glitchOffset = 0;
        this._glitchBandY = -1;
        this._glitchTimer = 0.12;
        this._staticIntensity = this._phase === 'POLL' ? 0.06 : 0.015;
      }
    }
  }

  /* ═══════════════════════════════════════════
   *  CRT EFFECTS
   * ═══════════════════════════════════════════ */

  _drawScanlines(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.003)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  _drawStatic(ctx, W, H) {
    if (this._staticIntensity < 0.005) return;
    ctx.save();
    ctx.globalAlpha = this._staticIntensity;
    const count = Math.floor(this._staticIntensity * 120);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const w = 1 + Math.random() * 5;
      const b = 80 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgb(${b},${b + 8},${b})`;
      ctx.fillRect(x, y, w, 1);
    }
    ctx.restore();
  }

  _drawGlitchTear(ctx, W) {
    ctx.save();
    const y = this._glitchBandY;
    const h = this._glitchBandH;
    // Shift band
    ctx.drawImage(this.canvas, 0, y, W, h, this._glitchOffset, y, W, h);
    // Chromatic aberration lines
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(0, y + h, W, 1);
    ctx.restore();
  }

  _drawVignette(ctx, W, H) {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.88);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.75, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ═══════════════════════════════════════════
   *  CROSSHAIR
   * ═══════════════════════════════════════════ */

  _drawCrosshair(ctx, cx, cy) {
    ctx.save();
    const pulse = 0.6 + Math.sin(this._time * 3) * 0.15;
    ctx.fillStyle = `rgba(51,255,102,${pulse})`;
    ctx.shadowColor = '#33ff66';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ═══════════════════════════════════════════
   *  TEXT HELPER (phosphor glow)
   * ═══════════════════════════════════════════ */

  _crt(ctx, text, x, y, size, color, align = 'left', bold = false) {
    ctx.save();
    ctx.font = `${bold ? 'bold ' : ''}${size}px 'Courier New','Lucida Console',monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    // Second glow pass
    ctx.shadowBlur = 5;
    ctx.globalAlpha *= 0.45;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ═══════════════════════════════════════════
   *  SEGMENTED LED BAR
   * ═══════════════════════════════════════════ */

  _ledBar(ctx, x, y, totalW, h, ratio, color, segments = 20) {
    const gap = 2;
    const segW = (totalW - (segments - 1) * gap) / segments;
    const filled = Math.round(ratio * segments);

    ctx.save();
    for (let i = 0; i < segments; i++) {
      const sx = x + i * (segW + gap);
      if (i < filled) {
        // Hotter color for the last few segments
        const heat = i / segments;
        ctx.fillStyle = heat > 0.8 ? _brighten(color, 1.3) : color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = _dim(color, 0.1);
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(sx, y, segW, h);
    }
    ctx.restore();
  }

  /* ═══════════════════════════════════════════
   *  PRODUCTION HUD
   * ═══════════════════════════════════════════ */

  _drawProductionHUD(ctx, W, H, cx) {
    ctx.save();

    // ── Timer ──
    const tStr = this._timer.toFixed(1);
    const tCol = this._timer < 10 ? '#ff3333' : this._timer < 30 ? '#ffaa22' : '#33ff66';

    // Panel
    ctx.fillStyle = 'rgba(0,4,0,0.45)';
    _rrFill(ctx, cx - 95, 14, 190, 58, 3);
    // Border
    ctx.strokeStyle = _dim(tCol, 0.25);
    ctx.lineWidth = 1;
    _rrStroke(ctx, cx - 95, 14, 190, 58, 3);

    // Timer blink when critical
    if (this._timer < 10 && Math.sin(this._time * 12) > 0.3) {
      ctx.globalAlpha *= 0.25;
    }
    this._crt(ctx, tStr + 's', cx, 18, 44, tCol, 'center', true);
    ctx.globalAlpha = this._flickerAlpha;

    // ── Round ──
    ctx.fillStyle = 'rgba(0,4,0,0.4)';
    _rrFill(ctx, 18, 14, 210, 38, 3);
    ctx.strokeStyle = 'rgba(51,170,102,0.2)';
    _rrStroke(ctx, 18, 14, 210, 38, 3);
    this._crt(ctx, `RND ${String(this._round).padStart(2, '0')}/15`, 28, 19, 24, '#33aa66', 'left', true);

    // ── Paste ──
    const [pC, pM] = this._paste;
    ctx.fillStyle = 'rgba(0,4,0,0.4)';
    _rrFill(ctx, 18, H - 98, 270, 60, 3);
    ctx.strokeStyle = 'rgba(180,180,40,0.18)';
    _rrStroke(ctx, 18, H - 98, 270, 60, 3);
    this._crt(ctx, `PATE  ${String(pC).padStart(3)}/${pM}`, 28, H - 94, 19, '#bbbb33', 'left');
    this._ledBar(ctx, 28, H - 65, 250, 12, pM > 0 ? pC / pM : 0, '#cccc33');

    // ── Score ──
    const [sc, qt] = this._score;
    const sCol = sc >= qt ? '#33ff66' : '#ffaa22';
    ctx.fillStyle = 'rgba(0,4,0,0.4)';
    _rrFill(ctx, cx - 145, H - 98, 290, 60, 3);
    ctx.strokeStyle = _dim(sCol, 0.18);
    _rrStroke(ctx, cx - 145, H - 98, 290, 60, 3);
    this._crt(ctx, `SCORE ${String(sc).padStart(4)}/${qt}`, cx, H - 94, 19, sCol, 'center');
    this._ledBar(ctx, cx - 125, H - 65, 250, 12, qt > 0 ? Math.min(1, sc / qt) : 0, sCol);

    // ── Streak / Fever ──
    if (this._fever?.active) {
      ctx.fillStyle = 'rgba(30,0,0,0.5)';
      _rrFill(ctx, W - 290, 14, 272, 38, 3);
      ctx.strokeStyle = 'rgba(255,50,50,0.3)';
      _rrStroke(ctx, W - 290, 14, 272, 38, 3);
      if (Math.sin(this._time * 10) > 0) {
        this._crt(ctx, `!! FEVER ${this._fever.remaining.toFixed(1)}s !!`, W - 280, 19, 22, '#ff3333', 'left', true);
      }
    } else if (this._streak > 0) {
      ctx.fillStyle = 'rgba(0,4,0,0.4)';
      _rrFill(ctx, W - 200, 14, 182, 38, 3);
      ctx.strokeStyle = 'rgba(51,170,102,0.2)';
      _rrStroke(ctx, W - 200, 14, 182, 38, 3);
      this._crt(ctx, `STREAK x${this._streak}`, W - 190, 19, 22, '#33aa66', 'left');
    }

    // ── Controls ──
    ctx.globalAlpha = 0.2;
    this._crt(ctx, '[ZQSD] MOVE  [CLICK] USE', W - 28, H - 28, 13, '#33ff66', 'right');
    ctx.globalAlpha = this._flickerAlpha;

    ctx.restore();
  }

  /* ═══════════════════════════════════════════
   *  MESSAGES
   * ═══════════════════════════════════════════ */

  _drawMessages(ctx, W, H, now) {
    const active = this._messages.filter(m => now - m.time < 4000);
    if (!active.length) return;

    ctx.save();
    for (let i = 0; i < active.length; i++) {
      const m = active[i];
      const age = (now - m.time) / 4000;
      ctx.globalAlpha = (1 - age * age) * this._flickerAlpha;

      // Text corruption as it fades
      let text = m.text;
      if (age > 0.6) {
        const corruption = (age - 0.6) / 0.4; // 0→1
        const chars = text.split('');
        const corruptions = Math.floor(corruption * chars.length * 0.4);
        for (let c = 0; c < corruptions; c++) {
          const ci = Math.floor(Math.random() * chars.length);
          chars[ci] = _glitchChar();
        }
        text = chars.join('');
      }

      this._crt(ctx, text, W - 28, H - 135 - i * 28, 18, '#33cc55', 'right');
    }
    ctx.restore();
  }
}

/* ── Helpers ── */

function _rrFill(ctx, x, y, w, h, r) {
  if (w <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function _rrStroke(ctx, x, y, w, h, r) {
  if (w <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

/** Brighten a hex color string. */
function _brighten(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, Math.floor(r * factor))},${Math.min(255, Math.floor(g * factor))},${Math.min(255, Math.floor(b * factor))})`;
}

/** Dim a hex color to low alpha. */
function _dim(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Random glitch character. */
const _GLITCH_CHARS = '░▒▓█▌▐▀▄▊▋▍▎▏┃━┅┇╋╳⌐¬¡¿';
function _glitchChar() {
  return _GLITCH_CHARS[Math.floor(Math.random() * _GLITCH_CHARS.length)];
}
