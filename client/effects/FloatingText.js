import * as THREE from 'three';
import { createTextSprite } from '../utils/TextSprite.js';

/**
 * Floating score / combo text that rises and fades.
 */
export class FloatingTextSystem {
  constructor(scene) {
    this.scene = scene;
    this._texts = [];
  }

  /**
   * Spawn a floating text at a world position.
   */
  spawn(text, position, {
    color = '#ffd700',
    fontSize = 36,
    duration = 2.0,
    rise = 2.5,
    bgAlpha = 0.6,
  } = {}) {
    const sprite = createTextSprite(text, {
      fontSize, color, bgAlpha, padding: 10,
    });
    sprite.position.copy(position);
    this.scene.add(sprite);

    this._texts.push({
      sprite,
      startY: position.y,
      time: 0,
      duration,
      rise,
    });
  }

  /** Shortcut: gold score popup. */
  score(value, position) {
    this.spawn(`+${value} 🪙`, position, { color: '#ffd700', fontSize: 40, rise: 3 });
  }

  /** Shortcut: zone indicator. */
  zone(zoneName, position) {
    const colors = {
      PERFECT: '#22c55e',
      SWEET_SPOT: '#a855f7',
      COOKED: '#eab308',
      RAW: '#3b82f6',
      BURNED: '#ef4444',
    };
    this.spawn(zoneName, position, {
      color: colors[zoneName] || '#ccc',
      fontSize: 28,
      duration: 1.2,
      rise: 1.5,
    });
  }

  /** Shortcut: combo result. */
  combo(name, multiplier, position) {
    this.spawn(`${name} ×${multiplier}`, position, {
      color: '#a855f7',
      fontSize: 48,
      duration: 2.5,
      rise: 3.5,
      bgAlpha: 0.75,
    });
  }

  update(dt) {
    for (let i = this._texts.length - 1; i >= 0; i--) {
      const t = this._texts[i];
      t.time += dt;
      const progress = Math.min(1, t.time / t.duration);

      // Ease-out rise
      const ease = 1 - Math.pow(1 - progress, 2);
      t.sprite.position.y = t.startY + ease * t.rise;

      // Fade out in last 40%
      const fadeStart = 0.6;
      if (progress > fadeStart) {
        t.sprite.material.opacity = 1 - (progress - fadeStart) / (1 - fadeStart);
      }

      // Scale pop-in
      if (progress < 0.15) {
        const popScale = 0.5 + (progress / 0.15) * 0.5;
        t.sprite.scale.multiplyScalar(1 + (1 - popScale) * 0.02);
      }

      if (progress >= 1) {
        this.scene.remove(t.sprite);
        if (t.sprite.material.map) t.sprite.material.map.dispose();
        t.sprite.material.dispose();
        this._texts.splice(i, 1);
      }
    }
  }
}
