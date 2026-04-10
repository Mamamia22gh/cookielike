import * as THREE from 'three';

/**
 * Full-screen HUD rendered as a THREE.js ortho overlay.
 * Uses an off-DOM canvas as texture — zero HTML elements.
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

  render() {
    const ctx = this.ctx;
    const W = 1920, H = 1080;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;

    // ── Crosshair ──
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── Interaction hint ──
    if (this._hint) {
      ctx.save();
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
      ctx.fillText(this._hint, cx, cy + 60);
      ctx.restore();
    }

    // ── Phase-specific HUD ──
    if (this._phase === 'PRODUCTION') this._drawProductionHUD(ctx, W, H, cx);

    // ── Messages (always visible) ──
    const now = Date.now();
    const active = this._messages.filter(m => now - m.time < 4000);
    if (active.length) {
      ctx.save();
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'right';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      for (let i = 0; i < active.length; i++) {
        const m = active[i];
        const age = (now - m.time) / 4000;
        ctx.globalAlpha = 1 - age * age;
        ctx.fillStyle = '#ddd';
        ctx.fillText(m.text, W - 30, H - 100 - i * 30);
      }
      ctx.restore();
    }

    this.texture.needsUpdate = true;
  }

  _drawProductionHUD(ctx, W, H, cx) {
    ctx.save();
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;

    // Timer
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this._timer < 10 ? '#ef4444' : this._timer < 30 ? '#eab308' : '#eee';
    ctx.fillText(`${this._timer.toFixed(1)}s`, cx, 65);

    // Round
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'left';
    ctx.fillText(`Round ${this._round}/15`, 30, 40);

    // Paste
    const [pC, pM] = this._paste;
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`🧈 Pâte ${pC}/${pM}`, 30, H - 75);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    _rrFill(ctx, 30, H - 58, 220, 14, 7);
    ctx.fillStyle = '#ffd700';
    _rrFill(ctx, 30, H - 58, 220 * (pM > 0 ? pC / pM : 0), 14, 7);

    // Score
    const [sc, qt] = this._score;
    ctx.textAlign = 'center';
    ctx.fillStyle = sc >= qt ? '#22c55e' : '#eab308';
    ctx.fillText(`🎯 ${sc} / ${qt} 🪙`, cx, H - 75);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    _rrFill(ctx, cx - 110, H - 58, 220, 14, 7);
    ctx.fillStyle = sc >= qt ? '#22c55e' : '#eab308';
    _rrFill(ctx, cx - 110, H - 58, 220 * Math.min(1, qt > 0 ? sc / qt : 0), 14, 7);

    // Streak / Fever
    ctx.textAlign = 'right';
    if (this._fever?.active) {
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`🔥 FEVER ${this._fever.remaining.toFixed(1)}s`, W - 30, 40);
    } else if (this._streak > 0) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`🥁 ×${this._streak}`, W - 30, 40);
    }

    // Controls
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(170,170,170,0.5)';
    ctx.fillText('[ZQSD] Bouger   [Click] Interagir', W - 20, H - 15);

    ctx.restore();
  }
}

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
