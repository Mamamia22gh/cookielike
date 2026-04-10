import * as THREE from 'three';
import { createGame } from '../src/index.js';
import { GameBridge } from './GameBridge.js';
import { FactoryScene } from './scenes/FactoryScene.js';
import { HUD3D } from './ui/HUD3D.js';
import { AudioManager } from './audio/AudioManager.js';
import { createPostFX } from './postprocessing/PostFX.js';
import './styles/ui.css';

/**
 * First-person cookie factory game.
 * No HTML UI — everything is 3D or rendered via orthographic HUD overlay.
 * All interactions are click-based (no keyboard shortcuts for game actions).
 */
class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 2.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;

    this.clock = new THREE.Clock();
    this.game = createGame({ seed: Date.now() });
    this.factory = new FactoryScene(this.renderer);
    this.hud = new HUD3D();
    this.audio = new AudioManager();
    this.bridge = new GameBridge(this.game, this.factory, this.hud, this.audio);

    // Post-processing
    this.postfx = createPostFX(this.renderer, this.factory.scene, this.factory.camera);

    this._setupPointerLock();
    this._bindInputs();
    window.addEventListener('resize', () => this._onResize());
    this._loop();
  }

  _setupPointerLock() {
    const lockOverlay = document.getElementById('lock-overlay');
    const controls = this.factory.controls;
    
    // We start in MENU mode. Hide overlay if it exists.
    if (lockOverlay) lockOverlay.classList.add('hidden');

    // Menu state
    this._inMenu = true;
    this._audioStarted = false;
    this.factory.camera.position.set(0.6, 1.35, -2.2);
    this.factory.camera.rotation.set(-0.12, 0.25, 0);

    // Wire up CRT terminal menu callback
    this.factory.terminal.setActionCallback((action) => {
      if (action === 'start_run') {
        this._startFirstPerson();
      } else if (action === 'start_round') {
        this.bridge.interact({ action: 'start_round' });
      } else if (action === 'continue_results') {
        this.bridge.interact({ action: 'continue_results' });
      }
    });

    // The user clicks to start the interaction
    this.canvas.addEventListener('click', () => {
      if (!this._audioStarted) {
        this._audioStarted = true;
        const ctx = this.factory.listener.context;
        this.audio.init(ctx);
        
        // Start radio with intro glitch
        this.factory.radio.start(ctx, [
          'music/chevalier_paris.mp3',
          'music/les_amants_de_paris.mp3',
          'music/montand_boulevards.mp3',
          'music/tout_le_jour.mp3',
          'music/satie_gymnopedie.mp3',
          'music/musette_mektoub.mp3',
          'music/la_mer.mp3',
          'music/plus_beau_tango.mp3',
          'music/piaf_la_vie_en_rose.mp3',
          'music/piaf_trois_cloches.mp3',
          'music/baker_paris_paris.mp3',
          'music/greco_si_tu_timagines.mp3',
        ], true);
        
        for (const vent of this.factory.airVents) {
          vent.startSound(ctx);
        }
      }

      if (this._inMenu) {
        // If in menu, handle click via raycaster
        const inter = this._getMenuInteractableAt();
        if (inter) {
          this.audio.play('click');
          if (inter.action.startsWith('key_')) {
            // Keyboard key pressed — forward to terminal menu
            this.factory.terminal.handleKey(inter.action);
          } else if (inter.action === 'radio_next') {
            this.factory.radio.nextTrack();
          } else if (inter.action === 'start_run') {
            // Direct button press
            this._startFirstPerson();
          }
        }
      } else {
        // First person mode lock check
        if (!controls.isLocked) controls.lock();
      }
    });

    controls.addEventListener('lock', () => {
      if (lockOverlay) lockOverlay.classList.add('hidden');
    });
    controls.addEventListener('unlock', () => {
      if (!this._inMenu && lockOverlay) lockOverlay.classList.remove('hidden');
    });
  }

  _startFirstPerson() {
    this._inMenu = false;
    this.audio.play('click');
    // Animate camera to player position
    const startPos = this.factory.camera.position.clone();
    const startRotX = this.factory.camera.rotation.x;
    const startRotY = this.factory.camera.rotation.y;
    const targetPos = new THREE.Vector3(0, 1.7, -3.0);
    
    let t = 0;
    const anim = () => {
      t += 0.05;
      if (t >= 1) {
        this.factory.controls.lock();
        this.game.startRun();
        return;
      }
      const ease = 1 - Math.pow(1 - t, 3);
      this.factory.camera.position.lerpVectors(new THREE.Vector3(0.6, 1.35, -2.2), targetPos, ease);
      this.factory.camera.rotation.x = startRotX * (1 - ease);
      this.factory.camera.rotation.y = startRotY * (1 - ease);
      requestAnimationFrame(anim);
    };
    anim();
  }

  _getMenuInteractableAt() {
    if (!this._mouse) return null;
    this.factory.raycaster.setFromCamera(this._mouse, this.factory.camera);
    // Terminal keys + buttons
    const targets = this.factory.terminal.getInteractables();
    // Radio hitzone
    targets.push(this.factory.radio.hitZone);
    for (const mesh of targets) {
      const intersects = this.factory.raycaster.intersectObject(mesh, true);
      if (intersects.length > 0) return mesh.userData;
    }
    return null;
  }

  _bindInputs() {
    this._mouse = new THREE.Vector2();
    document.addEventListener('mousemove', (e) => {
      this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // ── Movement only (AZERTY + QWERTY) ──
    document.addEventListener('keydown', (e) => {
      if (!this.factory.controls.isLocked) return;
      this.factory.setMoveState(e.key.toLowerCase(), true);
    });

    document.addEventListener('keyup', (e) => {
      this.factory.setMoveState(e.key.toLowerCase(), false);
    });

    // ── All interactions are click-based ──
    this.canvas.addEventListener('click', () => {
      if (!this.factory.controls.isLocked) return;
      const interactable = this.factory.getInteractableAt();
      if (interactable) this.bridge.interact(interactable);
    });
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.factory.camera.aspect = w / h;
    this.factory.camera.updateProjectionMatrix();
    this.postfx.resize(w, h);
  }

  _loop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = this.clock.getDelta();
      if (this.game.getPhase() === 'PRODUCTION') this.game.update(dt * 1000);
      this.factory.update(dt);
      this.bridge.updateHUD();
      if (this.factory.controls.isLocked) {
        const inter = this.factory.getInteractableAt();
        this.hud.setHint(inter?.label || '');
      } else {
        this.hud.setHint('');
      }

      // ── Render with post-processing ──
      this.postfx.update(dt);
      this.postfx.render();

      // HUD overlay on top
      this.renderer.clearDepth();
      this.hud.render();
      this.renderer.render(this.hud.scene, this.hud.camera);
    };
    animate();
  }
}

window.addEventListener('DOMContentLoaded', () => new App());
