import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { SlotMachine } from '../objects/SlotMachine.js';
import { OvenModel } from '../objects/OvenModel.js';
import { OvenScreen } from '../objects/OvenScreen.js';
import { DoughProvider } from '../objects/DoughProvider.js';
import { FactoryBuilding } from '../objects/FactoryBuilding.js';
import { ChoicePedestals } from '../objects/ChoicePedestal.js';
import { ShopCounter } from '../objects/ShopCounter.js';
import { CRTTerminal } from '../objects/CRTTerminal.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { FloatingTextSystem } from '../effects/FloatingText.js';
import { AirVent } from '../objects/AirVent.js';
import { BoxStation } from '../objects/BoxStation.js';
import { CookieModel } from '../objects/CookieModel.js';
import { RadioPlayer } from '../objects/RadioPlayer.js';
import { PALETTE, createMaterial } from '../utils/Materials.js';

export class FactoryScene {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.008);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 1.7, 0);
    this.camera.lookAt(0, 1.7, -5);

    this.controls = new PointerLockControls(this.camera, renderer.domElement);

    this._moveForward = false;
    this._moveBackward = false;
    this._moveLeft = false;
    this._moveRight = false;
    this._velocity = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._speed = 6;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 18;
    this._center = new THREE.Vector2(0, 0);

    this._setupLights();

    // No separate floor — FactoryBuilding provides the parquet
    this.building = new FactoryBuilding();
    this.scene.add(this.building.group);

    /*
     * ── LAYOUT: compact room (R=5), machines against walls ──
     *
     *          NORTH wall (-Z, z=-5)
     *       [Desk: CRT + Radio]
     *
     *  WEST wall (x=-5)     EAST wall (x=5)
     *  SlotMachine(0.5)     Oven(0.5) + Screen
     *  + DoughProvider
     *
     *          SOUTH wall (+Z, z=5)
     *    Shop    BoxStation   Choices
     *         [AirVent]
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

    // ── WEST: Slot machine + dough provider (scaled 0.5) ──
    this.slotMachine = new SlotMachine();
    this.slotMachine.group.position.set(-4.2, 0, 0);
    this.slotMachine.group.rotation.y = Math.PI / 2;
    this.slotMachine.group.scale.setScalar(0.5);
    this.scene.add(this.slotMachine.group);

    this.doughProvider = new DoughProvider();
    this.doughProvider.group.position.set(-4.2, 0, 0);
    this.doughProvider.group.rotation.y = Math.PI / 2;
    this.doughProvider.group.scale.setScalar(0.5);
    this.scene.add(this.doughProvider.group);

    // ── EAST: Oven + Screen (scaled 0.5) ──
    this.ovens = [];
    this.ovenScreens = [];
    {
      const oven = new OvenModel('classic', 0);
      oven.group.position.set(4.2, 0, 0);
      oven.group.rotation.y = -Math.PI / 2;
      oven.group.scale.setScalar(0.5);
      this.scene.add(oven.group);
      this.ovens.push(oven);

      const screen = new OvenScreen(0);
      // Mounted on oven's right side as integrated panel
      screen.group.position.set(4.2, 0, 1.2);
      screen.group.rotation.y = -Math.PI / 2;
      screen.group.scale.setScalar(0.5);
      this.scene.add(screen.group);
      this.ovenScreens.push(screen);
    }

    // ── Scored boxes on the floor ──
    this._floorBoxes = [];

    // ── SOUTH: Box Station (packing table) ──
    this.boxStation = new BoxStation();
    this.boxStation.group.position.set(2.5, 0, 4.0);
    this.boxStation.group.rotation.y = Math.PI;
    this.boxStation.group.scale.setScalar(0.8);
    this.scene.add(this.boxStation.group);

    // ── SOUTH: Choice Pedestals ──
    this.choicePedestals = new ChoicePedestals();
    this.choicePedestals.group.position.set(0, 0, 3.5);
    this.choicePedestals.group.scale.setScalar(0.7);
    this.scene.add(this.choicePedestals.group);

    // ── SOUTH-WEST: Shop Counter ──
    this.shopCounter = new ShopCounter();
    this.shopCounter.group.position.set(-2.5, 0, 4.0);
    this.shopCounter.group.rotation.y = Math.PI;
    this.shopCounter.group.scale.setScalar(0.7);
    this.scene.add(this.shopCounter.group);

    // ── Effects ──
    this.particles = new ParticleSystem(this.scene);
    this.floatingText = new FloatingTextSystem(this.scene);

    this._phase = 'IDLE';
    this._feverMode = false;
    this._feverLight = null;

    // Pending box (delayed by craft animation)
    this._pendingBoxData = null;

    // Flying cookie transfer animations
    this._transfers = [];

    // ── Audio listener for positional audio ──
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // Replace dummy listener on radio
    this.radio._listener = this.listener;

    // ── Air vent (single, on south wall) ──
    this.airVents = [];
    const vent = new AirVent(this.listener);
    vent.group.position.set(0, 2.5, 4.99); // 4.99 pour être bien enfoncé dans le mur (R=5)
    vent.group.rotation.set(0, Math.PI, 0);
    this.scene.add(vent.group);
    this.airVents.push(vent);
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

    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 1.0), woodMat);
    top.position.set(0, 0.84, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    deskGrp.add(top);

    // Legs
    const legMat = createMaterial(0x5a4428, 0.7, 0.05);
    for (const x of [-1.65, 1.65]) {
      for (const z of [-0.4, 0.4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.84, 0.06), legMat);
        leg.position.set(x, 0.42, z);
        leg.castShadow = true;
        deskGrp.add(leg);
      }
    }

    // Drawer unit (right side)
    const drawerMat = createMaterial(0x5a4428, 0.7, 0.05);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), drawerMat);
    drawer.position.set(1.2, 0.55, 0);
    drawer.castShadow = true;
    deskGrp.add(drawer);

    // Drawer handles
    const handleMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    for (let dy = 0; dy < 3; dy++) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.04), handleMat);
      handle.position.set(1.2, 0.38 + dy * 0.12, 0.42);
      deskGrp.add(handle);
    }

    // Coffee mug
    const mugMat = createMaterial(0xddddcc, 0.5, 0.1);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8), mugMat);
    mug.position.set(-0.8, 0.92, 0.15);
    deskGrp.add(mug);

    // Stack of papers
    const paperMat = createMaterial(0xeeeeee, 0.9, 0.0);
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), paperMat);
    papers.position.set(1.3, 0.89, 0.1);
    papers.rotation.y = 0.15;
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

    // Post-its scattered on the desk
    const postitColors = [0xffeb3b, 0xff99cc, 0xccff90, 0x80deea, 0xffb74d];
    const postitGeo = new THREE.BoxGeometry(0.08, 0.002, 0.08);
    const lineGeo = new THREE.BoxGeometry(0.05, 0.003, 0.004);
    const lineMat = createMaterial(0x444444, 0.8, 0.1);
    
    for (let i = 0; i < 6; i++) {
      const color = postitColors[Math.floor(Math.random() * postitColors.length)];
      const mat = createMaterial(color, 0.9, 0.1);
      const postit = new THREE.Mesh(postitGeo, mat);
      
      // Random position on the desk (avoiding the left side where the radio and lamp are)
      postit.position.set(-0.5 + Math.random() * 1.8, 0.871, (Math.random() - 0.5) * 0.6);
      postit.rotation.y = (Math.random() - 0.5) * 2;
      
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
    // No global ambient or directional light, only the central point light.
    // Extremely faint ambient just so absolute black isn't pitch black.
    this.scene.add(new THREE.AmbientLight(0xfff5e6, 0.05));

    // Single central warm ceiling light (matches the fixture in FactoryBuilding)
    const centralLight = new THREE.PointLight(0xffaa55, 6.0, 25);
    centralLight.position.set(0, 1.95, 0); // Positioned just under the bulb from FactoryBuilding
    centralLight.castShadow = true;
    centralLight.shadow.bias = -0.002;
    // La lumière perd très vite de l'intensité, decay la rend plus douce au fond
    centralLight.decay = 1.5; 
    this.scene.add(centralLight);
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
    // Commenté pour le dev (traverser les murs)
    // pos.x = Math.max(-4, Math.min(4, pos.x));
    // pos.z = Math.max(-3.5, Math.min(3.5, pos.z));
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

    if (this._phase === 'PRODUCTION') {
      // Dough provider
      targets.push(this.doughProvider.hitZone);
      // Lever (only when machine is idle, not crafting)
      targets.push(this.slotMachine.lever);
      // Oven hitboxes (cookies on screen + door + grab tray)
      for (const screen of this.ovenScreens) {
        targets.push(...screen.getHitboxes());
      }
      for (const oven of this.ovens) {
        targets.push(...oven.getCookieHitboxes());
      }
      // Box station (deposit)
      targets.push(this.boxStation.hitZone);
    }

    if (this._phase === 'POLL') {
      targets.push(...this.slotMachine.getInteractables());
    }

    if (this._phase === 'CHOICE') {
      targets.push(...this.choicePedestals.getInteractables());
      targets.push(...this.slotMachine.getInteractables()); // target selection
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
    // Reset the single oven (swap type if needed)
    const runOven = run.ovens[0];
    if (runOven && this.ovens[0].typeId !== runOven.typeId) {
      this.scene.remove(this.ovens[0].group);
      const oven = new OvenModel(runOven.typeId, 0);
      oven.group.position.set(4.2, 0, 0);
      oven.group.rotation.y = -Math.PI / 2;
      oven.group.scale.setScalar(0.5);
      this.scene.add(oven.group);
      this.ovens[0] = oven;
    }
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
      this._showPendingBox();
    });
  }

  _showPendingBox() {
    const data = this._pendingBoxData;
    if (!data) return;
    this._pendingBoxData = null;

    const { box, ovenIndex } = data;
    this.particles.emit('pull', this.slotMachine.group.position.clone().add(new THREE.Vector3(0, 3, 0)));
    const oven = this.ovens[ovenIndex];
    const screen = this.ovenScreens[ovenIndex];

    if (oven) {
      const from = this.slotMachine.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const to = oven.group.position.clone().add(new THREE.Vector3(0, 0.7, 0));
      const count = Math.min(6, box.cookies?.length || 6);

      for (let i = 0; i < count; i++) {
        const recipeId = box.cookies?.[i]?.recipeId || 'choco';
        const mesh = CookieModel.createSmall(recipeId);
        mesh.scale.setScalar(0.5);
        mesh.position.copy(from);
        this.scene.add(mesh);

        this._transfers.push({
          mesh,
          from: from.clone(),
          to: to.clone(),
          t: -i * 0.08,
          duration: 0.5,
          done: false,
        });
      }

      setTimeout(() => {
        oven.loadBox(box);
        if (screen) screen.loadBox(box);
      }, 400);
    } else {
      if (screen) screen.loadBox(box);
    }
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
      ? oven.group.position.clone().add(new THREE.Vector3(0, 1.5, 0.5))
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
      this.particles.emit('burn', oven.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
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
      1 + (this._floorBoxes.length % 3) * 0.8 - 0.8,
      0.1,
      1 + Math.floor(this._floorBoxes.length / 3) * 0.6,
    );
    this.particles.emit('score', dropPos.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.floatingText.score(data.value, dropPos.clone().add(new THREE.Vector3(0, 2, 0)));

    const combo = data.box?.gridResult?.bestGroup;
    if (combo && combo.size >= 3) {
      const ovenPos = oven
        ? oven.group.position.clone().add(new THREE.Vector3(0, 2.5, 0.5))
        : dropPos.clone().add(new THREE.Vector3(0, 1.5, 0));
      this.floatingText.combo(combo.name, combo.multiplier, ovenPos);
    }
  }

  onBenneAdded(data) {
    const size = 0.2 + Math.random() * 0.1;
    const geo = new THREE.BoxGeometry(size, size * 0.6, size);
    const hue = Math.min(1, data.value / 300);
    const color = new THREE.Color().setHSL(0.1 + hue * 0.15, 0.6, 0.45 + hue * 0.15);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(
      1 + (this._floorBoxes.length % 3) * 0.8 - 0.8,
      size * 0.3,
      1 + Math.floor(this._floorBoxes.length / 3) * 0.6,
    );
    box.rotation.y = (Math.random() - 0.5) * 0.4;
    box.castShadow = true;
    this.scene.add(box);
    this._floorBoxes.push(box);
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

  showChoices(choices) { this.choicePedestals.showChoices(choices); }
  showTargetSelection(pool) { this.slotMachine.showTargetSelection(pool); }
  clearTargetSelection() { this.slotMachine.clearTargetSelection(); }
  showShop(run, offerings) { this.shopCounter.showShop(run, offerings); }
  showPreview(data) { this.terminal.showPreview(data); }
  showResults(data) { this.terminal.showResults(data); }
  showGameOver(data, run) { this.terminal.showGameOver(data, run); }
  showVictory(data, run) { this.terminal.showVictory(data, run); }

  update(dt) {
    this._updateMovement(dt);
    this._updateTransfers(dt);
    this.slotMachine.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.doughProvider.update(dt);
    this.choicePedestals.update(dt);
    this.shopCounter.update(dt);
    this.terminal.update(dt);
    this.radio.update(dt);
    for (const oven of this.ovens) oven.update(dt);
    for (const screen of this.ovenScreens) screen.update(dt);
    for (const vent of this.airVents) vent.update(dt);
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
