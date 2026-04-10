import * as THREE from 'three';

const PARTICLE_CONFIGS = {
  pull: {
    count: 30,
    color: 0xffd700,
    size: 0.12,
    speed: 3,
    spread: 1.5,
    life: 0.8,
    gravity: -2,
  },
  perfect: {
    count: 40,
    color: 0x22c55e,
    size: 0.1,
    speed: 4,
    spread: 2,
    life: 1.0,
    gravity: -1,
  },
  burn: {
    count: 25,
    color: 0xef4444,
    size: 0.15,
    speed: 2,
    spread: 1,
    life: 0.6,
    gravity: 3,
  },
  score: {
    count: 50,
    color: 0xffd700,
    size: 0.08,
    speed: 5,
    spread: 2.5,
    life: 1.2,
    gravity: -3,
  },
  fever: {
    count: 100,
    color: 0xff4400,
    size: 0.15,
    speed: 6,
    spread: 4,
    life: 1.5,
    gravity: -2,
  },
};

class Particle {
  constructor() {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.life = 0;
    this.maxLife = 1;
    this.size = 0.1;
    this.active = false;
  }
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this._pools = new Map();
    this._activeBursts = [];
  }

  emit(type, position) {
    const config = PARTICLE_CONFIGS[type];
    if (!config) return;

    const burst = this._createBurst(config, position);
    this._activeBursts.push(burst);
    this.scene.add(burst.points);
  }

  _createBurst(config, origin) {
    const { count, color, size, speed, spread, life, gravity } = config;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const lives = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * speed * 0.7 + speed * 0.3,
        (Math.random() - 0.5) * spread,
      ));

      lives.push(life * (0.5 + Math.random() * 0.5));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);

    return {
      points,
      velocities,
      lives,
      maxLives: [...lives],
      gravity,
      elapsed: 0,
      maxLife: Math.max(...lives),
    };
  }

  update(dt) {
    const toRemove = [];

    for (let b = 0; b < this._activeBursts.length; b++) {
      const burst = this._activeBursts[b];
      burst.elapsed += dt;

      if (burst.elapsed > burst.maxLife) {
        toRemove.push(b);
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        continue;
      }

      const posArr = burst.points.geometry.attributes.position.array;
      const count = burst.velocities.length;

      for (let i = 0; i < count; i++) {
        const life = burst.lives[i];
        if (burst.elapsed > life) continue;

        burst.velocities[i].y += burst.gravity * dt;

        posArr[i * 3] += burst.velocities[i].x * dt;
        posArr[i * 3 + 1] += burst.velocities[i].y * dt;
        posArr[i * 3 + 2] += burst.velocities[i].z * dt;
      }

      burst.points.geometry.attributes.position.needsUpdate = true;

      // Fade out
      const overallProgress = burst.elapsed / burst.maxLife;
      burst.points.material.opacity = Math.max(0, 1 - overallProgress * overallProgress);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this._activeBursts.splice(toRemove[i], 1);
    }
  }
}
