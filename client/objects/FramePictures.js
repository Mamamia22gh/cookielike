import * as THREE from 'three';
import { createMaterial } from '../utils/Materials.js';

/**
 * Creepy pixelated framed pictures on the walls.
 * Loaded from /textures/ folder.
 */

const FRAMES = [
  // { file, pos [x,y,z], rotY, scale [w,h] }
  { file: 'textures/frame_portrait2.jpg', pos: [-2.5, 1.6, -4.98], rotY: 0,            size: [0.7, 0.9] },
  { file: 'textures/frame_skeleton.jpg',  pos: [ 2.2, 1.8, -4.98], rotY: 0,            size: [0.8, 0.6] },
  { file: 'textures/frame_portrait2.jpg', pos: [-4.98, 1.5, -1.0], rotY: Math.PI / 2,  size: [0.6, 0.8] },
  { file: 'textures/frame_skeleton.jpg',  pos: [ 4.98, 1.7,  1.5], rotY: -Math.PI / 2, size: [0.7, 0.5] },
];

function makePixelatedTexture(url) {
  const tex = new THREE.TextureLoader().load(url);
  // Nearest filter = pixelated / low-fi look
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFrameMesh(file, size) {
  const [w, h] = size;
  const group = new THREE.Group();

  // Picture itself
  const tex = makePixelatedTexture(file);
  const picMat = new THREE.MeshBasicMaterial({ map: tex });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), picMat);
  group.add(pic);

  // Wooden frame border
  const frameMat = createMaterial(0x3a2a1a, 0.8, 0.05);
  const bw = 0.04; // border width
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

export function buildFramePictures(scene) {
  for (const f of FRAMES) {
    const mesh = makeFrameMesh(f.file, f.size);
    mesh.position.set(...f.pos);
    mesh.rotation.y = f.rotY;
    // Push slightly off wall
    const offset = 0.02;
    if (f.rotY === 0)              mesh.position.z += offset;
    else if (f.rotY > 0)           mesh.position.x += offset;
    else if (f.rotY < 0)           mesh.position.x -= offset;
    scene.add(mesh);
  }
}
