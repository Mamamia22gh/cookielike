import * as THREE from 'three';
import { PALETTE, createMaterial } from '../utils/Materials.js';
import { createTextPlane } from '../utils/TextSprite.js';
import { makeParquetTexture, makeWallTexture, makeCeilingTexture } from '../utils/ProceduralTextures.js';
import { buildFramePictures } from './FramePictures.js';

export class FactoryBuilding {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FactoryBuilding';
    this._build();
    this._buildHiddenWritings();
  }

  _buildHiddenWritings() {
    // Hidden writings removed as requested
  }

  _build() {
    const R = 5;
    const H = 3.2;

    // ── Parquet floor ──
    const floorTex = makeParquetTexture(512);
    const parquetMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), parquetMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Parquet plank lines (horizontal wood grain, Z direction)
    const plankMat = createMaterial(0x7a5c10, 0.8, 0.02);
    for (let z = -R; z <= R; z += 0.25) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.003, 0.015), plankMat);
      line.position.set(0, 0.002, z);
      this.group.add(line);
    }
    // Perpendicular shorter joints (offset every plank)
    const jointMat = createMaterial(0x6a4c0e, 0.8, 0.02);
    for (let x = -R; x <= R; x += 1.2) {
      for (let z = -R; z <= R; z += 0.5) {
        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.003, 0.25), jointMat);
        joint.position.set(x + (z % 1.0) * 0.3, 0.002, z);
        this.group.add(joint);
      }
    }

    // ── Walls (textured plaster) ──
    const wallTex = makeWallTexture(512);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, metalness: 0.02 });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(R * 2, H, 0.15), wallMat);
    backWall.position.set(0, H / 2, -R);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(R * 2, H, 0.15), wallMat);
    frontWall.position.set(0, H / 2, R);
    frontWall.receiveShadow = true;
    this.group.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, H, R * 2), wallMat);
    leftWall.position.set(-R, H / 2, 0);
    leftWall.receiveShadow = true;
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, H, R * 2), wallMat);
    rightWall.position.set(R, H / 2, 0);
    rightWall.receiveShadow = true;
    this.group.add(rightWall);

    // ── Ceiling ──
    const ceilTex = makeCeilingTexture(512);
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.85, metalness: 0.02 });

    // Two ceiling halves with a gap for the skylight
    const skylightW = 2.0, skylightD = 2.0;
    const ceilHalfZ = (R * 2 - skylightD) / 2;

    // North half
    const ceilN = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, ceilHalfZ), ceilMat);
    ceilN.rotation.x = Math.PI / 2;
    ceilN.position.set(0, H, -(skylightD / 2 + ceilHalfZ / 2));
    this.group.add(ceilN);

    // South half
    const ceilS = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, ceilHalfZ), ceilMat);
    ceilS.rotation.x = Math.PI / 2;
    ceilS.position.set(0, H, skylightD / 2 + ceilHalfZ / 2);
    this.group.add(ceilS);

    // Side strips (east/west of skylight)
    const sideStripW = (R * 2 - skylightW) / 2;
    const ceilE = new THREE.Mesh(new THREE.PlaneGeometry(sideStripW, skylightD), ceilMat);
    ceilE.rotation.x = Math.PI / 2;
    ceilE.position.set(skylightW / 2 + sideStripW / 2, H, 0);
    this.group.add(ceilE);

    const ceilW = new THREE.Mesh(new THREE.PlaneGeometry(sideStripW, skylightD), ceilMat);
    ceilW.rotation.x = Math.PI / 2;
    ceilW.position.set(-(skylightW / 2 + sideStripW / 2), H, 0);
    this.group.add(ceilW);

    // Skylight glass (semi-transparent, dirty)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      transparent: true,
      opacity: 0.25,
      roughness: 0.15,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(skylightW, skylightD), glassMat);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, H - 0.01, 0);
    this.group.add(glass);

    // Skylight frame (metal border)
    const frameMat = createMaterial(0x3a3a44, 0.4, 0.7);
    const frameH = 0.06;
    // North/South frame bars
    for (const dz of [-skylightD / 2, skylightD / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(skylightW + 0.1, frameH, 0.06), frameMat);
      bar.position.set(0, H - frameH / 2, dz);
      this.group.add(bar);
    }
    // East/West frame bars
    for (const dx of [-skylightW / 2, skylightW / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, frameH, skylightD + 0.1), frameMat);
      bar.position.set(dx, H - frameH / 2, 0);
      this.group.add(bar);
    }
    // Cross bars
    const crossBar1 = new THREE.Mesh(new THREE.BoxGeometry(skylightW, frameH * 0.6, 0.03), frameMat);
    crossBar1.position.set(0, H - frameH / 2, 0);
    this.group.add(crossBar1);
    const crossBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, frameH * 0.6, skylightD), frameMat);
    crossBar2.position.set(0, H - frameH / 2, 0);
    this.group.add(crossBar2);

    // ── Baseboard ──
    const baseMat = createMaterial(0x5a5448, 0.7, 0.05);
    for (const z of [-R + 0.04, R - 0.04]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(R * 2 - 0.3, 0.1, 0.06), baseMat);
      trim.position.set(0, 0.05, z);
      this.group.add(trim);
    }
    for (const x of [-R + 0.04, R - 0.04]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, R * 2 - 0.3), baseMat);
      trim.position.set(x, 0.05, 0);
      this.group.add(trim);
    }

    // ── Exposed wires along ceiling ──

    // ── Post-its (Clusters on walls) ──
    const postitColors = [0xffeb3b, 0xff99cc, 0xccff90, 0x80deea, 0xffb74d];
    const postitMats = postitColors.map(c => createMaterial(c, 0.9, 0.1));
    const lineMat = createMaterial(0x444444, 0.8, 0.1);
    
    const postitGeo = new THREE.BoxGeometry(0.076, 0.076, 0.002);
    const lineGeo = new THREE.BoxGeometry(0.05, 0.003, 0.004);

    const clusters = [
      { basePos: [-1.5, 1.3, -R + 0.08], rotY: 0, spread: 0.5 },
      { basePos: [2.5, 1.1, -R + 0.08], rotY: 0, spread: 0.4 },
      { basePos: [-R + 0.08, 1.6, -1.5], rotY: Math.PI / 2, spread: 0.6 },
      { basePos: [R - 0.08, 1.2, 1.5], rotY: -Math.PI / 2, spread: 0.5 },
      { basePos: [0.5, 1.5, -R + 0.08], rotY: 0, spread: 0.4 },
    ];

    for (const cluster of clusters) {
      const numPostits = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numPostits; i++) {
        const mat = postitMats[Math.floor(Math.random() * postitMats.length)];
        const postit = new THREE.Mesh(postitGeo, mat);

        const offsetX = (Math.random() - 0.5) * cluster.spread;
        const offsetY = (Math.random() - 0.5) * cluster.spread;
        
        let px = cluster.basePos[0];
        let py = cluster.basePos[1] + offsetY;
        let pz = cluster.basePos[2];

        if (cluster.rotY !== 0) {
          pz += offsetX;
        } else {
          px += offsetX;
        }

        // Prevent Z-fighting
        const popOut = i * 0.001;
        if (cluster.rotY === 0) pz += popOut;
        else if (cluster.rotY === Math.PI / 2) px += popOut;
        else if (cluster.rotY === -Math.PI / 2) px -= popOut;

        postit.position.set(px, py, pz);
        postit.rotation.y = cluster.rotY;
        postit.rotateZ((Math.random() - 0.5) * 0.4);

        // Fake text lines
        const numLines = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < numLines; j++) {
          const line = new THREE.Mesh(lineGeo, lineMat);
          line.position.set(
            (Math.random() - 0.5) * 0.01, 
            0.02 - j * 0.012, 
            0.001
          );
          line.scale.x = 0.5 + Math.random() * 0.5;
          postit.add(line);
        }

        this.group.add(postit);
      }
    }

    // ── Creepy framed pictures on walls ──
    buildFramePictures(this.group);
  }
}
