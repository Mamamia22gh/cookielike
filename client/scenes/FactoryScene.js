import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { SlotMachine } from '../objects/SlotMachine.js';
import { OvenModel } from '../objects/OvenModel.js';
import { OvenScreen } from '../objects/OvenScreen.js';
import { ConveyorBelt } from '../objects/ConveyorBelt.js';
import { BenneModel } from '../objects/BenneModel.js';
import { DoughProvider } from '../objects/DoughProvider.js';
import { FactoryBuilding } from '../objects/FactoryBuilding.js';
import { ChoicePedestals } from '../objects/ChoicePedestal.js';
import { ShopCounter } from '../objects/ShopCounter.js';
import { CRTTerminal } from '../objects/CRTTerminal.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { FloatingTextSystem } from '../effects/FloatingText.js';
import { AirVent } from '../objects/AirVent.js';
import { PALETTE } from '../utils/Materials.js';

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
    this._setupFloor();

    this.building = new FactoryBuilding();
    this.scene.add(this.building.group);

    /*
     * ── LAYOUT ──
     * Player at center (0, 1.7, 0), looking north (-Z)
     *
     *              CRT Terminal (N)
     *                   ↑
     *  SlotMachine ←──  ●  ──→ ShopCounter
     *  + DoughProvider  │       (NE)
     *  (W)              │
     *                   │
     *                   │   Ovens + Screens (E)
     *                   ↓
     *     Choices (S)    Benne (SE)
     */

    // ── NORTH: CRT Terminal ──
    this.terminal = new CRTTerminal();
    this.terminal.group.position.set(0, 3.1, -7);
    this.scene.add(this.terminal.group);

    // ── WEST: Unified slot machine + dough provider ──
    this.slotMachine = new SlotMachine();
    this.slotMachine.group.position.set(-5, 0, -2);
    this.slotMachine.group.rotation.y = Math.PI / 6;
    this.scene.add(this.slotMachine.group);

    this.doughProvider = new DoughProvider();
    this.doughProvider.group.position.set(-5, 0, -2);
    this.doughProvider.group.rotation.y = Math.PI / 6;
    this.scene.add(this.doughProvider.group);

    // ── Conveyor belt (machine → ovens) ──
    this.conveyor = new ConveyorBelt();
    this.conveyor.group.position.set(-1, 0, -1);
    this.scene.add(this.conveyor.group);

    // ── EAST: Ovens + Screens ──
    this.ovens = [];
    this.ovenScreens = [];

    // ── SOUTH-EAST: Benne ──
    this.benne = new BenneModel();
    this.benne.group.position.set(5, 0, 4);
    this.benne.group.rotation.y = -Math.PI / 4;
    this.scene.add(this.benne.group);

    // ── SOUTH: Choice Pedestals ──
    this.choicePedestals = new ChoicePedestals();
    this.choicePedestals.group.position.set(0, 0, 5);
    this.scene.add(this.choicePedestals.group);

    // ── NORTH-EAST: Shop Counter ──
    this.shopCounter = new ShopCounter();
    this.shopCounter.group.position.set(5, 0, -4);
    this.shopCounter.group.rotation.y = -Math.PI / 4;
    this.scene.add(this.shopCounter.group);

    // ── Effects ──
    this.particles = new ParticleSystem(this.scene);
    this.floatingText = new FloatingTextSystem(this.scene);

    this._phase = 'IDLE';
    this._feverMode = false;
    this._feverLight = null;

    // Pending box (delayed by craft animation)
    this._pendingBoxData = null;

    // ── Audio listener for positional audio ──
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // ── Air vents (oppressive hissing) ──
    this.airVents = [];
    const ventPositions = [
      { pos: [-9.8, 4.5, -3], rot: [0, Math.PI / 2, 0] },
      { pos: [-9.8, 4.5, 3],  rot: [0, Math.PI / 2, 0] },
      { pos: [9.8, 4.5, 0],   rot: [0, -Math.PI / 2, 0] },
      { pos: [0, 4.5, -9.8],  rot: [0, 0, 0] },
    ];
    for (const v of ventPositions) {
      const vent = new AirVent(this.listener);
      vent.group.position.set(...v.pos);
      vent.group.rotation.set(...v.rot);
      this.scene.add(vent.group);
      this.airVents.push(vent);
    }
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xfff5e6, 2.8));

    const sun = new THREE.DirectionalLight(0xfff0d0, 3.0);
    sun.position.set(5, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;  sun.shadow.camera.bottom = -15;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8899cc, 1.2);
    fill.position.set(-8, 6, -4);
    this.scene.add(fill);

    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const lamp = new THREE.PointLight(0xffaa55, 2.5, 25);
        lamp.position.set(gx * 5, 6.2, gz * 5);
        this.scene.add(lamp);
      }
    }

    const warm = new THREE.PointLight(0xff9944, 3.0, 30);
    warm.position.set(0, 5, 0);
    this.scene.add(warm);
  }

  _setupFloor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.75, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(40, 40, 0x2a2a2a, 0x1a1a1a);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    this.scene.add(grid);
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
    pos.x = Math.max(-8, Math.min(8, pos.x));
    pos.z = Math.max(-8, Math.min(8, pos.z));
    pos.y = 1.7;
  }

  /* ── Interaction ── */
  getInteractableAt() {
    this.raycaster.setFromCamera(this._center, this.camera);
    const targets = [];

    // Terminal buttons
    targets.push(...this.terminal.getInteractables());

    if (this._phase === 'PRODUCTION') {
      // Dough provider
      targets.push(this.doughProvider.hitZone);
      // Lever (only when machine is idle, not crafting)
      targets.push(this.slotMachine.lever);
      // Oven screens (tactile)
      for (const screen of this.ovenScreens) {
        targets.push(...screen.getHitboxes());
      }
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
    for (const oven of this.ovens) this.scene.remove(oven.group);
    for (const screen of this.ovenScreens) this.scene.remove(screen.group);
    this.ovens = [];
    this.ovenScreens = [];
    this.benne.clear();
    this.conveyor.clear();
    this.slotMachine.reset();
    this._feverMode = false;
    this.choicePedestals.hide();
    this.shopCounter.hide();
    this._pendingBoxData = null;
  }

  startRound(data, run) {
    for (const oven of this.ovens) this.scene.remove(oven.group);
    for (const screen of this.ovenScreens) this.scene.remove(screen.group);
    this.ovens = [];
    this.ovenScreens = [];

    for (let i = 0; i < run.ovens.length; i++) {
      const oven = new OvenModel(run.ovens[i].typeId, i);
      oven.group.position.set(5, 0, -2 + i * 3);
      oven.group.rotation.y = -Math.PI / 4;
      this.scene.add(oven.group);
      this.ovens.push(oven);

      const screen = new OvenScreen(i);
      screen.group.position.set(3.5, 0, -1 + i * 3);
      screen.group.rotation.y = -Math.PI / 5;
      this.scene.add(screen.group);
      this.ovenScreens.push(screen);
    }

    this.benne.clear();
    this.conveyor.clear();
    this.slotMachine.reset();
  }

  /* ── Production events ── */
  onBoxCreated(data) {
    // Store box data — will be shown after craft animation finishes
    this._pendingBoxData = data;

    // Start craft animation; when done, show the cookies
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
      oven.loadBox(box);
      this.conveyor.animateTransfer(this.slotMachine.group.position, oven.group.position, box);
    }
    if (screen) screen.loadBox(box);
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
      ? oven.group.position.clone().add(new THREE.Vector3(0, 2.5, 1))
      : new THREE.Vector3(0, 3, 0);
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
      this.particles.emit('burn', oven.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)));
    }
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.cookieBurned(data.col, data.row);
  }

  onBoxScored(data) {
    const oven = this.ovens[data.ovenIndex];
    if (oven) oven.boxComplete();
    const screen = this.ovenScreens[data.ovenIndex];
    if (screen) screen.boxComplete();

    const bennePos = this.benne.group.position.clone().add(new THREE.Vector3(0, 3, 0));
    this.particles.emit('score', bennePos);
    this.floatingText.score(data.value, bennePos);

    const combo = data.box?.gridResult?.bestGroup;
    if (combo && combo.size >= 3) {
      const ovenPos = oven
        ? oven.group.position.clone().add(new THREE.Vector3(0, 4, 1))
        : bennePos;
      this.floatingText.combo(combo.name, combo.multiplier, ovenPos);
    }
  }

  onBenneAdded(data) { this.benne.addBox(data.value); }

  onFeverStart() {
    this._feverMode = true;
    if (!this._feverLight) {
      this._feverLight = new THREE.PointLight(0xff4400, 2, 30);
      this._feverLight.position.set(0, 6, 0);
      this.scene.add(this._feverLight);
    }
    this._feverLight.visible = true;
  }

  onFeverEnd() {
    this._feverMode = false;
    if (this._feverLight) this._feverLight.visible = false;
  }

  /* ── Poll — now on the slot machine ── */
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
    this.slotMachine.update(dt);
    this.conveyor.update(dt);
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.benne.update(dt);
    this.doughProvider.update(dt);
    this.choicePedestals.update(dt);
    this.shopCounter.update(dt);
    this.terminal.update(dt);
    for (const oven of this.ovens) oven.update(dt);
    for (const screen of this.ovenScreens) screen.update(dt);
    for (const vent of this.airVents) vent.update(dt);
    if (this._feverMode && this._feverLight) {
      this._feverLight.intensity = 1.5 + Math.sin(Date.now() * 0.008) * 1.0;
    }
  }
}
