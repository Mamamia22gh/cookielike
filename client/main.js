import * as THREE from 'three';
import { createGame } from '../src/index.js';
import { GameBridge } from './GameBridge.js';
import { FactoryScene } from './scenes/FactoryScene.js';
import { HUD3D } from './ui/HUD3D.js';
import { AudioManager } from './audio/AudioManager.js';
import { MusicSystem } from './audio/MusicSystem.js';
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
    this.music = new MusicSystem();
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
    lockOverlay.addEventListener('click', () => {
      controls.lock();
      // Init audio on first interaction
      if (!this._audioStarted) {
        this._audioStarted = true;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Start music
        this.music.init(ctx);
        this.music.start();
        // Start air vent hissing
        for (const vent of this.factory.airVents) {
          vent.startSound(ctx);
        }
      }
    });
    controls.addEventListener('lock', () => lockOverlay.classList.add('hidden'));
    controls.addEventListener('unlock', () => lockOverlay.classList.remove('hidden'));
  }

  _bindInputs() {
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
