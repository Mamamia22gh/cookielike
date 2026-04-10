import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

/* ── Custom shaders ── */

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset:   { value: 1.0 },
    darkness: { value: 1.2 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vig = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
      texel.rgb *= mix(1.0 - darkness, 1.0, vig);
      gl_FragColor = texel;
    }
  `,
};

const FilmGrainShader = {
  uniforms: {
    tDiffuse:  { value: null },
    time:      { value: 0 },
    intensity: { value: 0.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float noise = rand(vUv + vec2(time)) * intensity;
      texel.rgb += vec3(noise - intensity * 0.5);
      gl_FragColor = texel;
    }
  `,
};

const PixelateShader = {
  uniforms: {
    tDiffuse:  { value: null },
    resolution:{ value: new THREE.Vector2(1920, 1080) },
    pixelSize: { value: 3.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    varying vec2 vUv;
    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy) + dxy * 0.5;
      gl_FragColor = texture2D(tDiffuse, coord);
    }
  `,
};

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse:  { value: null },
    intensity: { value: 0.4 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float d2 = dot(dir, dir);
      // Quadratic falloff — zero at center, strong at corners
      float aberr = d2 * intensity * 0.025;
      float r = texture2D(tDiffuse, vUv + dir * aberr).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * aberr).b;
      // Edge color bleed: slight blur of R/B at edges
      float bleed = d2 * intensity * 0.008;
      r = mix(r, texture2D(tDiffuse, vUv + dir * aberr * 1.6).r, bleed * 3.0);
      b = mix(b, texture2D(tDiffuse, vUv - dir * aberr * 1.6).b, bleed * 3.0);
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

const ColorCorrectionShader = {
  uniforms: {
    tDiffuse:   { value: null },
    saturation: { value: 1.15 },
    brightness: { value: 1.35 },
    contrast:   { value: 1.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float brightness;
    uniform float contrast;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      texel.rgb *= brightness;
      texel.rgb = (texel.rgb - 0.5) * contrast + 0.5;
      float grey = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
      texel.rgb = mix(vec3(grey), texel.rgb, saturation);
      gl_FragColor = texel;
    }
  `,
};

/**
 * Pannini projection — cylindrical perspective.
 * Reduces wide-angle straight-line distortion while keeping center sharp.
 * Applied AFTER render, BEFORE bloom so halos follow the correct geometry.
 *
 * d = 0 → standard rectilinear  
 * d = 1 → full Pannini (strong compression of the edges)
 *
 * Derivation: given an output pixel at Pannini coord xp,
 * solve for the rectilinear θ via:
 *   xp = sin(θ) / (cos(θ) + d)
 *   => (1 + xp²)cos²θ + 2d·xp²·cosθ + (d²·xp² − 1) = 0
 * then sample from tan(θ) in rectilinear image.
 */
const PanniniShader = {
  uniforms: {
    tDiffuse: { value: null },
    d:        { value: 0.5 },
    aspect:   { value: 16 / 9 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float d;
    uniform float aspect;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;

      // Horizontal distance from center squared
      float x2 = uv.x * uv.x;

      // Pannini-style edge compression:
      // center (x=0) is untouched, edges get pulled inward
      float hScale = 1.0 / (1.0 + d * x2);
      uv.x *= hScale;

      // Slight vertical correction (Pannini compresses verticals at edges)
      uv.y *= mix(1.0, hScale, 0.3);

      vec2 sUV = uv * 0.5 + 0.5;
      gl_FragColor = texture2D(tDiffuse, sUV);
    }
  `,
};

/**
 * Post-processing: pannini, bloom, color, pixelation, vignette, grain.
 * Style: Cloverpit / Content Warning retro.
 */
export function createPostFX(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // SSAO — ambient occlusion (corners, crevices, under furniture)
  const ssaoPass = new SSAOPass(scene, camera, size.x, size.y);
  ssaoPass.kernelRadius = 0.5;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.08;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);

  // Pannini first — geometric warp before any blur/bloom
  const panniniPass = new ShaderPass(PanniniShader);
  panniniPass.uniforms.aspect.value = size.x / size.y;
  panniniPass.uniforms.d.value = 0.2;
  composer.addPass(panniniPass);

  const bloomPass = new UnrealBloomPass(size, 0.5, 0.4, 0.65);
  composer.addPass(bloomPass);

  const chromaPass = new ShaderPass(ChromaticAberrationShader);
  chromaPass.uniforms.intensity.value = 0.4;
  composer.addPass(chromaPass);

  const colorPass = new ShaderPass(ColorCorrectionShader);
  composer.addPass(colorPass);

  const pixelPass = new ShaderPass(PixelateShader);
  pixelPass.uniforms.resolution.value.set(size.x, size.y);
  pixelPass.uniforms.pixelSize.value = 2.5;
  composer.addPass(pixelPass);

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms.offset.value = 1.0;
  vignettePass.uniforms.darkness.value = 0.35;
  composer.addPass(vignettePass);

  const grainPass = new ShaderPass(FilmGrainShader);
  grainPass.uniforms.intensity.value = 0.05;
  composer.addPass(grainPass);

  // Lerp states
  let _rollLerp = 0;
  let _menuLerp = 1;
  let _menuGlitchTimer = 1 + Math.random() * 2;
  let _menuGlitchAmount = 0;

  return {
    composer,
    renderPass,
    bloomPass,
    pixelPass,
    panniniPass,
    chromaPass,
    colorPass,
    grainPass,
    resize(w, h) {
      composer.setSize(w, h);
      ssaoPass.setSize(w, h);
      pixelPass.uniforms.resolution.value.set(w, h);
      panniniPass.uniforms.aspect.value = w / h;
    },
    /** Call every frame with current game phase. */
    update(dt, phase, inMenu, stress = 0) {
      grainPass.uniforms.time.value += dt;

      // Menu B&W lerp with color glitch bursts
      const menuTarget = inMenu ? 1 : 0;
      _menuLerp += (menuTarget - _menuLerp) * Math.min(1, dt * 3);

      let menuGlitch = 0;
      if (inMenu) {
        _menuGlitchTimer -= dt;
        if (_menuGlitchTimer <= 0) {
          if (Math.random() < 0.15) {
            _menuGlitchAmount = 0.4 + Math.random() * 0.5;
            _menuGlitchTimer = 0.06 + Math.random() * 0.15;
          } else {
            _menuGlitchAmount = 0;
            _menuGlitchTimer = 0.3 + Math.random() * 1.5;
          }
        }
        menuGlitch = _menuGlitchAmount;
      } else {
        _menuGlitchAmount = 0;
      }

      // Roll glitch lerp
      const rollTarget = phase === 'POLL' ? 1 : 0;
      _rollLerp += (rollTarget - _rollLerp) * Math.min(1, dt * 4);

      // ── Stress-driven effects ──
      const s = Math.min(1, stress);

      // B&W: occasional menu glitch + stress desat
      const desat = menuGlitch + s * 0.7;
      colorPass.uniforms.saturation.value = Math.max(0.05, 1.15 - desat);

      // Vignette: tighter + darker under stress
      vignettePass.uniforms.offset.value = 1.0 - s * 0.35;
      vignettePass.uniforms.darkness.value = 0.35 + s * 1.1;

      // Chromatic aberration: roll + stress
      chromaPass.uniforms.intensity.value = 0.4 + _rollLerp * 1.8 + s * 0.6;

      // Grain: roll + stress
      grainPass.uniforms.intensity.value = 0.08 + _rollLerp * 0.08 + s * 0.04;

      // Bloom: subtle increase under stress
      bloomPass.strength = 0.5 + s * 0.25;
    },
    render() {
      composer.render();
    },
  };
}
