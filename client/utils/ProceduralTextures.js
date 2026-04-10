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
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Ceiling ──────────────────────────────────────────────────────────
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
