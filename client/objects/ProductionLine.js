import * as THREE from 'three';
import { PALETTE, createMaterial, createGlowMaterial } from '../utils/Materials.js';
import { makeCountertopTexture, makeMetroTileTexture, makeOxidizedMetalTexture } from '../utils/ProceduralTextures.js';
import { RECIPES, getRecipe } from '../../src/data/recipes.js';
import { CookieModel } from './CookieModel.js';

const ZONE_COLORS = {
  RAW: 0x3b82f6, COOKED: 0xeab308, PERFECT: 0x22c55e,
  SWEET_SPOT: 0xa855f7, BURNED: 0xef4444,
};

/**
 * Monolithic Production Line — south wall of the workshop.
 *
 * LEFT   (x -4 → -0.3) : Dough hopper + Slot machine (recipe roller)
 * CENTER (x  0 →  2.2)  : Oven + tactile screen
 * RIGHT  (x  2.5 → 4.3) : Box packing + pneumatic tube to space
 */
export class ProductionLine {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ProductionLine';

    // ── Texture cache ──
    this._texCache = {};
    this._recipeList = RECIPES.filter(r => !r.isWild);
    for (const r of RECIPES) this._texCache[r.id] = this._renderRecipeTex(r);
    this._blankTex = this._renderBlankTex();

    // ── Sub-components (logic controllers) ──
    this.slotMachine  = new SlotMachineComponent(this);
    this.doughProvider = new DoughProviderComponent(this);
    this.ovens        = [new OvenComponent(this, 0)];
    this.ovenScreens  = [new OvenScreenComponent(this, 0)];
    this.boxStation   = new BoxStationComponent(this);

    // ── Tube launch animations ──
    this._tubeBoxes = [];

    this._build();
  }

  /* ═══════════════════════════════════════════════════════════════════
   *  GEOMETRY
   * ═══════════════════════════════════════════════════════════════════ */

  _build() {
    const metalMat = createMaterial(PALETTE.metalDark, 0.3, 0.8);
    const bodyMat  = createMaterial(0x3a3b45, 0.35, 0.55);

    const counterTex = makeCountertopTexture(512);
    const counterMat = new THREE.MeshStandardMaterial({ map: counterTex, roughness: 0.7, metalness: 0.05 });
    const tileTex    = makeMetroTileTexture(512);
    const tileMat    = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.4, metalness: 0.1 });
    const pipeTex    = makeOxidizedMetalTexture(256);
    const pipeMat    = new THREE.MeshStandardMaterial({ map: pipeTex, roughness: 0.45, metalness: 0.7 });

    // ─── 1. Workbench base ────────────────────────────────────────
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.1, 1.6), counterMat);
    topMesh.position.set(0, 0.9, 3.8);
    topMesh.castShadow = true; topMesh.receiveShadow = true;
    this.group.add(topMesh);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.2, 0.1), bodyMat);
    apron.position.set(0, 0.8, 3.0); this.group.add(apron);

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.75, 1.4), bodyMat);
    cabinet.position.set(0, 0.38, 3.8);
    cabinet.castShadow = true; cabinet.receiveShadow = true;
    this.group.add(cabinet);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.05, 0.05), metalMat);
    rail.position.set(0, 0.1, 3.1); this.group.add(rail);

    const splash = new THREE.Mesh(new THREE.BoxGeometry(9.2, 2.5, 0.1), tileMat);
    splash.position.set(0, 2.15, 4.65); this.group.add(splash);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 9.0, 8), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.1, 4.6); this.group.add(pipe);

    for (const bx of [-3.5, -1.0, 1.5, 4.0]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), metalMat);
      br.position.set(bx, 3.0, 4.62); this.group.add(br);
    }

    // ─── 2. SLOT MACHINE (x ≈ -3.8 → -0.3) ──────────────────────
    this._buildSlotSection(bodyMat, metalMat);

    // ─── 3. OVEN (x ≈ 0.0 → 2.2) ────────────────────────────────
    this._buildOvenSection(bodyMat, metalMat);

    // ─── 4. BOX STATION + TUBE (x ≈ 2.5 → 4.3) ──────────────────
    this._buildBoxSection(bodyMat, metalMat);
  }

  /* ── Slot machine section ─────────────────────────────────────── */
  _buildSlotSection(bodyMat, metalMat) {
    // ── Machine cabinet (rises from counter) ──
    const cabinetW = 3.2, cabinetH = 2.0, cabinetD = 0.6;
    const slotCabinet = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetW, cabinetH, cabinetD), bodyMat,
    );
    slotCabinet.position.set(-2.0, 1.95 + cabinetH / 2 - 1.0, 4.2);
    slotCabinet.castShadow = true;
    this.group.add(slotCabinet);
    this.slotMachine._cabinet = slotCabinet;

    // Front dark panel
    const panelMat = createMaterial(0x0a0a18, 0.1, 0.0);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetW - 0.3, cabinetH - 0.2, 0.06), panelMat,
    );
    panel.position.set(-2.0, 1.95 + cabinetH / 2 - 1.0, 3.88);
    this.group.add(panel);

    // Gold trim top & bottom
    const trimMat = createMaterial(PALETTE.gold, 0.15, 0.85);
    for (const dy of [-cabinetH / 2 + 0.05, cabinetH / 2 - 0.05]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(cabinetW + 0.1, 0.08, cabinetD + 0.1), trimMat);
      trim.position.set(-2.0, 1.95 + cabinetH / 2 - 1.0 + dy, 4.2);
      this.group.add(trim);
    }

    // Side indicator LEDs
    for (const sx of [-3.55, -0.45]) {
      for (let ly = 1.3; ly <= 2.6; ly += 0.4) {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 6),
          createGlowMaterial(0x3388ff, 0.4),
        );
        led.position.set(sx, ly, 4.0);
        this.group.add(led);
      }
    }

    // ── 4 recipe displays (2×2) ──
    const displayBaseY = 1.85;
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = -2.5 + col * 1.0;
      const y = displayBaseY + 0.5 - row * 0.9;

      // Recess
      const recess = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.82, 0.04),
        createMaterial(0x050510, 0.9, 0.0),
      );
      recess.position.set(x, y, 3.87); this.group.add(recess);

      // Display plane
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: this._blankTex, transparent: true }),
      );
      plane.position.set(x, y, 3.81);
      plane.rotation.y = Math.PI;
      this.group.add(plane);

      // Border
      const bMat = createGlowMaterial(0x333355, 0.2);
      const border = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 4), bMat);
      border.rotation.set(0, 0, Math.PI / 4);
      border.position.set(x, y, 3.82); this.group.add(border);

      this.slotMachine._slots.push({
        plane, borderMesh: border, locked: false,
        cycleTimer: 0, displayIdx: Math.floor(Math.random() * this._recipeList.length),
      });
    }

    // ── Confirm button (on counter surface in front of machine) ──
    this.slotMachine._confirmBtn = this._makeCounterButton(-2.0, 0.95, 3.3, 0x22c55e, '✅', 'poll_confirm');
    this.slotMachine._confirmBtn.visible = false;

    // ── Lever (on counter, right of slot machine) ──
    this.slotMachine.leverPivot = new THREE.Group();
    this.slotMachine.leverPivot.position.set(-0.2, 0.95, 3.5);
    this.group.add(this.slotMachine.leverPivot);

    const leverBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.15, 12), metalMat);
    this.slotMachine.leverPivot.add(leverBase);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), metalMat);
    arm.position.y = 0.55; arm.castShadow = true;
    this.slotMachine.leverPivot.add(arm);

    const ballMat = createMaterial(PALETTE.red, 0.3, 0.2);
    ballMat.emissive = new THREE.Color(0x000000);
    ballMat.emissiveIntensity = 0;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12), ballMat,
    );
    ball.position.y = 1.1; ball.castShadow = true;
    this.slotMachine.leverPivot.add(ball);
    this.slotMachine._leverBall = ball;

    const leverHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.4, 0.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    leverHit.position.set(-0.2, 1.5, 3.5);
    leverHit.userData = { interactable: true, action: 'pull_lever', label: '[Click] Tirer le levier 🎰' };
    this.group.add(leverHit);
    this.slotMachine.lever = leverHit;

    // ── Dough hopper (top of machine) ──
    const hopperGeo = new THREE.CylinderGeometry(0.7, 0.3, 1.0, 12);
    const hopperMat = createMaterial(0x7a6a5a, 0.55, 0.35);
    const hopper = new THREE.Mesh(hopperGeo, hopperMat);
    hopper.position.set(-2.0, 3.5, 4.1);
    hopper.castShadow = true; this.group.add(hopper);

    const doughMat = createMaterial(0xf5deb3, 0.8, 0.0);
    doughMat.emissive = new THREE.Color(0xf5deb3);
    doughMat.emissiveIntensity = 0.15;
    this.doughProvider.doughFill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.25, 0.8, 12), doughMat,
    );
    this.doughProvider.doughFill.position.set(-2.0, 3.5, 4.1);
    this.group.add(this.doughProvider.doughFill);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), metalMat);
    nozzle.position.set(-2.0, 2.85, 4.1); this.group.add(nozzle);

    // Support brackets
    for (const dx of [-0.5, 0.5]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), metalMat);
      br.position.set(-2.0 + dx, 3.2, 4.1);
      br.castShadow = true; this.group.add(br);
    }

    // Dough hitzone
    const doughHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.5, 1.4, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    doughHit.position.set(-2.0, 3.5, 4.1);
    doughHit.userData = { interactable: true, action: 'pour_dough', label: '[Click] Verser la pâte 🧈' };
    this.group.add(doughHit);
    this.doughProvider.hitZone = doughHit;

    // Craft light
    this.slotMachine._craftLight = new THREE.PointLight(0xff6600, 0, 5);
    this.slotMachine._craftLight.position.set(-2.0, 2.0, 3.9);
    this.group.add(this.slotMachine._craftLight);

    // Label: "MACHINE À COOKIES"
    const lblC = document.createElement('canvas');
    lblC.width = 512; lblC.height = 64;
    const lctx = lblC.getContext('2d');
    lctx.fillStyle = '#0a0a18'; lctx.fillRect(0, 0, 512, 64);
    lctx.font = 'bold 24px monospace'; lctx.fillStyle = '#ffd700';
    lctx.textAlign = 'center'; lctx.fillText('🍪  MACHINE À COOKIES  🍪', 256, 42);
    const lblTex = new THREE.CanvasTexture(lblC);
    lblTex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.3),
      new THREE.MeshBasicMaterial({ map: lblTex }),
    );
    lbl.position.set(-2.0, 2.85, 3.84);
    lbl.rotation.y = Math.PI;
    this.group.add(lbl);
  }

  /* ── Oven section ─────────────────────────────────────────────── */
  _buildOvenSection(bodyMat, metalMat) {
    const ovenW = 1.8, ovenH = 1.3, ovenD = 1.0;
    const ovenX = 1.0;

    // Oven housing (raised frame around cavity)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(ovenW + 0.3, ovenH + 0.2, ovenD), bodyMat,
    );
    frame.position.set(ovenX, 1.10 + ovenH / 2, 4.2);
    frame.castShadow = true; this.group.add(frame);

    // Internal cavity (dark recessed)
    const cavityMat = createMaterial(0x111111, 0.6, 0.1);
    const cavity = new THREE.Mesh(
      new THREE.BoxGeometry(ovenW - 0.1, ovenH - 0.1, ovenD - 0.1), cavityMat,
    );
    cavity.position.set(ovenX, 1.10 + ovenH / 2, 4.2);
    this.group.add(cavity);

    // Glow light inside oven
    const glowLight = new THREE.PointLight(0xff6600, 0, 4);
    glowLight.position.set(ovenX, 1.75, 4.0);
    this.group.add(glowLight);
    this.ovens[0].glowLight = glowLight;

    // ── Door (drops down, pivot at bottom front edge) ──
    const doorPivot = new THREE.Group();
    doorPivot.position.set(ovenX, 1.10, 3.72);
    this.group.add(doorPivot);
    this.ovens[0]._doorPivot = doorPivot;

    // Door frame (dark border)
    const doorFrameMat = createMaterial(0x333340, 0.3, 0.7);
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(ovenW - 0.05, ovenH - 0.15, 0.08), doorFrameMat,
    );
    doorFrame.position.set(0, (ovenH - 0.15) / 2, 0);
    doorPivot.add(doorFrame);

    // Door glass — uses oven screen canvas texture as overlay
    const screenComp = this.ovenScreens[0];
    const doorGlassMat = new THREE.MeshBasicMaterial({
      map: screenComp._texture,
      transparent: true,
      opacity: 0.92,
    });
    const doorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(ovenW - 0.15, ovenH - 0.25), doorGlassMat,
    );
    doorGlass.position.set(0, (ovenH - 0.15) / 2, -0.045);
    doorGlass.rotation.y = Math.PI;
    doorPivot.add(doorGlass);
    this.ovens[0].door = doorGlass;
    screenComp._doorGlass = doorGlass;

    // Handle (top of door)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, ovenW * 0.7, 8), metalMat,
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, ovenH - 0.25, -0.08);
    handle.castShadow = true;
    doorPivot.add(handle);

    // Door hitbox (open door — only after all cookies extracted)
    const doorHit = new THREE.Mesh(
      new THREE.BoxGeometry(ovenW, ovenH, 0.25),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    doorHit.position.set(ovenX, 1.10 + ovenH / 2, 3.65);
    doorHit.userData = { interactable: false, action: 'open_oven_door', ovenIndex: 0, label: '[Click] Ouvrir le four 🔥' };
    this.group.add(doorHit);
    this.ovens[0]._doorHit = doorHit;

    // ── Tray inside oven ──
    const tray = new THREE.Group();
    tray.position.set(ovenX, 1.25, 4.2);
    this.group.add(tray);
    this.ovens[0].tray = tray;

    const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.9), metalMat);
    trayMesh.receiveShadow = true;
    tray.add(trayMesh);

    for (const rx of [-0.75, 0.75]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.9), metalMat);
      rim.position.set(rx, 0.05, 0); tray.add(rim);
    }
    for (const rz of [-0.45, 0.45]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.04), metalMat);
      rim.position.set(0, 0.05, rz); tray.add(rim);
    }

    this.ovens[0].cookieContainer = new THREE.Group();
    this.ovens[0].cookieContainer.position.y = 0.08;
    tray.add(this.ovens[0].cookieContainer);

    // Grab tray hitbox
    const grabHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 1.0),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    grabHit.position.set(ovenX, 1.35, 3.5);
    grabHit.userData = { interactable: false, action: 'grab_tray', ovenIndex: 0, label: '[Click] 🫴 Prendre le plateau' };
    this.group.add(grabHit);
    this.ovens[0]._grabHit = grabHit;

    // Status indicator LED
    const indMat = createMaterial(0x888888, 0.2, 0.4);
    indMat.emissive = new THREE.Color(0x888888);
    indMat.emissiveIntensity = 0.3;
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), indMat);
    indicator.position.set(ovenX - ovenW / 2 - 0.05, 2.50, 4.5);
    this.group.add(indicator);
    this.ovens[0]._indicator = indicator;

    // Chimney
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8),
      createMaterial(0x555566, 0.5, 0.4),
    );
    chimney.position.set(ovenX + 0.5, 2.95, 4.4);
    chimney.castShadow = true; this.group.add(chimney);

    // ── Hitbox group on door (rotates with door) ──
    screenComp._hitboxGroup = new THREE.Group();
    screenComp._hitboxGroup.position.set(0, (ovenH - 0.15) / 2, -0.08);
    doorPivot.add(screenComp._hitboxGroup);

    // Start cooking button (on door surface)
    const startHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.25, 0.12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    startHit.position.set(0, -0.35, -0.08);
    startHit.userData = { interactable: false, action: 'start_oven', ovenIndex: 0, label: '[Click] ▶ Démarrer la cuisson' };
    doorPivot.add(startHit);
    screenComp._startButton = startHit;

    // "FOUR" label above oven
    const ovenLblC = document.createElement('canvas');
    ovenLblC.width = 256; ovenLblC.height = 48;
    const octx = ovenLblC.getContext('2d');
    octx.fillStyle = '#111'; octx.fillRect(0, 0, 256, 48);
    octx.font = 'bold 20px monospace'; octx.fillStyle = '#ff6600';
    octx.textAlign = 'center'; octx.fillText('🔥 FOUR', 128, 32);
    const ovenLblTex = new THREE.CanvasTexture(ovenLblC);
    ovenLblTex.colorSpace = THREE.SRGBColorSpace;
    const ovenLbl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.2),
      new THREE.MeshBasicMaterial({ map: ovenLblTex }),
    );
    ovenLbl.position.set(ovenX, 2.50, 3.69);
    ovenLbl.rotation.y = Math.PI;
    this.group.add(ovenLbl);
  }

  /* ── Box station + pneumatic tube ────────────────────────────── */
  _buildBoxSection(bodyMat, metalMat) {
    // Packing chute housing
    const chuteBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.0, 1.2), bodyMat,
    );
    chuteBody.position.set(3.2, 1.4, 4.0);
    chuteBody.castShadow = true; this.group.add(chuteBody);

    // Dark opening (front face)
    const holeMat = createMaterial(0x080808, 0.9, 0.0);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.06), holeMat);
    hole.position.set(3.2, 1.4, 3.39); this.group.add(hole);

    // Warning stripes (chevrons)
    const stripeMat = createMaterial(0xeab308, 0.3, 0.5);
    const stripeDark = createMaterial(0x222222, 0.5, 0.3);
    for (let i = -0.4; i <= 0.4; i += 0.2) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), stripeMat);
      stripe.position.set(3.2 + i, 1.4, 3.38);
      stripe.rotation.z = 0.5;
      this.group.add(stripe);
    }

    // "EMBALLAGE" label
    const boxLblC = document.createElement('canvas');
    boxLblC.width = 256; boxLblC.height = 48;
    const bctx = boxLblC.getContext('2d');
    bctx.fillStyle = '#111'; bctx.fillRect(0, 0, 256, 48);
    bctx.font = 'bold 20px monospace'; bctx.fillStyle = '#eab308';
    bctx.textAlign = 'center'; bctx.fillText('📦 EMBALLAGE', 128, 32);
    const boxLblTex = new THREE.CanvasTexture(boxLblC);
    boxLblTex.colorSpace = THREE.SRGBColorSpace;
    const boxLbl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.22),
      new THREE.MeshBasicMaterial({ map: boxLblTex }),
    );
    boxLbl.position.set(3.2, 2.0, 3.39);
    boxLbl.rotation.y = Math.PI;
    this.group.add(boxLbl);

    // Deposit hitbox
    const boxHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.8, 1.4),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    boxHit.position.set(3.2, 1.5, 3.6);
    boxHit.userData = { interactable: true, action: 'deposit_box', label: '[Click] 📦 Mettre en boîte' };
    this.group.add(boxHit);
    this.boxStation.hitZone = boxHit;

    // ── Pneumatic tube (goes from chute up through ceiling to space) ──
    const tubeRadius = 0.25;
    const tubeHeight = 12;
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, transparent: true, opacity: 0.18,
      roughness: 0.1, metalness: 0.3, transmission: 0.7, thickness: 0.15,
      side: THREE.DoubleSide,
    });
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight, 16, 1, true),
      tubeMat,
    );
    tube.position.set(3.2, 2.0 + tubeHeight / 2, 4.3);
    this.group.add(tube);
    this._tubeBaseY = 2.0;
    this._tubeTopY = 2.0 + tubeHeight;
    this._tubeX = 3.2;
    this._tubeZ = 4.3;

    // Tube clamps / rings at intervals
    const clampMat = createMaterial(PALETTE.metalDark, 0.2, 0.9);
    for (let cy = 2.5; cy < 2.0 + tubeHeight; cy += 2.0) {
      const clamp = new THREE.Mesh(
        new THREE.TorusGeometry(tubeRadius + 0.04, 0.03, 6, 16), clampMat,
      );
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(3.2, cy, 4.3);
      this.group.add(clamp);
    }

    // Receiver funnel at tube base
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeRadius - 0.02, tubeRadius + 0.15, 0.3, 12),
      createMaterial(PALETTE.metalDark, 0.3, 0.7),
    );
    funnel.position.set(3.2, 2.0, 4.3);
    this.group.add(funnel);

    // ── SHIP ALL button (big red, right of packaging) ──
    const shipGrp = new THREE.Group();
    shipGrp.position.set(4.0, 0.95, 3.1);

    const shipBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16),
      createMaterial(0x222222, 0.4, 0.7),
    );
    shipBase.position.y = 0.04;
    shipGrp.add(shipBase);

    const shipCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16),
      createMaterial(0xef4444, 0.3, 0.3),
    );
    shipCap.position.y = 0.13;
    shipGrp.add(shipCap);
    this._shipCapMat = shipCap.material;
    this._shipCapMat.emissive = new THREE.Color(0xef4444);
    this._shipCapMat.emissiveIntensity = 0.3;

    const shipLblC = document.createElement('canvas');
    shipLblC.width = 128; shipLblC.height = 64;
    const sctx = shipLblC.getContext('2d');
    sctx.font = 'bold 28px sans-serif';
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    sctx.fillText('\u{1F680}', 64, 32);
    const shipTex = new THREE.CanvasTexture(shipLblC);
    shipTex.colorSpace = THREE.SRGBColorSpace;
    const shipLbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ map: shipTex, transparent: true }),
    );
    shipLbl.position.set(0, 0.25, 0);
    shipLbl.rotation.x = -0.8;
    shipGrp.add(shipLbl);

    const shipHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    shipHit.position.y = 0.15;
    shipHit.userData = { interactable: true, action: 'ship_all', label: '[Click] \u{1F680} Exp\u00E9dier tout !' };
    shipGrp.add(shipHit);

    this.group.add(shipGrp);
    this._shipBtn = shipGrp;
    this._shipBtn._hit = shipHit;
  }

  /* ── Counter button (physical box sitting on counter surface) ──── */
  _makeCounterButton(x, y, z, color, emoji, action) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    // Button base (dark pedestal)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.06, 0.3),
      createMaterial(0x222222, 0.5, 0.6),
    );
    base.position.y = 0.03;
    grp.add(base);

    // Colored button cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.22),
      createMaterial(color, 0.35, 0.3),
    );
    cap.position.y = 0.1;
    grp.add(cap);

    // Emoji label (small plane floating above, facing player)
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    lbl.position.set(0, 0.22, 0);
    lbl.rotation.x = -0.5;
    grp.add(lbl);

    // Hitbox
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 0.15;
    const labels = { poll_reroll: '[Click] 🔄 Reroll', poll_confirm: '[Click] ✅ Confirmer' };
    hit.userData = { interactable: true, action, label: labels[action] || action };
    grp.add(hit);
    grp._hit = hit;

    this.group.add(grp);
    return grp;
  }

  /* ── Ship all (end-of-round dramatic launch) ──────────────── */
  shipAll(count) {
    for (let i = 0; i < Math.max(1, count); i++) {
      setTimeout(() => this.launchBox(50 + Math.random() * 200), i * 120);
    }
  }

  /* ── Tube launch animation ────────────────────────────────────── */
  launchBox(value) {
    const size = 0.2 + Math.random() * 0.1;
    const hue = Math.min(1, value / 300);
    const color = new THREE.Color().setHSL(0.1 + hue * 0.15, 0.6, 0.4 + hue * 0.2);
    const geo = new THREE.BoxGeometry(size, size * 0.6, size);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(this._tubeX, this._tubeBaseY, this._tubeZ);
    box.castShadow = true;
    this.group.add(box);

    this._tubeBoxes.push({
      mesh: box,
      y: this._tubeBaseY,
      speed: 4 + Math.random() * 3,
      spin: (Math.random() - 0.5) * 8,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
   *  TEXTURE HELPERS
   * ═══════════════════════════════════════════════════════════════════ */

  _renderRecipeTex(recipe) {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a1e'; ctx.fillRect(0, 0, 200, 200);
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(recipe.emoji, 100, 78);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(recipe.name, 100, 158);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _renderBlankTex() {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a1e'; ctx.fillRect(0, 0, 200, 200);
    ctx.font = '48px sans-serif'; ctx.fillStyle = '#222';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 100, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ═══════════════════════════════════════════════════════════════════
   *  PUBLIC API
   * ═══════════════════════════════════════════════════════════════════ */

  update(dt) {
    this.slotMachine.update(dt);
    this.doughProvider.update(dt);
    for (const oven of this.ovens) oven.update(dt);

    // Tube box animations
    for (let i = this._tubeBoxes.length - 1; i >= 0; i--) {
      const tb = this._tubeBoxes[i];
      tb.y += tb.speed * dt;
      tb.speed += 6 * dt; // accelerate
      tb.mesh.position.y = tb.y;
      tb.mesh.rotation.y += tb.spin * dt;
      // Shrink as it rises
      const progress = (tb.y - this._tubeBaseY) / (this._tubeTopY - this._tubeBaseY);
      const scale = Math.max(0.05, 1 - progress * 0.6);
      tb.mesh.scale.setScalar(scale);
      tb.mesh.material.opacity = Math.max(0, 1 - progress);
      tb.mesh.material.transparent = true;

      if (tb.y > this._tubeTopY) {
        this.group.remove(tb.mesh);
        this._tubeBoxes.splice(i, 1);
      }
    }
  }

  reset() {
    this.slotMachine.reset();
    // Clear tube animations
    for (const tb of this._tubeBoxes) this.group.remove(tb.mesh);
    this._tubeBoxes = [];
  }

  getInteractables() {
    const list = [];
    list.push(...this.slotMachine.getInteractables());
    list.push(this.doughProvider.hitZone);
    for (const oven of this.ovens) {
      if (oven._doorHit.userData.interactable) list.push(oven._doorHit);
      if (oven._grabHit.userData.interactable) list.push(oven._grabHit);
    }
    for (const screen of this.ovenScreens) {
      if (screen._startButton.userData.interactable) list.push(screen._startButton);
      for (const ch of screen._cookieHitboxes) {
        if (!ch.done) list.push(ch.hitbox);
      }
    }
    if (this.boxStation.hitZone.userData.interactable) {
      list.push(this.boxStation.hitZone);
    }
    if (this._shipBtn?._hit) list.push(this._shipBtn._hit);
    return list;
  }

  showTargetSelection(pool) { this.slotMachine.showTargetSelection(pool); }
  clearTargetSelection() { this.slotMachine.clearTargetSelection(); }
}


/* ═══════════════════════════════════════════════════════════════════════
 *  COMPONENT CLASSES
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── Slot Machine ─────────────────────────────────────────────────────

class SlotMachineComponent {
  constructor(parent) {
    this.parent = parent;
    this.group  = parent.group;
    this._state = 'idle';
    this._pullAnim = 0;
    this._craftTimer = 0;
    this._craftDuration = 2.4;
    this._craftCallback = null;
    this._shakeAmount = 0;
    this._slots = [];
    this._targetTokens = [];
    this._rerollsLeft = 0;
    this._rollTime = 0;
    this._finalRecipes = [];
    this._lockTimes = [];
    this._lockedCount = 0;
    this._craftParticles = [];

    // Sound callbacks (set by GameBridge)
    this.onTick = null;
    this.onLock = null;
    this.onCraftStart = null;
    this.onCraftDone = null;

    // World position for spatial audio
    this.worldPosition = new THREE.Vector3(-2.0, 2.0, 4.0);
  }

  startRoll(recipes, rerollsLeft) {
    this._finalRecipes = recipes; // array of recipeId strings
    this._rerollsLeft = rerollsLeft;
    this._state = 'rolling';
    this._rollTime = 0;
    this._lockedCount = 0;
    if (this._confirmBtn) this._confirmBtn.visible = false;
    this._setLeverBlink(false);
    this._lockTimes = [1.2, 1.7, 2.2, 2.7];
    for (const s of this._slots) {
      s.locked = false;
      s.cycleTimer = 0;
      s.displayIdx = Math.floor(Math.random() * this.parent._recipeList.length);
      s.borderMesh.material.color.setHex(0x333355);
      s.borderMesh.material.emissive.setHex(0x333355);
      s.borderMesh.material.emissiveIntensity = 0.2;
    }
  }

  setRerolls(n) {
    this._rerollsLeft = n;
    if (this._state === 'locked') this._setLeverBlink(n > 0);
  }

  animatePull(onDone) {
    this._pullAnim = 1.0;
    this._state = 'crafting';
    this._craftTimer = 0;
    this._craftCallback = onDone || null;
    this._shakeAmount = 0;
    if (this._craftLight) this._craftLight.intensity = 0;
    if (this.onCraftStart) this.onCraftStart();
  }

  /** Keep recipes displayed and set lever to blink red (ready to pull). */
  lockRecipesAndReady() {
    this._state = 'ready';
    this._setLeverBlink(true, 0xff2222);
    if (this._confirmBtn) this._confirmBtn.visible = false;
  }

  /** Lever blinks green — pull to start cooking. */
  setOvenStart() {
    this._state = 'oven_start';
    this._setLeverBlink(true, 0x22c55e);
  }

  /** Back to red — pull to generate next batch. */
  setReadyToPull() {
    this._state = 'ready';
    this._setLeverBlink(true, 0xff2222);
  }

  activate() {
    for (const s of this._slots) {
      s.borderMesh.material.color.setHex(0x4488ff);
      s.borderMesh.material.emissive.setHex(0x4488ff);
      s.borderMesh.material.emissiveIntensity = 0.6;
    }
    if (this._craftLight) {
      this._craftLight.intensity = 0.8;
      this._craftLight.color.setHex(0x4488ff);
    }
  }

  reset() {
    this._state = 'idle';
    this._pullAnim = 0;
    this._craftTimer = 0;
    this._shakeAmount = 0;
    if (this._craftLight) this._craftLight.intensity = 0;
    if (this.leverPivot) this.leverPivot.rotation.x = 0;
    this.clearTargetSelection();
    this._setLeverBlink(false);
    if (this._confirmBtn) this._confirmBtn.visible = false;
    if (this._cabinet) { this._cabinet.position.x = -2.0; }
    this._keepRecipes = false;

    for (const s of this._slots) {
      s.locked = false;
      s.plane.material.map = this.parent._blankTex;
      s.plane.material.needsUpdate = true;
      s.borderMesh.material.color.setHex(0x333355);
      s.borderMesh.material.emissive.setHex(0x333355);
      s.borderMesh.material.emissiveIntensity = 0.2;
    }

    for (const p of this._craftParticles) {
      if (p.mesh) this.parent.group.remove(p.mesh);
    }
    this._craftParticles = [];
  }

  showTargetSelection(pool) {
    this._state = 'target_select';
    this.clearTargetSelection();

    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      const recipe = getRecipe(entry.recipeId);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = -2.0 + (col - 1) * 1.0;
      const y = 2.2 - row * 1.1;
      const z = 3.5;

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.8),
        new THREE.MeshBasicMaterial({ map: this.parent._texCache[entry.recipeId], transparent: true }),
      );
      plane.position.set(x, y, z + 0.1);
      this.parent.group.add(plane);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.3),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x, y, z);
      hit.userData = {
        interactable: true, action: 'target_select',
        recipeId: entry.recipeId,
        label: `[Click] ${recipe.emoji} ${recipe.name}`,
      };
      this.parent.group.add(hit);
      this._targetTokens.push({ plane, hit });
    }
  }

  clearTargetSelection() {
    for (const t of this._targetTokens) {
      this.parent.group.remove(t.plane);
      this.parent.group.remove(t.hit);
    }
    this._targetTokens = [];
    if (this._state === 'target_select') this._state = 'idle';
  }

  getInteractables() {
    const list = [];
    if (this._state === 'locked') {
      if (this._confirmBtn?.visible) list.push(this._confirmBtn._hit);
    }
    if (this._state === 'target_select') {
      for (const t of this._targetTokens) list.push(t.hit);
    }
    if (this.lever && (this._state === 'locked' || this._state === 'ready' || this._state === 'idle' || this._state === 'oven_start')) {
      list.push(this.lever);
    }
    return list;
  }

  update(dt) {
    // ── Rolling ──
    if (this._state === 'rolling') this._updateRoll(dt);

    // ── Lever spring-back ──
    if (this._pullAnim > 0) {
      this._pullAnim -= dt * 2.5;
      if (this._pullAnim < 0) this._pullAnim = 0;
      if (this.leverPivot) {
        this.leverPivot.rotation.x = -Math.sin(this._pullAnim * Math.PI) * 0.6;
      }
    }

    // ── Crafting ──
    if (this._state === 'crafting') this._updateCraft(dt);

    // ── Shake ──
    if (this._shakeAmount > 0 && this._state !== 'crafting') {
      this._shakeAmount -= dt * 3;
      if (this._shakeAmount < 0) this._shakeAmount = 0;
    }
    if (this._cabinet) {
      if (this._shakeAmount > 0) {
        this._cabinet.position.x = -2.0 + (Math.random() - 0.5) * this._shakeAmount * 0.08;
      } else {
        this._cabinet.position.x = -2.0;
      }
    }

    // ── Lever blink ──
    if (this._leverBlinking && this._leverBall) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
      this._leverBall.material.emissive.setHex(this._leverBlinkColor || 0x3b82f6);
      this._leverBall.material.emissiveIntensity = pulse;
    }

    // ── Craft light state ──
    const t = Date.now() * 0.001;
    if (this._state === 'rolling' && this._craftLight) {
      this._craftLight.intensity = 1.0 + Math.sin(t * 10) * 0.5;
      this._craftLight.color.setHex(0x3b82f6);
    } else if (this._state === 'ready' && this._craftLight) {
      this._craftLight.intensity = 0.6 + Math.sin(t * 3) * 0.3;
      this._craftLight.color.setHex(0xff2222);
    } else if (this._state === 'oven_start' && this._craftLight) {
      this._craftLight.intensity = 0.6 + Math.sin(t * 3) * 0.3;
      this._craftLight.color.setHex(0x22c55e);
    } else if (this._state === 'target_select' && this._craftLight) {
      this._craftLight.intensity = 1.5;
      this._craftLight.color.setHex(0xa855f7);
    } else if (this._state === 'idle' && this._craftLight && this._pullAnim <= 0) {
      this._craftLight.intensity = 0;
    }

    // ── Particles ──
    this._updateParticles(dt);
  }

  _updateRoll(dt) {
    this._rollTime += dt;
    for (let i = 0; i < 4; i++) {
      const slot = this._slots[i];
      if (slot.locked) continue;

      if (this._rollTime >= this._lockTimes[i]) {
        // Lock in
        slot.locked = true;
        this._lockedCount++;
        const finalId = this._finalRecipes[i]; // string recipeId
        slot.plane.material.map = this.parent._texCache[finalId] || this.parent._blankTex;
        slot.plane.material.needsUpdate = true;
        slot.borderMesh.material.color.setHex(0x22c55e);
        slot.borderMesh.material.emissive.setHex(0x22c55e);
        slot.borderMesh.material.emissiveIntensity = 0.8;
        if (this.onLock) this.onLock();
      } else {
        // Cycling
        slot.cycleTimer -= dt;
        if (slot.cycleTimer <= 0) {
          const remaining = this._lockTimes[i] - this._rollTime;
          const slowdown = Math.max(0, 1 - remaining / 0.5);
          slot.cycleTimer = 0.05 + slowdown * 0.2;
          slot.displayIdx = (slot.displayIdx + 1) % this.parent._recipeList.length;
          const rId = this.parent._recipeList[slot.displayIdx].id;
          slot.plane.material.map = this.parent._texCache[rId] || this.parent._blankTex;
          slot.plane.material.needsUpdate = true;
          slot.borderMesh.material.emissiveIntensity = 0.5;
          if (this.onTick) this.onTick();
        } else {
          slot.borderMesh.material.emissiveIntensity *= 0.90;
        }
      }
    }

    if (this._lockedCount >= 4 && this._state === 'rolling') {
      this._state = 'locked';
      this._setLeverBlink(this._rerollsLeft > 0);
      if (this._confirmBtn) this._confirmBtn.visible = true;
    }
  }

  _updateCraft(dt) {
    this._craftTimer += dt;
    const progress = Math.min(1, this._craftTimer / this._craftDuration);

    // Shake
    this._shakeAmount = progress < 0.7
      ? progress / 0.7
      : 1.0 - (progress - 0.7) / 0.3;

    // Glow
    if (this._craftLight) {
      this._craftLight.intensity = 1.5 + Math.sin(this._craftTimer * 15) * 0.8;
      this._craftLight.color.setHex(progress < 0.5 ? 0xff6600 : 0xffaa00);
    }

    // Particles
    if (Math.random() < dt * 12) this._spawnParticle();

    // Done
    if (progress >= 1) {
      this._state = 'idle';
      this._shakeAmount = 0;
      if (this._craftLight) this._craftLight.intensity = 0;
      if (this.onCraftDone) this.onCraftDone();
      if (this._craftCallback) {
        this._craftCallback();
        this._craftCallback = null;
      }
    }
  }

  _spawnParticle() {
    const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0xffcc44 : 0xff8844,
      transparent: true, opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      -2.0 + (Math.random() - 0.5) * 1.5,
      3.0 + Math.random() * 0.5,
      4.0 + (Math.random() - 0.5) * 0.4,
    );
    this.parent.group.add(mesh);
    this._craftParticles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 0.5,
      ),
      life: 0.4 + Math.random() * 0.4,
    });
  }

  _setLeverBlink(active, color = 0x3b82f6) {
    this._leverBlinking = active;
    this._leverBlinkColor = color;
    if (!active && this._leverBall) {
      this._leverBall.material.emissiveIntensity = 0;
      this._leverBall.material.emissive.setHex(0x000000);
    }
    // Update lever label
    if (this.lever) {
      if (color === 0xff2222 && active) {
        this.lever.userData.label = '[Click] 🎰 Tirer le levier !';
      } else {
        this.lever.userData.label = active
          ? '[Click] 🔄 Reroll (levier)'
          : '[Click] Tirer le levier 🎰';
      }
    }
  }

  _updateParticles(dt) {
    for (let i = this._craftParticles.length - 1; i >= 0; i--) {
      const p = this._craftParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parent.group.remove(p.mesh);
        this._craftParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 1.5 * dt;
      p.mesh.material.opacity = Math.max(0, p.life * 1.5);
      p.mesh.scale.multiplyScalar(1 + dt * 0.8);
    }
  }
}


// ─── Dough Provider ───────────────────────────────────────────────────

class DoughProviderComponent {
  constructor(parent) {
    this.parent = parent;
    this.group  = parent.group;
    this._pourAnim = 0;
    this._particles = [];
  }

  pour() {
    this._pourAnim = 1.0;
    // Spawn falling dough particles
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf5deb3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        -2.0 + (Math.random() - 0.5) * 0.12,
        2.8,
        4.1 + (Math.random() - 0.5) * 0.12,
      );
      this.parent.group.add(mesh);
      this._particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          -2 - Math.random() * 2,
          (Math.random() - 0.5) * 0.3,
        ),
        life: 0.5 + Math.random() * 0.3,
      });
    }
  }

  setPasteLevel(current, max) {
    const pct = max > 0 ? current / max : 0;
    if (this.doughFill) {
      this.doughFill.scale.y = Math.max(0.05, pct);
      this.doughFill.position.y = 3.1 + pct * 0.4;
    }
  }

  update(dt) {
    if (this._pourAnim > 0) {
      this._pourAnim -= dt * 2;
      if (this._pourAnim < 0) this._pourAnim = 0;
      if (this.doughFill) {
        this.doughFill.scale.y = Math.max(0.05, this.doughFill.scale.y - dt * 0.3);
      }
    }
    // Particles
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parent.group.remove(p.mesh);
        this._particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
    }
  }
}


// ─── Oven ─────────────────────────────────────────────────────────────

class OvenComponent {
  constructor(parent, index) {
    this.parent = parent;
    this.group  = parent.group;
    this.index  = index;
    this._cookieModels = [];
    this._doorOpen = 0;
    this._doorTarget = 0;
    this._shakeAmount = 0;

    // World position for spatial audio
    this.worldPosition = new THREE.Vector3(1.0, 1.65, 4.0);
  }

  _clearCookies() {
    while (this.cookieContainer && this.cookieContainer.children.length > 0) {
      this.cookieContainer.remove(this.cookieContainer.children[0]);
    }
    this._cookieModels = [];
  }

  loadBox(box) {
    this._clearCookies();
    if (this._indicator) {
      this._indicator.material.color.setHex(0x22c55e);
      this._indicator.material.emissive.setHex(0x22c55e);
      this._indicator.material.emissiveIntensity = 0.8;
    }

    if (!box.grid) return;
    const cols = box.grid.length;
    const rows = box.grid[0]?.length ?? 5;
    const spacingX = 0.32, spacingZ = 0.18;
    const offsetX = -(cols - 1) * spacingX / 2;
    const offsetZ = -(rows - 1) * spacingZ / 2;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cell = box.grid[col][row];
        const recipeId = cell?.recipeId || cell;
        if (!recipeId) continue;

        const cookie = CookieModel.createMini(typeof recipeId === 'string' ? recipeId : 'choco');
        cookie.scale.setScalar(1.4);
        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;
        cookie.position.set(x, 0.04, z);
        this.cookieContainer.add(cookie);

        // Progress ring (flat torus under cookie)
        const ringGeo = new THREE.TorusGeometry(0.1, 0.012, 4, 20);
        const ringMat = new THREE.MeshBasicMaterial({ color: ZONE_COLORS.RAW });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.01, z);
        this.cookieContainer.add(ring);

        this._cookieModels.push({
          mesh: cookie, ring, col, row, done: false,
          recipeId: typeof recipeId === 'string' ? recipeId : recipeId?.recipeId,
        });
      }
    }

    if (this.glowLight) this.glowLight.intensity = 0.5;
  }

  setProgresses(cookieStates) {
    if (!cookieStates || !this._cookieModels.length) return;
    const rows = 5;

    for (const cm of this._cookieModels) {
      if (cm.done) continue;
      const ci = cm.col * rows + cm.row;
      const cs = cookieStates[ci];
      if (!cs) continue;

      const progress = Math.min(1, cs.progress);
      let zone = 'RAW', color = ZONE_COLORS.RAW;
      if (progress >= 0.85)      { zone = 'BURNED';  color = ZONE_COLORS.BURNED; }
      else if (progress >= 0.70) { zone = 'PERFECT'; color = ZONE_COLORS.PERFECT; }
      else if (progress >= 0.30) { zone = 'COOKED';  color = ZONE_COLORS.COOKED; }

      cm.ring.material.color.setHex(color);

      const mat = cm.mesh.material;
      if (zone === 'PERFECT') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.015) * 0.3;
        cm.mesh.scale.setScalar(1.4 + Math.sin(Date.now() * 0.012) * 0.08);
      } else if (zone === 'BURNED') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 0.3 + Math.random() * 0.3;
        cm.mesh.scale.setScalar(1.2);
      } else if (zone === 'COOKED') {
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setHex(0xeab308);
        mat.emissiveIntensity = 0.15;
        cm.mesh.scale.setScalar(1.4);
      } else {
        if (mat.emissive) mat.emissiveIntensity = 0;
        cm.mesh.scale.setScalar(1.4);
      }
    }
  }

  cookieExtracted(col, row, cookingResult) {
    const cm = this._cookieModels.find(c => c.col === col && c.row === row);
    if (!cm) return;
    cm.done = true;
    // Animate fly-away
    const startScale = cm.mesh.scale.x;
    const startY = cm.mesh.position.y;
    let t = 0;
    const animate = () => {
      t += 0.05;
      if (t >= 1) { cm.mesh.visible = false; cm.ring.visible = false; return; }
      const ease = 1 - Math.pow(1 - t, 3);
      cm.mesh.position.y = startY + ease * 1.2;
      cm.mesh.scale.setScalar(startScale * (1 - ease * 0.8));
      cm.mesh.rotation.y += 0.3;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  cookieBurned(col, row) {
    const cm = this._cookieModels.find(c => c.col === col && c.row === row);
    if (!cm) return;
    cm.done = true;
    cm.mesh.material.color.setHex(0x1a1a1a);
    if (cm.mesh.material.emissive) {
      cm.mesh.material.emissive.setHex(0x330000);
      cm.mesh.material.emissiveIntensity = 0.2;
    }
    cm.mesh.scale.setScalar(1.1);
    cm.ring.material.color.setHex(ZONE_COLORS.BURNED);
    this._shakeAmount = 0.3;
  }

  showReady() {
    if (this._doorHit) this._doorHit.userData.interactable = true;
    if (this._indicator) {
      this._indicator.material.color.setHex(0x22c55e);
      this._indicator.material.emissive.setHex(0x22c55e);
    }
  }

  openDoor() {
    this._doorTarget = 1;
    if (this._doorHit) this._doorHit.userData.interactable = false;
    setTimeout(() => {
      if (this._grabHit) this._grabHit.userData.interactable = true;
    }, 400);
  }

  trayGrabbed() {
    if (this._grabHit) this._grabHit.userData.interactable = false;
    if (this.tray) this.tray.visible = false;
    setTimeout(() => { this._doorTarget = 0; }, 300);
  }

  boxComplete() {
    this._clearCookies();
    if (this.glowLight) this.glowLight.intensity = 0;
    if (this.tray) this.tray.visible = true;
    this._doorTarget = 0;
    this._doorOpen = 0;
    if (this._doorPivot) this._doorPivot.rotation.x = 0;
    if (this._grabHit) this._grabHit.userData.interactable = false;
    if (this._doorHit) this._doorHit.userData.interactable = false;
    if (this._indicator) {
      this._indicator.material.color.setHex(0x888888);
      this._indicator.material.emissive.setHex(0x888888);
      this._indicator.material.emissiveIntensity = 0.3;
    }
  }

  setIndicator(active) {
    if (!this._indicator) return;
    const color = active ? 0x22c55e : 0x888888;
    this._indicator.material.color.setHex(color);
    this._indicator.material.emissive.setHex(color);
    this._indicator.material.emissiveIntensity = active ? 0.6 : 0.3;
  }

  update(dt) {
    // Shake
    if (this._shakeAmount > 0) {
      this._shakeAmount -= dt * 3;
      if (this._shakeAmount < 0) this._shakeAmount = 0;
    }

    // Glow flicker when cooking
    const anyCooking = this._cookieModels.some(c => !c.done);
    if (anyCooking && this.glowLight) {
      this.glowLight.intensity = 1.0 + Math.random() * 0.8;
    }

    // Door drop-down animation
    if (this._doorOpen < this._doorTarget) {
      this._doorOpen = Math.min(this._doorTarget, this._doorOpen + dt * 2.0);
    } else if (this._doorOpen > this._doorTarget) {
      this._doorOpen = Math.max(this._doorTarget, this._doorOpen - dt * 2.0);
    }
    if (this._doorPivot) {
      this._doorPivot.rotation.x = this._doorOpen * Math.PI * 0.45;
    }
  }
}


// ─── Oven Screen ──────────────────────────────────────────────────────

const ZONE_COLORS_HEX = {
  RAW: '#3b82f6', COOKED: '#eab308', PERFECT: '#22c55e',
  SWEET_SPOT: '#a855f7', BURNED: '#ef4444',
};

class OvenScreenComponent {
  constructor(parent, index) {
    this.parent = parent;
    this.index  = index;

    // Canvas sized to match door aspect ratio (~1.57:1)
    this._canvas = document.createElement('canvas');
    this._canvas.width = 520; this._canvas.height = 340;
    this._ctx = this._canvas.getContext('2d');
    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._texture.minFilter = THREE.LinearFilter;

    this._cookieHitboxes = [];
    this._cookieStates = null;
    this._cooking = false;
    this._gridCols = 0;
    this._gridRows = 0;
    this._box = null;

    this._drawIdle();
  }

  _drawIdle() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#33384488';
    ctx.textAlign = 'center';
    ctx.fillText('FOUR EN ATTENTE', W / 2, H / 2);
    this._texture.needsUpdate = true;
  }

  _drawWaitingForStart() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.fillStyle = 'rgba(5, 5, 15, 0.75)';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText('\u{1F36A} COOKIES CHARG\u00C9S', W / 2, H / 2 - 30);

    ctx.font = 'bold 34px monospace'; ctx.fillStyle = '#ffffff';
    ctx.fillText('\u25B6  D\u00C9MARRER', W / 2, H / 2 + 20);

    ctx.font = '16px monospace'; ctx.fillStyle = '#666';
    ctx.fillText('Cliquez sur la vitre', W / 2, H / 2 + 55);
    this._texture.needsUpdate = true;
  }

  loadBox(box) {
    this._box = box;
    this._cooking = false;
    this._clearHitboxes();
    if (!box?.grid) return;
    this._gridCols = box.grid.length;
    this._gridRows = box.grid[0]?.length ?? 5;
    // Show grid layout immediately (lever will start cooking)
    const total = this._gridCols * this._gridRows;
    this._cookieStates = Array.from({length: total}, () => ({ progress: 0, done: false }));
    this._render();
  }

  startCooking() {
    this._cooking = true;
    if (this._startButton) this._startButton.userData.interactable = false;
    this._createCookieHitboxes();
  }

  _createCookieHitboxes() {
    this._clearHitboxes();
    if (!this._box?.grid || !this._hitboxGroup) return;

    const cols = this._gridCols, rows = this._gridRows;
    const cellW = 1.3 / cols, cellH = 0.75 / rows;
    const startX = -0.65 + cellW / 2;
    const startY = 0.35 - cellH / 2;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const x = startX + col * cellW;
        const y = startY - row * cellH;
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(cellW * 0.85, cellH * 0.85, 0.12),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.position.set(-x, y, 0);
        hit.userData = {
          interactable: true, action: 'extract_cookie',
          ovenIndex: this.index, col, row, label: '',
        };
        this._hitboxGroup.add(hit);
        this._cookieHitboxes.push({ hitbox: hit, col, row, done: false });
      }
    }
  }

  setCookieStates(cookieStates) {
    this._cookieStates = cookieStates;
    if (!this._cooking) return;
    this._render();

    if (!cookieStates) return;
    const rows = this._gridRows;
    for (const ch of this._cookieHitboxes) {
      if (ch.done) continue;
      const ci = ch.col * rows + ch.row;
      const cs = cookieStates[ci];
      if (!cs || cs.done) {
        ch.hitbox.userData.interactable = false;
        ch.done = true;
        continue;
      }
      const p = Math.min(1, cs.progress);
      let zone = 'RAW';
      if (p >= 0.85) zone = 'BURNED';
      else if (p >= 0.70) zone = 'PERFECT';
      else if (p >= 0.30) zone = 'COOKED';

      const icons = { RAW: '\u{1F535}', COOKED: '\u{1F7E1}', PERFECT: '\u{1F7E2}', BURNED: '\u{1F534}' };
      const names = { RAW: 'CRU', COOKED: 'CUIT', PERFECT: 'PARFAIT', BURNED: 'BR\u00DBL\u00C9' };
      ch.hitbox.userData.label = `[Click] ${icons[zone]} ${names[zone]} (${Math.round(p * 100)}%)`;
    }
  }

  cookieExtracted(col, row) {
    const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);
    if (ch) { ch.done = true; ch.hitbox.userData.interactable = false; }
    this._render();
  }

  cookieBurned(col, row) {
    const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);
    if (ch) { ch.done = true; ch.hitbox.userData.interactable = false; }
    this._render();
  }

  boxComplete() {
    this._cooking = false;
    this._clearHitboxes();
    this._box = null;
    this._cookieStates = null;
    if (this._startButton) this._startButton.userData.interactable = false;
    this._drawIdle();
  }

  _clearHitboxes() {
    if (this._hitboxGroup) {
      for (const c of this._cookieHitboxes) this._hitboxGroup.remove(c.hitbox);
    }
    this._cookieHitboxes = [];
  }

  _render() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;

    // Semi-transparent background (shows oven glow through)
    ctx.fillStyle = 'rgba(6, 6, 14, 0.82)';
    ctx.fillRect(0, 0, W, H);

    if (!this._box || !this._cookieStates) { this._drawIdle(); return; }

    const cols = this._gridCols, rows = this._gridRows;
    const pad = 16;
    const headerH = 32;
    const cellW = (W - pad * 2) / cols;
    const cellH = (H - pad * 2 - headerH) / rows;
    const startX = pad;
    const startY = pad + headerH;

    // Header
    ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#ff8c00';
    ctx.textAlign = 'center';
    ctx.fillText('\u{1F525} FOUR ' + (this.index + 1), W / 2, pad + 18);

    // Thin header line
    ctx.strokeStyle = '#ff880044';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, startY - 4); ctx.lineTo(W - pad, startY - 4); ctx.stroke();

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        // Reverse col order on canvas to match rotation.y=PI flip
        const x = startX + (cols - 1 - col) * cellW;
        const y = startY + row * cellH;
        const ci = col * rows + row;
        const cs = this._cookieStates[ci];
        const ch = this._cookieHitboxes.find(c => c.col === col && c.row === row);
        if (!cs) continue;

        const p = Math.min(1, cs.progress);
        let zone = 'RAW';
        if (cs.done && ch?.done) zone = 'EXTRACTED';
        else if (p >= 0.85) zone = 'BURNED';
        else if (p >= 0.70) zone = 'PERFECT';
        else if (p >= 0.30) zone = 'COOKED';

        const cx = x + cellW / 2, cy = y + cellH / 2;
        const cw = cellW - 6, ch2 = cellH - 6;

        if (zone === 'EXTRACTED') {
          ctx.fillStyle = 'rgba(20,20,30,0.5)';
          this._roundRect(ctx, x + 3, y + 3, cw, ch2, 4);
          ctx.fill();
          ctx.font = '20px sans-serif'; ctx.fillStyle = '#2a5a2a';
          ctx.textAlign = 'center';
          ctx.fillText('\u2713', cx, cy + 7);
          continue;
        }

        const zoneColor = ZONE_COLORS_HEX[zone] || '#444';

        // Cell background with subtle zone tint
        const bgAlpha = zone === 'PERFECT' ? 0.25 : zone === 'BURNED' ? 0.2 : 0.08;
        ctx.fillStyle = zone === 'PERFECT'
          ? 'rgba(34,197,94,' + (bgAlpha + Math.sin(Date.now() * 0.01) * 0.1) + ')'
          : zone === 'BURNED'
            ? 'rgba(239,68,68,' + (bgAlpha + Math.random() * 0.08) + ')'
            : 'rgba(255,255,255,' + bgAlpha + ')';
        this._roundRect(ctx, x + 3, y + 3, cw, ch2, 4);
        ctx.fill();

        // Cell border
        ctx.strokeStyle = zoneColor;
        ctx.lineWidth = zone === 'PERFECT' ? 2.5 : 1.5;
        this._roundRect(ctx, x + 3, y + 3, cw, ch2, 4);
        ctx.stroke();

        // Cookie emoji (centered, large)
        const cell = this._box.grid[col] && this._box.grid[col][row];
        if (cell) {
          const emojiSize = Math.floor(Math.min(cw, ch2) * 0.55);
          ctx.font = emojiSize + 'px sans-serif';
          ctx.textAlign = 'center';
          const rid = cell.recipeId || cell;
          ctx.fillText(this._getEmoji(rid), cx, cy + emojiSize * 0.15);
        }

        // Progress bar (bottom of cell)
        const barW = cw - 8, barH = 5;
        const barX = x + 3 + 4, barY = y + 3 + ch2 - barH - 3;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        this._roundRect(ctx, barX, barY, barW, barH, 2);
        ctx.fill();
        ctx.fillStyle = zoneColor;
        this._roundRect(ctx, barX, barY, barW * p, barH, 2);
        ctx.fill();

        // Percentage (top-right, subtle)
        ctx.font = '10px monospace'; ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(p * 100) + '%', x + cw + 1, y + 14);
      }
    }

    // Status overlay when loaded but not yet cooking
    if (!this._cooking) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, H - 36, W, 36);
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'center';
      ctx.fillText('\u25B6 TIREZ LE LEVIER VERT', W / 2, H - 14);
    }

    this._texture.needsUpdate = true;
  }

  /** Draw a rounded rectangle path. */
  _roundRect(ctx, x, y, w, h, r) {
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

  _getEmoji(recipeId) {
    const map = {
      choco: '\u{1F36B}', vanilla: '\u{1F366}', strawberry: '\u{1F353}', lemon: '\u{1F34B}',
      peanut: '\u{1F95C}', butter: '\u{1F9C8}', cinnamon: '\u{1FAD0}', hazelnut: '\u{1F330}',
      caramel: '\u{1F36F}', matcha: '\u{1F375}', coconut: '\u{1F965}', macaron: '\u{1F9C1}',
      truffle: '\u{1F36C}', golden: '\u2728', joker: '\u{1F0CF}',
    };
    return map[recipeId] || '\u{1F36A}';
  }
}


// ─── Box Station ──────────────────────────────────────────────────────

class BoxStationComponent {
  constructor(parent) {
    this.parent = parent;
    this.hitZone = null;
  }
}
