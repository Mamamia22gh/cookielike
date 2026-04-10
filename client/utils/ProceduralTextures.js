import * as THREE from 'three';

/**
 * Procedural canvas-based textures for walls, floor, ceiling.
 * No external files needed. Seeded pseudo-random for consistency.
 */

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// ── Wood parquet floor ──────────────────────────────────────────────
export function makeParquetTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(42);

  // Base warm brown
  ctx.fillStyle = '#7a5c18';
  ctx.fillRect(0, 0, size, size);

  const plankH = Math.floor(size / 14);
  const plankW = Math.floor(size / 3);

  for (let row = 0; row < 20; row++) {
    const offset = (row % 2) * plankW;
    for (let col = -1; col < 5; col++) {
      const x = col * plankW - offset;
      const y = row * plankH;
      const shade = 0.78 + r() * 0.24;
      const hue = 30 + r() * 12;
      ctx.fillStyle = `hsl(${hue}, 55%, ${Math.floor(shade * 38)}%)`;
      ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

      // Wood grain lines
      ctx.strokeStyle = `hsla(${hue - 5}, 45%, 20%, 0.15)`;
      ctx.lineWidth = 0.5;
      for (let g = 0; g < 6; g++) {
        const gx = x + r() * plankW;
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx + (r() - 0.5) * 8, y + plankH);
        ctx.stroke();
      }

      // Gap (dark line)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y, 1, plankH);
      ctx.fillRect(x, y, plankW, 1);
    }
  }

  // Subtle dirt/worn overlay
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(r() * size, r() * size, 2 + r() * 4, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Plaster wall ─────────────────────────────────────────────────────
export function makeWallTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(77);

  // Base yellowish plaster
  ctx.fillStyle = '#9a9280';
  ctx.fillRect(0, 0, size, size);

  // Noise grain
  for (let i = 0; i < size * size * 0.6; i++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const v = Math.floor(r() * 30 - 15);
    const base = 155 + v;
    ctx.fillStyle = `rgb(${base - 8},${base - 5},${base - 12})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Stain patches
  for (let i = 0; i < 12; i++) {
    const x = r() * size, y = r() * size;
    const rad = 20 + r() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(80,70,50,${0.04 + r() * 0.06})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Hairline cracks
  ctx.strokeStyle = 'rgba(60,50,40,0.2)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let cx = r() * size, cy = r() * size;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (r() - 0.5) * 40;
      cy += (r() - 0.5) * 40;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Worn workshop countertop ──────────────────────────────────────────
export function makeCountertopTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(99);

  // Dark oiled wood base
  ctx.fillStyle = '#4a3a28';
  ctx.fillRect(0, 0, size, size);

  // Long horizontal planks
  const plankH = Math.floor(size / 4);
  for (let row = 0; row < 6; row++) {
    const y = row * plankH;
    const shade = 0.82 + r() * 0.18;
    const hue = 24 + r() * 10;
    ctx.fillStyle = `hsl(${hue}, 40%, ${Math.floor(shade * 28)}%)`;
    ctx.fillRect(0, y + 1, size, plankH - 2);

    // Wood grain — long horizontal streaks
    ctx.strokeStyle = `hsla(${hue - 5}, 35%, 18%, 0.12)`;
    ctx.lineWidth = 0.8;
    for (let g = 0; g < 12; g++) {
      const gy = y + r() * plankH;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let s = 0; s < 8; s++) {
        ctx.lineTo(s * (size / 8) + r() * 20, gy + (r() - 0.5) * 4);
      }
      ctx.stroke();
    }

    // Gap between planks
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, y, size, 1);
  }

  // Knife cuts / scratches
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 25; i++) {
    const cx = r() * size, cy = r() * size;
    const len = 5 + r() * 25;
    const angle = r() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Flour dust spots (faint white circles)
  for (let i = 0; i < 15; i++) {
    const fx = r() * size, fy = r() * size;
    const fr = 8 + r() * 30;
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    grad.addColorStop(0, `rgba(240,230,210,${0.06 + r() * 0.06})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
  }

  // Oil/grease stains (warm dark patches)
  for (let i = 0; i < 8; i++) {
    const sx = r() * size, sy = r() * size;
    const sr = 10 + r() * 25;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, `rgba(50,35,15,${0.08 + r() * 0.08})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Metro tile backsplash ────────────────────────────────────────────
export function makeMetroTileTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(55);

  // Grout base (dark grey)
  ctx.fillStyle = '#6a6a62';
  ctx.fillRect(0, 0, size, size);

  // Metro tiles (brick pattern, offset rows)
  const tileW = Math.floor(size / 6);
  const tileH = Math.floor(size / 8);
  const grout = 3;

  for (let row = 0; row < 12; row++) {
    const offset = (row % 2) * (tileW / 2);
    for (let col = -1; col < 8; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;

      // Slightly varied cream/white — aged
      const lum = 55 + r() * 10;
      const sat = 5 + r() * 12;
      const hue = 40 + r() * 15;
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);

      // Subtle glaze highlight (top-left)
      const hlGrad = ctx.createLinearGradient(x + grout, y + grout, x + tileW, y + tileH);
      hlGrad.addColorStop(0, `rgba(255,255,255,${0.04 + r() * 0.04})`);
      hlGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
      hlGrad.addColorStop(1, `rgba(0,0,0,${0.02 + r() * 0.02})`);
      ctx.fillStyle = hlGrad;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);
    }
  }

  // Grime in grout lines
  ctx.fillStyle = 'rgba(60,50,30,0.15)';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1);
  }

  // A few cracked tiles
  ctx.strokeStyle = 'rgba(100,90,70,0.25)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    let cx = r() * size, cy = r() * size;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 3; s++) {
      cx += (r() - 0.5) * 30;
      cy += (r() - 0.5) * 20;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Yellowish aged patina overlay
  const patina = ctx.createRadialGradient(size * 0.5, size * 0.7, 20, size * 0.5, size * 0.7, size * 0.6);
  patina.addColorStop(0, 'rgba(120,100,50,0.06)');
  patina.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = patina;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Oxidized metal pipe ──────────────────────────────────────────────
export function makeOxidizedMetalTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(31);

  // Base gunmetal
  ctx.fillStyle = '#5a5a64';
  ctx.fillRect(0, 0, size, size);

  // Fine metallic grain
  for (let i = 0; i < size * size * 0.5; i++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const v = Math.floor(r() * 20 - 10);
    ctx.fillStyle = `rgb(${90 + v},${90 + v},${100 + v})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Rust patches (warm orange-brown spots)
  for (let i = 0; i < 10; i++) {
    const rx = r() * size, ry = r() * size;
    const rr = 8 + r() * 25;
    const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
    grad.addColorStop(0, `rgba(140,70,20,${0.15 + r() * 0.15})`);
    grad.addColorStop(0.6, `rgba(100,55,15,${0.06 + r() * 0.06})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
  }

  // Condensation streaks (vertical dark lines)
  ctx.strokeStyle = 'rgba(40,40,50,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const sx = r() * size;
    ctx.beginPath();
    ctx.moveTo(sx, r() * size * 0.3);
    ctx.lineTo(sx + (r() - 0.5) * 6, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function makeCeilingTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = rng(13);

  ctx.fillStyle = '#7a7468';
  ctx.fillRect(0, 0, size, size);

  // Lighter tile grid
  const tile = Math.floor(size / 6);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const shade = 0.9 + r() * 0.1;
      ctx.fillStyle = `rgba(200,195,185,${0.06 * shade})`;
      ctx.fillRect(col * tile + 1, row * tile + 1, tile - 2, tile - 2);
    }
  }

  // Noise
  for (let i = 0; i < size * size * 0.3; i++) {
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    const v = Math.floor(r() * 20 - 10);
    ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Water stain ring
  const grad = ctx.createRadialGradient(size * 0.6, size * 0.3, 10, size * 0.6, size * 0.3, 80);
  grad.addColorStop(0, 'rgba(100,85,60,0.12)');
  grad.addColorStop(0.7, 'rgba(100,85,60,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
