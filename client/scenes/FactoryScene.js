import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ProductionLine } from '../objects/ProductionLine.js';
import { FactoryBuilding } from '../objects/FactoryBuilding.js';
import { ChoicePedestals } from '../objects/ChoicePedestal.js';
import { ShopCounter } from '../objects/ShopCounter.js';
import { CRTTerminal } from '../objects/CRTTerminal.js';
import { CookieModel } from '../objects/CookieModel.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { FloatingTextSystem } from '../effects/FloatingText.js';
import { AirVent } from '../objects/AirVent.js';
import { FluorescentLight } from '../objects/FluorescentLight.js';
import { AmbientHorror } from '../objects/AmbientHorror.js';
import { CosmicHorror } from '../objects/CosmicHorror.js';
import { RadioPlayer } from '../objects/RadioPlayer.js';
import { PALETTE, createMaterial } from '../utils/Materials.js';
import { makeCountertopTexture, makeMetroTileTexture, makeOxidizedMetalTexture } from '../utils/ProceduralTextures.js';

export class FactoryScene {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.008);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(-0.5, 1.7, -0.8);
    this.camera.lookAt(-0.5, 1.7, -5);

    this.controls = new PointerLockControls(this.camera, renderer.domElement);

    this._moveForward = false;
    this._moveBackward = false;
    this._moveLeft = false;
    this._moveRight = false;
    this._velocity = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._speed = 4;

    // Player collision radius
    this._playerRadius = 0.3;

    // AABB collision boxes (XZ plane): { minX, maxX, minZ, maxZ }
    this._colliders = [
      // Desk (north wall)
      { minX: -1.9, maxX: 1.9, minZ: -4.7, maxZ: -2.55 },
      // Workbench + machines (south strip)
      { minX: -4.7, maxX: 4.7, minZ: 2.7, maxZ: 4.7 },
      // Shop shelf (west wall)
      { minX: -4.7, maxX: -3.5, minZ: -0.8, maxZ: 1.8 },
    ];

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 50;
    this._center = new THREE.Vector2(0, 0);

    this._setupLights();

    // No separate floor — FactoryBuilding provides the parquet
    this.building = new FactoryBuilding();
    this.scene.add(this.building.group);

    /*
     * ── LAYOUT: U-shaped workshop (R=5) ──
     *
     *          NORTH wall (z=-5)
     *       [Desk: CRT + Radio]
     *
     *  WEST wall (x=-5)          EAST wall (x=5)
     *  [Shop étagère]            [BoxStation]
     *
     *          SOUTH wall (z=+5)
     *  [Pâte+Slot] ══ bench ══ [Four+Écran]
     *           [AirVent]
     */

    // ── NORTH: Desk against back wall ──
    this._buildDesk();

    // CRT Terminal on the desk
    this.terminal = new CRTTerminal();
    this.terminal.group.position.set(0.9, 0.86, -3.9);
    this.terminal.group.rotation.y = -Math.PI / 6; // Angled left towards center
    this.terminal.group.scale.setScalar(0.75);
    this.scene.add(this.terminal.group);

    // Radio on the desk (left side)
    this.radio = new RadioPlayer(this._dummyListener());
    this.radio.group.position.set(-1.0, 0.86, -3.7);
    this.radio.group.rotation.y = Math.PI / 5; // Angled right towards center
    this.radio.group.scale.setScalar(0.85);
    this.scene.add(this.radio.group);

    // ── SOUTH: Industrial workbench + production line ──
    this.productionLine = new ProductionLine();
    this.scene.add(this.productionLine.group);

    // Provide legacy references for GameBridge compatibility
    this.slotMachine = this.productionLine.slotMachine;
    this.doughProvider = this.productionLine.doughProvider;
    this.ovens = this.productionLine.ovens;
    this.ovenScreens = this.productionLine.ovenScreens;
    this.boxStation = this.productionLine.boxStation;

    this._floorBoxes = [];

    // ── WEST: Shop étagère ──
    this.shopCounter = new ShopCounter();
    this.shopCounter.group.position.set(-4.3, 0, 0.5);
    this.shopCounter.group.rotation.y = Math.PI / 2;
    this.shopCounter.group.scale.setScalar(0.85);
    this.scene.add(this.shopCounter.group);

    // ── EAST: Nothing (Box station is now on the production line) ──

    // ── CENTER: Choice pedestals ──
    this.choicePedestals = new ChoicePedestals();
    this.choicePedestals.group.position.set(0, 0, 1.5);
    this.choicePedestals.group.scale.setScalar(0.7);
    this.scene.add(this.choicePedestals.group);

    // ── Effects ──
    this.particles = new ParticleSystem(this.scene);
    this.floatingText = new FloatingTextSystem(this.scene);

    this._phase = 'IDLE';
    this._feverMode = false;
    this._feverLight = null;
    this._pendingBoxData = null;
    this._transfers = [];
    this._showcaseQueue = [];   // cookies waiting to be showcased
    this._showcaseActive = null; // currently showcased cookie

    // ── Audio listener ──
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.radio._listener = this.listener;

    // ── Air vent (East wall) ──
    this.airVents = [];
    const vent = new AirVent(this.listener);
    vent.group.position.set(4.95, 2.5, 2.5);
    vent.group.rotation.set(0, -Math.PI / 2, 0);
    vent.group.scale.setScalar(0.6);
    this.scene.add(vent.group);
    this.airVents.push(vent);

    // Overhead LED bar (attached to the utility pipe of the workbench)
    this.overheadLights = [];
    const ledBar = new FluorescentLight(this.listener, 9.0);
    ledBar.group.position.set(0, 2.25, 4.82); // Just below the pipe
    this.scene.add(ledBar.group);
    this.overheadLights.push(ledBar);

    // Ambient horror (room-wide flicker + distant oppressive sounds)
    this.ambientHorror = new AmbientHorror(this.listener);
    this.ambientHorror.setLights(this._centralLight, this._ambientLight, this.overheadLights);
    this.ambientHorror.group.position.set(0, 1.95, 0);
    this.scene.add(this.ambientHorror.group);

    // Cosmic horror entity above the skylight
    this.cosmicHorror = new CosmicHorror();
    this.cosmicHorror.group.position.set(0, 35, 0); // Far above ceiling
    this.cosmicHorror.group.rotation.x = Math.PI / 2; // Face down
    this.cosmicHorror.group.scale.setScalar(2.5);
    this.scene.add(this.cosmicHorror.group);
  }

  /** Temporary listener before the real one is created. */
  _dummyListener() {
    return new THREE.AudioListener();
  }

  /** Build a desk against the north wall. */
  _buildDesk() {
    const deskGrp = new THREE.Group();
    deskGrp.name = 'Desk';

    const woodMat = createMaterial(0x6a5030, 0.65, 0.05);

    // Tabletop (reduced depth on camera side by 15%)
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 1.7), woodMat);
    top.position.set(0, 0.84, -0.15);
    top.castShadow = true;
    top.receiveShadow = true;
    deskGrp.add(top);

    // Legs
    const legMat = createMaterial(0x5a4428, 0.7, 0.05);
    for (const x of [-1.65, 1.65]) {
      for (const z of [-0.9, 0.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.84, 0.06), legMat);
        leg.position.set(x, 0.42, z);
        leg.castShadow = true;
        deskGrp.add(leg);
      }
    }

    // Drawers unit under desk (right side)
    const drawerUnitMat = createMaterial(0x5a4428, 0.7, 0.05);
    const drawerUnit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.4), drawerUnitMat);
    drawerUnit.position.set(1.2, 0.42, -0.1);
    drawerUnit.castShadow = true;
    deskGrp.add(drawerUnit);
    // Drawer handles
    const drawerHandleMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    for (let dy = 0; dy < 3; dy++) {
      const dHandle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.04), drawerHandleMat);
      dHandle.position.set(1.2, 0.2 + dy * 0.22, 0.62);
      deskGrp.add(dHandle);
    }

    // Caisson (small box on the desk, between radio and PC)
    const drawerMat = createMaterial(0x5a4428, 0.7, 0.05);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), drawerMat);
    drawer.position.set(-0.1, 0.99, -0.5);
    drawer.castShadow = true;
    deskGrp.add(drawer);

    // Caisson handles
    const handleMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    for (let dy = 0; dy < 2; dy++) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.04), handleMat);
      handle.position.set(-0.1, 0.92 + dy * 0.1, -0.28);
      deskGrp.add(handle);
    }

    // Coffee mug
    const mugMat = createMaterial(0xddddcc, 0.5, 0.1);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8), mugMat);
    mug.position.set(0.1, 0.92, 0.3);
    deskGrp.add(mug);

    // Stack of papers (left side of desk)
    const paperMat = createMaterial(0xeeeeee, 0.9, 0.0);
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), paperMat);
    papers.position.set(-0.6, 0.89, 0.3);
    papers.rotation.y = -0.2;
    deskGrp.add(papers);

    // Desk lamp (left side)
    const lampBaseMat = createMaterial(0x333333, 0.4, 0.6);
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 8), lampBaseMat);
    lampBase.position.set(-1.4, 0.88, -0.1);
    deskGrp.add(lampBase);

    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), lampBaseMat);
    lampArm.position.set(-1.4, 1.13, -0.15);
    lampArm.rotation.z = 0.15;
    deskGrp.add(lampArm);

    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.08, 8, 1, true),
      createMaterial(0x44aa44, 0.5, 0.1),
    );
    lampShade.position.set(-1.38, 1.38, -0.18);
    deskGrp.add(lampShade);

    // Post-its on the wall & one on the desk
    const postitColors = [0xffeb3b, 0xff99cc, 0xccff90, 0x80deea, 0xffb74d];
    const postitGeo = new THREE.BoxGeometry(0.08, 0.002, 0.08);
    const lineGeo = new THREE.BoxGeometry(0.05, 0.003, 0.004);
    const lineMat = createMaterial(0x444444, 0.8, 0.1);
    
    for (let i = 0; i < 6; i++) {
      const color = postitColors[Math.floor(Math.random() * postitColors.length)];
      const mat = createMaterial(color, 0.9, 0.1);
      const postit = new THREE.Mesh(postitGeo, mat);
      
      if (i === 0) {
        // One post-it on the desk
        postit.position.set(0.3, 0.871, 0.2);
        postit.rotation.y = 0.4;
      } else {
        // On the wall between radio and screen (x from -0.8 to 0.5)
        postit.position.set(-0.8 + Math.random() * 1.3, 1.2 + Math.random() * 0.6, -1.39);
        postit.rotation.set(Math.PI / 2, 0, (Math.random() - 0.5) * 0.5);
      }
      
      // Fake text lines
      for (let j = 0; j < 3; j++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set((Math.random() - 0.5) * 0.01, 0.002, 0.015 - j * 0.015);
        line.scale.x = 0.5 + Math.random() * 0.5;
        postit.add(line);
      }
      
      deskGrp.add(postit);
    }

    deskGrp.position.set(0, 0, -3.6);
    this.scene.add(deskGrp);
  }

  _setupLights() {
    // Brighter ambient light to see everything properly
    this._ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this._ambientLight);

    // No central ceiling light — room lit by monster + fluorescents
    this._centralLight = null;

    // Brighter fill light at room center
    const fillLight = new THREE.PointLight(0xffeedd, 2.5, 15, 1.0);
    fillLight.position.set(0, 3.0, 0);
    this.scene.add(fillLight);
  }

  /* ── Movement (AZERTY + QWERTY) ── */
  setMoveState(key, pressed) {
    switch (key) {
      case 'z': case 'w': case 'arrowup':    this._moveForward = pressed; break;
      case 's':           case 'arrowdown':   this._moveBackward = pressed; break;
      case 'q': case 'a': case 'arrowleft':   this._moveLeft = pressed; break;
      case 'd':           case 'arrowright':   this._moveRight = pressed; break;
    }
  }

  _updateMovement(dt) {
    if (!this.controls.isLocked) return;
    this._velocity.x -= this._velocity.x * 8 * dt;
    this._velocity.z -= this._velocity.z * 8 * dt;
    this._direction.z = Number(this._moveForward) - Number(this._moveBackward);
    this._direction.x = Number(this._moveRight) - Number(this._moveLeft);
    this._direction.normalize();
    if (this._moveForward || this._moveBackward) this._velocity.z -= this._direction.z * this._speed * dt * 20;
    if (this._moveLeft || this._moveRight) this._velocity.x -= this._direction.x * this._speed * dt * 20;
    this.controls.moveRight(-this._velocity.x * dt);
    this.controls.moveForward(-this._velocity.z * dt);
    const pos = this.camera.position;

    // Wall bounds
    const W = 4.7;
    pos.x = Math.max(-W, Math.min(W, pos.x));
    pos.z = Math.max(-W, Math.min(W, pos.z));

    // AABB collision resolution (slide along surfaces)
    const r = this._playerRadius;
    for (const c of this._colliders) {
      const overlapX = Math.min(pos.x + r - c.minX, c.maxX - (pos.x - r));
      const overlapZ = Math.min(pos.z + r - c.minZ, c.maxZ - (pos.z - r));
      if (overlapX > 0 && overlapZ > 0) {
        // Inside — push out along the smallest overlap axis
        if (overlapX < overlapZ) {
          if (pos.x < (c.minX + c.maxX) / 2) pos.x = c.minX - r;
          else pos.x = c.maxX + r;
        } else {
          if (pos.z < (c.minZ + c.maxZ) / 2) pos.z = c.minZ - r;
          else pos.z = c.maxZ + r;
        }
      }
    }

    pos.y = 1.7;
  }

  /* ── Interaction ── */
  getInteractableAt() {
    this.raycaster.setFromCamera(this._center, this.camera);
    const targets = [];

    // Terminal buttons
    targets.push(...this.terminal.getInteractables());

    // Radio (always interactable)
    targets.push(this.radio.hitZone);

    // Workshop interactions based on phase
    const prodInteractables = this.productionLine.getInteractables();

    if (this._phase === 'PRODUCTION') {
      targets.push(...prodInteractables.filter(m => 
        m.userData.action === 'pour_dough' ||
        m.userData.action === 'pull_lever' ||
        m.userData.action === 'extract_cookie' ||
        m.userData.action === 'start_oven' ||
        m.userData.action === 'open_oven_door' ||
        m.userData.action === 'grab_tray' ||
        m.userData.action === 'deposit_box'
      ));
    }

    if (this._phase === 'POLL') {
      targets.push(...prodInteractables.filter(m => 
        m.userData.action === 'poll_reroll' || 
        m.userData.action === 'poll_confirm' ||
        m.userData.action === 'pull_lever'
      ));
    }

    if (this._phase === 'CHOICE') {
      targets.push(...this.choicePedestals.getInteractables());
      targets.push(...prodInteractables.filter(m => m.userData.action === 'target_select'));
    }

    if (this._phase === 'SHOP') {
      targets.push(...this.shopCounter.getInteractables());
    }

    for (const mesh of targets) {
      const intersects = this.raycaster.intersectObject(mesh, true);
      if (intersects.length > 0) return mesh.userData;
    }
    return null;
  }

  /* ── Phase management ── */
  setPhase(phase) {
    this._phase = phase;
    this.choicePedestals.hide();
    this.shopCounter.hide();
    this.terminal.hideButton();
    this.slotMachine.clearTargetSelection();

    if (phase === 'IDLE') this.terminal.showIdle();
    if (phase === 'PREVIEW') {
      this.slotMachine.activate();
    }
    if (phase === 'PRODUCTION') {
      this.terminal._showButton('end_round', '[Click] ⏹ Fin du round');
    }
  }

  reset() {
    for (const oven of this.ovens) oven.boxComplete();
    for (const screen of this.ovenScreens) screen.boxComplete();
    this._floorBoxes.forEach(b => this.scene.remove(b));
    this._floorBoxes = [];
    this.slotMachine.reset();
    this._feverMode = false;
    this.choicePedestals.hide();
    this.shopCounter.hide();
    this._pendingBoxData = null;
  }

  startRound(data, run) {
    // We don't dynamically swap oven models anymore in the monolithic ProductionLine
    // Instead, the single built-in oven handles all logic.
    this.ovens[0].boxComplete();
    this.ovenScreens[0].boxComplete();
    this.ovens[0].setIndicator(true);

    this._floorBoxes.forEach(b => this.scene.remove(b));
    this._floorBoxes = [];
    this.slotMachine.reset();
  }

  /* ── Production events ── */
  onBoxCreated(data) {
    this._pendingBoxData = data;
    this.slotMachine.animatePull(() => {
      this._startShowcase();
    });
  }

  /**
   * Start the cookie showcase: present each cookie one by one in front of the camera,
   * then send them all to the oven.
   */
  _startShowcase() {
    const data = this._pendingBoxData;
    if (!data) return;
    this._pendingBoxData = null;

    const { box, ovenIndex } = data;
    this.particles.emit('pull', new THREE.Vector3(-1.8, 3.5, 4.2));

    // Build the list of cookies to showcase
    const allCookies = [];
    if (box.grid) {
      for (let col = 0; col < box.grid.length; col++) {
        for (let row = 0; row < box.grid[col].length; row++) {
          const cell = box.grid[col][row];
          const recipeId = cell?.recipeId || cell || 'choco';
          allCookies.push(typeof recipeId === 'string' ? recipeId : 'choco');
        }
      }
    } else {
      const count = Math.min(6, box.cookies?.length || 6);
      for (let i = 0; i < count; i++) {
        allCookies.push(box.cookies?.[i]?.recipeId || 'choco');
      }
    }

    // Group by recipeId with count
    const counts = {};
    for (const id of allCookies) counts[id] = (counts[id] || 0) + 1;
    this._showcaseQueue = Object.entries(counts).map(([recipeId, count]) => ({ recipeId, count }));
    this._showcaseOvenIndex = ovenIndex;
    this._showcaseBox = box;
    this._showcaseActive = null;
    this._showcaseDoneCount = 0;
    this._showcaseTotalCount = allCookies.length;

    // Kick off the first one
    this._nextShowcase();
  }

  _nextShowcase() {
    if (this._showcaseQueue.length === 0) {
      // All shown — send cookies to oven
      this._finishShowcase();
      return;
    }

    const item = this._showcaseQueue.shift();
    const mesh = CookieModel.createLarge(item.recipeId);
    mesh.scale.setScalar(0);

    // Add multiplier label if count > 1
    if (item.count > 1) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
      ctx.strokeText(`\u00D7${item.count}`, 64, 32);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`\u00D7${item.count}`, 64, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true }),
      );
      label.scale.set(0.5, 0.25, 1);
      label.position.set(0.3, 0.15, 0);
      mesh.add(label);
    }

    this.scene.add(mesh);

    // Position the cookie right in front of the camera
    const cam = this.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const showcasePos = cam.position.clone()
      .add(dir.multiplyScalar(1.2))
      .add(new THREE.Vector3(0, -0.15, 0));
    mesh.position.copy(showcasePos);

    // Tilt so the flat top of the cookie faces the camera
    mesh.lookAt(cam.position);
    mesh.rotation.x -= Math.PI / 2;

    this._showcaseActive = {
      mesh,
      recipeId: item.recipeId,
      phase: 'appear',   // appear → hold → flyaway
      t: 0,
      showcasePos: showcasePos.clone(),
      startRot: mesh.rotation.y,
    };

    // Sound callback
    if (this._onShowcaseCookie) this._onShowcaseCookie(item.recipeId);
  }

  _updateShowcase(dt) {
    const s = this._showcaseActive;
    if (!s) return;

    s.t += dt;
    const cam = this.camera;

    if (s.phase === 'appear') {
      const dur = 0.20;
      const p = Math.min(1, s.t / dur);
      // Elastic ease-out
      const elastic = p === 1 ? 1 : 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * (2 * Math.PI / 3));
      s.mesh.scale.setScalar(elastic * 0.6);
      s.mesh.rotation.y = s.startRot + p * Math.PI * 2;

      // Keep in front of camera
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const pos = cam.position.clone().add(dir.multiplyScalar(1.2)).add(new THREE.Vector3(0, -0.15, 0));
      s.mesh.position.copy(pos);
      s.showcasePos.copy(pos);

      if (p >= 1) { s.phase = 'hold'; s.t = 0; }
    }
    else if (s.phase === 'hold') {
      const dur = 0.12;
      const p = Math.min(1, s.t / dur);
      s.mesh.rotation.y += dt * 4;
      s.mesh.scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.06);

      // Keep in front of camera
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const pos = cam.position.clone().add(dir.multiplyScalar(1.2)).add(new THREE.Vector3(0, -0.15, 0));
      s.mesh.position.copy(pos);
      s.showcasePos.copy(pos);

      if (p >= 1) {
        s.phase = 'flyaway';
        s.t = 0;
        s.flyFrom = s.mesh.position.clone();
        // Target: oven position
        s.flyTo = new THREE.Vector3(1.0, 1.45, 4.4);
      }
    }
    else if (s.phase === 'flyaway') {
      const dur = 0.22;
      const p = Math.min(1, s.t / dur);
      const ease = 1 - Math.pow(1 - p, 3);

      s.mesh.position.lerpVectors(s.flyFrom, s.flyTo, ease);
      s.mesh.position.y += Math.sin(p * Math.PI) * 0.6;
      s.mesh.rotation.y += dt * 12;
      s.mesh.scale.setScalar(0.6 * (1 - ease * 0.7));

      if (s.mesh.material) {
        s.mesh.material.transparent = true;
        s.mesh.material.opacity = 1 - ease * 0.5;
      }

      if (p >= 1) {
        this.scene.remove(s.mesh);
        this._showcaseActive = null;
        this._showcaseDoneCount++;

        // Quick burst particle at oven
        this.particles.emit('pull', s.flyTo.clone().add(new THREE.Vector3(0, 0.5, 0)));

        // Next cookie
        setTimeout(() => this._nextShowcase(), 20);
      }
    }
  }

  _finishShowcase() {
    const oven = this.ovens[this._showcaseOvenIndex];
    const screen = this.ovenScreens[this._showcaseOvenIndex];
    const box = this._showcaseBox;

    if (oven) oven.loadBox(box);
    if (screen) screen.loadBox(box);

    // Lever goes green to start cooking
    this.slotMachine.setOvenStart();

    this._showcaseBox = null;
    this._showcaseOvenIndex = null;
  }

  onOvenProgress(data) {
    const oven = this.ovens[data.ovenIndex];
    if (oven) oven.setProgresses(data.cookieStates);
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.setCookieStates(data.cookieStates);
  }

  onCookieExtracted(data) {
    const oven = this.ovens[data.ovenIndex];
    if (oven) oven.cookieExtracted(data.col, data.row, data.cookingResult);
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.cookieExtracted(data.col, data.row);

    const pos = oven
      ? new THREE.Vector3(1.2, 1.95, 4.5)
      : new THREE.Vector3(0, 2, 0);
    const zone = data.cookingResult.zone;
    if (zone === 'PERFECT' || zone === 'SWEET_SPOT') {
      this.particles.emit('perfect', pos);
      this.floatingText.zone(zone === 'PERFECT' ? 'PARFAIT ✨' : 'SWEET SPOT 💎', pos);
    } else if (zone === 'BURNED') {
      this.particles.emit('burn', pos);
      this.floatingText.zone('BRÛLÉ 💀', pos);
    } else {
      this.floatingText.zone(zone === 'COOKED' ? 'CUIT' : 'CRU', pos);
    }
  }

  onCookieBurned(data) {
    const oven = this.ovens[data.ovenIndex];
    if (oven) {
      oven.cookieBurned(data.col, data.row);
      this.particles.emit('burn', new THREE.Vector3(1.2, 1.65, 4.2));
    }
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.cookieBurned(data.col, data.row);
  }

  onBoxScored(data) {
    const oven = this.ovens[data.ovenIndex];
    if (oven) oven.boxComplete();
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.boxComplete();

    const dropPos = new THREE.Vector3(
      -1.5 + (this._floorBoxes.length % 4) * 1.0,
      0.1,
      1.0 + Math.floor(this._floorBoxes.length / 4) * 0.5,
    );
    this.particles.emit('score', dropPos.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.floatingText.score(data.value, dropPos.clone().add(new THREE.Vector3(0, 2, 0)));

    const combo = data.box?.gridResult?.bestGroup;
    if (combo && combo.size >= 3) {
      const ovenPos = oven
        ? new THREE.Vector3(1.2, 2.65, 4.5)
        : dropPos.clone().add(new THREE.Vector3(0, 1.5, 0));
      this.floatingText.combo(combo.name, combo.multiplier, ovenPos);
    }
  }

  onBenneAdded(data) {
    // Launch box up through the pneumatic tube
    this.productionLine.launchBox(data.value);
  }

  onFeverStart() {
    this._feverMode = true;
    if (!this._feverLight) {
      this._feverLight = new THREE.PointLight(0xff4400, 2, 15);
      this._feverLight.position.set(0, 3, 0);
      this.scene.add(this._feverLight);
    }
    this._feverLight.visible = true;
  }

  onFeverEnd() {
    this._feverMode = false;
    if (this._feverLight) this._feverLight.visible = false;
  }

  startPoll(recipes, rerollsLeft) { this.slotMachine.startRoll(recipes, rerollsLeft); }
  updatePoll(rerollsLeft) { this.slotMachine.setRerolls(rerollsLeft); }
  lockRecipesAndReady() { this.slotMachine.lockRecipesAndReady(); }

  showChoices(choices) { this.choicePedestals.showChoices(choices); }
  showTargetSelection(pool) { this.productionLine.showTargetSelection(pool); }
  clearTargetSelection() { this.productionLine.clearTargetSelection(); }
  showShop(run, offerings) { this.shopCounter.showShop(run, offerings); }
  showPreview(data) { this.terminal.showPreview(data); }
  showResults(data) { this.terminal.showResults(data); }
  showGameOver(data, run) { this.terminal.showGameOver(data, run); }
  showVictory(data, run) { this.terminal.showVictory(data, run); }

  update(dt) {
    this._updateMovement(dt);
    this._updateTransfers(dt);
    this._updateShowcase(dt);
    this.productionLine.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.choicePedestals.update(dt);
    this.shopCounter.update(dt);
    this.terminal.update(dt);
    this.radio.update(dt);
    for (const vent of this.airVents) vent.update(dt);
    for (const light of this.overheadLights) light.update(dt);
    this.ambientHorror.update(dt);

    // Gaze detection: looking at the cosmic horror amplifies stress
    let gaze = 0;
    if (this.controls.isLocked) {
      gaze = this.cosmicHorror.getGazeIntensity(this.camera, this.raycaster);
      if (gaze > 0) {
        this.ambientHorror.stress = Math.min(1, this.ambientHorror.stress + gaze * dt * 0.35);
      }
    }
    this.cosmicHorror.update(dt, this.camera.position, gaze);

    // Screen shake from stress/gaze
    if (this.controls.isLocked && this.ambientHorror.stress > 0.1) {
      const s = this.ambientHorror.stress;
      const shakeX = (Math.random() - 0.5) * s * 0.008;
      const shakeY = (Math.random() - 0.5) * s * 0.008;
      this.camera.rotation.x += shakeX;
      this.camera.rotation.y += shakeY;
    }
    if (this._feverMode && this._feverLight) {
      this._feverLight.intensity = 1.5 + Math.sin(Date.now() * 0.008) * 1.0;
    }
  }

  _updateTransfers(dt) {
    for (let i = this._transfers.length - 1; i >= 0; i--) {
      const tr = this._transfers[i];
      tr.t += dt;
      if (tr.t < 0) continue;

      const progress = Math.min(1, tr.t / tr.duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      tr.mesh.position.lerpVectors(tr.from, tr.to, ease);
      tr.mesh.position.y += Math.sin(progress * Math.PI) * 1.0;
      tr.mesh.rotation.y += dt * 10;

      if (progress >= 1) {
        this.scene.remove(tr.mesh);
        this._transfers.splice(i, 1);
      }
    }
  }
}
