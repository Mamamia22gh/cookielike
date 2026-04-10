import * as THREE from 'three';

/**
 * Create a sprite with rendered text (canvas texture).
 * Used for all in-world text: labels, stats, titles.
 */
export function createTextSprite(text, {
  fontSize = 48,
  fontFamily = 'bold sans-serif',
  color = '#ffd700',
  bgColor = null,
  bgAlpha = 0,
  padding = 16,
  maxWidth = 1024,
  align = 'center',
  borderRadius = 0,
  borderColor = null,
  borderWidth = 0,
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;

  const lines = text.split('\n');
  const lineMetrics = lines.map(l => ctx.measureText(l));
  const textW = Math.min(maxWidth, Math.max(...lineMetrics.map(m => m.width)));
  const lineH = fontSize * 1.3;
  const textH = lineH * lines.length;

  canvas.width = Math.ceil(textW + padding * 2);
  canvas.height = Math.ceil(textH + padding * 2);

  // BG
  if (bgColor || bgAlpha > 0) {
    ctx.fillStyle = bgColor || `rgba(0,0,0,${bgAlpha})`;
    if (borderRadius > 0) {
      roundRect(ctx, 0, 0, canvas.width, canvas.height, borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Border
  if (borderColor && borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    if (borderRadius > 0) {
      roundRect(ctx, borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth, borderRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth);
    }
  }

  // Text
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const x = align === 'center' ? canvas.width / 2 : align === 'right' ? canvas.width - padding : padding;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, padding + i * lineH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);

  const aspect = canvas.width / canvas.height;
  const scale = (textH + padding * 2) / 200;
  sprite.scale.set(scale * aspect, scale, 1);

  sprite._canvas = canvas;
  sprite._ctx = ctx;
  sprite._tex = tex;

  return sprite;
}

/**
 * Create a 3D plane with text (for non-billboard text).
 */
export function createTextPlane(text, {
  fontSize = 64,
  fontFamily = 'bold sans-serif',
  color = '#ffd700',
  bgColor = 'rgba(15,15,35,0.9)',
  padding = 24,
  width = 512,
  height = 128,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineH = fontSize * 1.3;
  const startY = height / 2 - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(width / 100, height / 100);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);

  mesh._canvas = canvas;
  mesh._ctx = ctx;
  mesh._tex = tex;

  return mesh;
}

/**
 * Update text on an existing sprite or plane.
 */
export function updateText(obj, text, {
  fontSize = 48,
  fontFamily = 'bold sans-serif',
  color = '#ffd700',
  bgColor = null,
  bgAlpha = 0,
  padding = 16,
  align = 'center',
} = {}) {
  const canvas = obj._canvas;
  const ctx = obj._ctx;
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgColor || bgAlpha > 0) {
    ctx.fillStyle = bgColor || `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const x = align === 'center' ? canvas.width / 2 : padding;

  const lines = text.split('\n');
  const lineH = fontSize * 1.3;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, padding + i * lineH);
  }

  obj._tex.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
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
}
