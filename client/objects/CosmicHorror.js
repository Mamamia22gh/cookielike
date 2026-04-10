import * as THREE from 'three';
import { createMaterial, createGlowMaterial } from '../utils/Materials.js';

/**
 * Cosmic horror entity visible through a ceiling skylight.
 * Now a giant, terrifying, bloodshot human-like eye.
 * It tracks the player when looked at.
 * Looking at it gradually amplifies AmbientHorror.stress.
 */
export class CosmicHorror {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CosmicHorror';

    this.gazeTarget = null;
    this._time = 0;
    this._tendrils = [];
    this._shards = [];
    
    // We'll wrap the eye parts in a pivot to easily rotate it towards the player
    this.eyePivot = new THREE.Group();
    this.group.add(this.eyePivot);

    this._build();
  }

  _build() {
    // Gaze hitbox (invisible, large sphere around the eye)
    const hitGeo = new THREE.SphereGeometry(4.5, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.gazeTarget = new THREE.Mesh(hitGeo, hitMat);
    this.gazeTarget.userData = { cosmicHorror: true };
    this.eyePivot.add(this.gazeTarget);

    // ── Sclera (Eyeball) ──
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xffdddd,
      emissive: 0x110000,
      roughness: 0.1,
      metalness: 0.1,
    });
    this._sclera = new THREE.Mesh(new THREE.SphereGeometry(3.0, 32, 32), scleraMat);
    this.eyePivot.add(this._sclera);

    // ── Iris ──
    const irisMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      emissive: 0x880000,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.3,
    });
    // A spherical cap on the surface of the eye
    this._iris = new THREE.Mesh(
      new THREE.SphereGeometry(3.02, 32, 16, 0, Math.PI * 2, 0, 0.45), 
      irisMat
    );
    this._iris.rotation.x = Math.PI / 2; // Point it towards +Z
    this.eyePivot.add(this._iris);

    // Iris ring -- scales WITH pupil
    const irisRingMat = createGlowMaterial(0xff2200, 1.5);
    this._irisRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 16, 64), irisRingMat);
    this._irisRing.position.z = 2.96; 
    this.eyePivot.add(this._irisRing);

    // ── Pupil (large black disc filling the iris) ──
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this._pupil = new THREE.Mesh(new THREE.SphereGeometry(3.04, 32, 16, 0, Math.PI * 2, 0, 0.28), pupilMat);
    this._pupil.rotation.x = Math.PI / 2;
    this.eyePivot.add(this._pupil);

    // ── Blood vessels / Veins on the Sclera ──
    const veinMat = createGlowMaterial(0x880011, 0.8);
    for(let i = 0; i < 25; i++) {
      const vein = this._createVein(veinMat);
      this.eyePivot.add(vein);
    }

    // ── Tendrils (writhing flesh at the back of the eye) ──
    const tendrilCount = 18;
    for (let i = 0; i < tendrilCount; i++) {
      const angle = (i / tendrilCount) * Math.PI * 2;
      const tendril = this._createTendril(angle, 4.0 + Math.random() * 4.0);
      this._tendrils.push(tendril);
      this.eyePivot.add(tendril.group);
    }

    // ── Orbiting cosmic shards ──
    const shardGeos = [
      new THREE.TetrahedronGeometry(0.2, 0),
      new THREE.OctahedronGeometry(0.15, 0),
      new THREE.IcosahedronGeometry(0.12, 0),
    ];
    const shardMat = createGlowMaterial(0xff3300, 1.2);

    for (let i = 0; i < 25; i++) {
      const geo = shardGeos[Math.floor(Math.random() * shardGeos.length)];
      const shard = new THREE.Mesh(geo, shardMat);

      const orbit = 3.5 + Math.random() * 2.5;
      const angleStart = Math.random() * Math.PI * 2;
      const speed = (0.15 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
      const zOffset = (Math.random() - 0.5) * 2;

      this.eyePivot.add(shard);
      this._shards.push({ mesh: shard, orbit, angle: angleStart, speed, zOffset });
    }

    // ── Eerie glow light (illuminates the room through skylight) ──
    // ── Eerie glow light (illuminates the room through skylight) ──
    const light = new THREE.PointLight(0xff2200, 3.0, 80);
    light.position.set(0, 0, 0);
    light.decay = 0.8;
    this.eyePivot.add(light);
    this._light = light;

    // SpotLight pointing straight down into the room
    this._downLight = new THREE.SpotLight(0xff1100, 5.0, 100, Math.PI / 5, 0.4, 0.8);
    this._downLight.position.set(0, 0, -2);
    this._downLight.target.position.set(0, 0, -60);
    this.eyePivot.add(this._downLight);
    this.eyePivot.add(this._downLight.target);

    // Current tracking target rotation
    this._targetQuat = new THREE.Quaternion();

    this._buildSky();
  }

  _buildSky() {
    // A huge sphere to act as the skybox, only visible above the ceiling
    const skyGeo = new THREE.SphereGeometry(120, 32, 32);
    
    // Shader material for a swirling, dark cosmic void
    this._skyMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0x0a0000) }, // deep red/black
        color2: { value: new THREE.Color(0x220000) }, // dark blood red
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec3 vWorldPosition;

        // 3D Noise function (Simplex 3D)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod289(i);
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

          float n_ = 0.142857142857;
          vec3  ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          
          // Slow swirling movement
          vec3 samplePos = dir * 3.0 + vec3(time * 0.05, time * 0.02, time * -0.04);
          float n = snoise(samplePos);
          n += 0.5 * snoise(samplePos * 2.5);
          
          // Map noise to colors
          float mixVal = smoothstep(-0.8, 1.0, n);
          vec3 finalColor = mix(color1, color2, mixVal);

          // Add faint distant stars/specks
          float starNoise = snoise(dir * 150.0);
          float stars = smoothstep(0.85, 1.0, starNoise) * 0.4;
          finalColor += vec3(stars);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    const sky = new THREE.Mesh(skyGeo, this._skyMat);
    // Un-rotate the sphere so it stands upright despite the parent group's rotation
    sky.rotation.x = -Math.PI / 2;
    this.group.add(sky);
  }

  _createVein(mat) {
    const points = [];
    const radius = 3.01;
    
    // Start randomly at the sides or back (theta between PI/2 and 3PI/2)
    let currentTheta = (Math.PI / 2) + Math.random() * Math.PI; 
    let currentPhi = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8; 
    
    const segments = 6 + Math.floor(Math.random() * 5);
    for(let j = 0; j <= segments; j++) {
      const p = new THREE.Vector3().setFromSphericalCoords(radius, currentPhi, currentTheta);
      points.push(p);
      
      // Move towards front (theta -> 0 or 2PI)
      if (currentTheta > Math.PI) {
        currentTheta += 0.15 + Math.random() * 0.1;
      } else {
        currentTheta -= 0.15 + Math.random() * 0.1;
      }
      // Random wiggle on phi
      currentPhi += (Math.random() - 0.5) * 0.25;
      // Keep phi clamped to valid sphere range
      currentPhi = Math.max(0.1, Math.min(Math.PI - 0.1, currentPhi));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 10, 0.015 + Math.random() * 0.02, 5, false);
    return new THREE.Mesh(geo, mat);
  }

  _createTendril(baseAngle, length) {
    const segCount = 10 + Math.floor(Math.random() * 6);
    const segLen = length / segCount;
    const grp = new THREE.Group();
    const segments = [];

    for (let j = 0; j < segCount; j++) {
      const t = j / segCount;
      const thickness = 0.15 * (1 - t * 0.8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x220011,
        roughness: 0.8,
        metalness: 0.1,
      });
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness * 0.8, segLen, 6), mat);

      // Start at back of eye
      const r = 2.8; 
      const a = baseAngle + j * 0.05;
      const z = -1.5 - j * segLen * 0.8;
      
      seg.position.set(Math.cos(a) * r * (1 - t*0.5), Math.sin(a) * r * (1 - t*0.5), z);
      seg.lookAt(0, 0, z - 1);
      seg.rotateX(Math.PI / 2);

      grp.add(seg);
      segments.push({ mesh: seg, baseAngle: a, baseR: r, baseZ: z, index: j });
    }

    return {
      group: grp,
      segments,
      baseAngle,
      phaseOffset: Math.random() * Math.PI * 2,
      waveSpeed: 0.8 + Math.random() * 1.2,
      waveAmp: 0.4 + Math.random() * 0.6,
    };
  }

  getGazeIntensity(camera, raycaster) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObject(this.gazeTarget);
    if (hits.length === 0) return 0;

    const dist = hits[0].distance;
    const maxDist = 60;
    const proximity = 1 - Math.min(1, dist / maxDist);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const toEntity = this.group.position.clone().sub(camera.position).normalize();
    const dot = dir.dot(toEntity);
    const angleFactor = Math.max(0, (dot - 0.85) / 0.15);

    return proximity * angleFactor;
  }

  update(dt, cameraPos, gazeIntensity) {
    this._time += dt;
    const t = this._time;

    // ── Eye Tracking ──
    if (cameraPos && gazeIntensity > 0) {
      // Snap to look at player — very fast
      const targetPosLocal = this.eyePivot.parent.worldToLocal(cameraPos.clone());
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.eyePivot.position);
      dummy.lookAt(targetPosLocal);
      
      this._targetQuat.copy(dummy.quaternion);
      // Instant snap when gaze is strong
      const lockSpeed = 5.0 + gazeIntensity * 15.0;
      this.eyePivot.quaternion.slerp(this._targetQuat, Math.min(1, dt * lockSpeed));
    } else {
      // Roaming — darting glances in random directions
      this._roamTimer = (this._roamTimer || 0) - dt;
      if (this._roamTimer <= 0) {
        // Pick a new random direction to look at
        this._roamTarget = new THREE.Euler(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          0
        );
        this._roamTimer = 0.8 + Math.random() * 2.5; // hold for 0.8–3.3s
        this._roamSpeed = 2.0 + Math.random() * 4.0; // variable snap speed
      }
      if (this._roamTarget) {
        this._targetQuat.setFromEuler(this._roamTarget);
      }
      this.eyePivot.quaternion.slerp(this._targetQuat, Math.min(1, dt * (this._roamSpeed || 2.0)));
    }

    // ── Iris ring scales WITH pupil, always stays outside it ──
    const twitch = Math.sin(t * 7.0) > 0.85 ? 0.04 : 0;
    const ringScale = (this._pupilScale || 1.0) + twitch;
    this._irisRing.scale.setScalar(ringScale);
    
    // ── Pupil dilation + tremble when watched ──
    const targetDilate = gazeIntensity > 0.05 ? 1.0 + gazeIntensity * 0.25 : 1.0;
    this._pupilScale = (this._pupilScale || 1.0) + (targetDilate - (this._pupilScale || 1.0)) * Math.min(1, dt * 6);
    this._pupil.scale.setScalar(this._pupilScale);

    if (gazeIntensity > 0.1) {
      // High-frequency trembling
      const trembleX = (Math.random() - 0.5) * 0.04 * gazeIntensity;
      const trembleY = (Math.random() - 0.5) * 0.04 * gazeIntensity;
      this._pupil.position.x = trembleX;
      this._pupil.position.y = trembleY;
      this._iris.position.x = trembleX * 0.5;
      this._iris.position.y = trembleY * 0.5;
    } else {
      // Idle micro-saccades
      const saccade = Math.sin(t * 11.3) > 0.92 ? 0.01 : 0;
      this._pupil.position.x = saccade * (Math.random() - 0.5);
      this._pupil.position.y = saccade * (Math.random() - 0.5);
      this._iris.position.x = 0;
      this._iris.position.y = 0;
    }

    // ── Tendrils writhe — jerky, organic ──
    for (const tendril of this._tendrils) {
      for (const seg of tendril.segments) {
        const wave = Math.sin(t * tendril.waveSpeed + seg.index * 0.8 + tendril.phaseOffset);
        const wave2 = Math.cos(t * tendril.waveSpeed * 0.7 + seg.index * 1.1);
        // Add occasional jerk
        const jerk = Math.sin(t * 13.0 + seg.index * 3.7) > 0.9 ? 0.5 : 0;
        
        const rOff = (wave + jerk) * tendril.waveAmp;
        const a = seg.baseAngle + wave2 * 0.15;
        const r = seg.baseR * (1 - seg.index / tendril.segments.length * 0.5) + rOff;
        
        seg.mesh.position.x = Math.cos(a) * r;
        seg.mesh.position.y = Math.sin(a) * r;
      }
    }

    // ── Shards orbit ──
    for (const s of this._shards) {
      s.angle += s.speed * dt;
      s.mesh.position.set(
        Math.cos(s.angle) * s.orbit,
        Math.sin(s.angle) * s.orbit,
        s.zOffset + Math.sin(t * 0.5 + s.angle) * 0.5
      );
      s.mesh.rotation.x += dt * 1.5;
      s.mesh.rotation.y += dt * 2.0;
    }

    // ── Light flicker — erratic ──
    const flick = Math.random() < 0.05 ? 0.5 : 0;
    const baseIntensity = 1.5 + Math.sin(t * 3.7) * 0.3 + Math.random() * 0.15 + flick;
    this._light.intensity = baseIntensity;
    this._downLight.intensity = baseIntensity * 1.5;

    // Update sky shader
    if (this._skyMat) {
      this._skyMat.uniforms.time.value = t;
    }
  }
}
