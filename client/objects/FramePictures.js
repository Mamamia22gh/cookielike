import * as THREE from 'three';
import { createMaterial } from '../utils/Materials.js';

/**
 * Creepy framed pictures on the walls.
 * Loads real images from /textures/.
 */

const loader = new THREE.TextureLoader();

function loadTexture(path) {
  const tex = loader.load(path, (t) => {
    // Downscale to pixelate
    const img = t.image;
    const small = document.createElement('canvas');
    const px = 48;
    small.width = px;
    small.height = px;
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0, px, px);
    t.image = small;
    t.needsUpdate = true;
  });
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// R=5, walls are BoxGeometry(thick=0.15) at ±R → inner face at ±4.925
const W = 4.90; // just in front of inner wall face
const FRAMES = [
  // North wall — above radio
  { path: '/textures/frame_chef.webp',      pos: [-1.0, 2.0, -W], rotY: 0,            size: [0.5, 0.65] },
  // North wall — right side
  { path: '/textures/frame_skeleton.jpg',    pos: [ 3.5, 1.9, -W], rotY: 0,            size: [0.55, 0.45] },
  // East wall
  { path: '/textures/frame_portrait2.jpg',   pos: [ W, 1.6, -1.0], rotY: -Math.PI / 2, size: [0.5, 0.6] },
];

function makeFrameMesh(path, size) {
  const [w, h] = size;
  const group = new THREE.Group();

  // Picture itself — standard material so it reacts to room lighting
  const tex = loadTexture(path);
  const picMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat);
  group.add(pic);

  // Wooden frame border
  const frameMat = createMaterial(0x3a2a1a, 0.8, 0.05);
  const bw = 0.04;
  // Top / bottom
  for (const dy of [h / 2 + bw / 2, -h / 2 - bw / 2]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bw, 0.03), frameMat);
    b.position.set(0, dy, -0.01);
    group.add(b);
  }
  // Left / right
  for (const dx of [-w / 2 - bw / 2, w / 2 + bw / 2]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h + bw * 2, 0.03), frameMat);
    b.position.set(dx, 0, -0.01);
    group.add(b);
  }

  // Nail on top
  const nailMat = createMaterial(0x888888, 0.3, 0.9);
  const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), nailMat);
  nail.position.set(0, h / 2 + bw + 0.03, 0.01);
  group.add(nail);

  return group;
}

export function buildFramePictures(parent) {
  for (const f of FRAMES) {
    const mesh = makeFrameMesh(f.path, f.size);
    mesh.position.set(...f.pos);
    mesh.rotation.y = f.rotY;
    parent.add(mesh);
  }
}
