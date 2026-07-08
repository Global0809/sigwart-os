// SIGWART_OS // gl/stage — renderer, composer (bloom → output → grain), PMREM env, tiers

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { bus, state, onFrame } from '../core.mjs';

export let renderer = null;
export let scene = null;
export let camera = null;
export let composer = null;
export let bloomPass = null;
export let grainPass = null;

export const glState = {
  reflector: null,        // set by world.mjs
  reflectorFallback: null,
  governorRung: 0,
  bypassComposer: false,
  frameCost: 0,
  clock: 0,
};

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.05 },
    uVig: { value: 0.30 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uVig;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float g = hash(vUv * vec2(1097.0, 733.0) + fract(uTime) * 371.0) - 0.5;
      c.rgb += g * uAmount;
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVig * dot(q, q) * 2.4;
      c.rgb += (hash(vUv * 911.0 + uTime) - 0.5) / 170.0;   // banding-killer dither
      gl_FragColor = c;
    }
  `,
};

function dprForTier() {
  const t = state.tier;
  const cap = t >= 2 ? 2.0 : t === 1 ? 1.5 : 1.0;
  return Math.min(window.devicePixelRatio || 1, cap);
}

export function initStage() {
  const canvas = document.getElementById('gl');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x030106, 1);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030106);
  scene.fog = new THREE.FogExp2(0x040209, 0.026);

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
  camera.position.set(0, 2.2, 9);
  camera.lookAt(0, 2.4, -2);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.55, 0.72, 0.9);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  grainPass = new ShaderPass(GrainShader);
  composer.addPass(grainPass);

  applyTier();
  bakeEnvironment();
  resize();

  window.addEventListener('resize', onResize, { passive: true });

  // pre-compile shaders while the boot terminal types
  bus.on('boot:started', () => {
    renderer.compile(scene, camera);
    composer.render();
  });

  bus.on('tier:change', applyTier);
  bus.on('governor:step', governorStep);
  bus.on('xray:on', () => { bloomPass.strength = baseBloomStrength() + 0.22; });
  bus.on('xray:off', () => { bloomPass.strength = baseBloomStrength(); });

  // context loss recovery
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    bus.emit('toast', 'GPU LINK LOST — REBOOTING OPTICS');
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    bakeEnvironment();
    applyTier();
    resize();
    bus.emit('toast', 'GPU LINK RESTORED');
    bus.emit('gl:restored');
  }, false);

  // render at priority 30 (after sim/camera)
  onFrame(render, 30);

  window.__SIG = Object.assign(window.__SIG || {}, {
    gl: {
      THREE, renderer, scene, camera, glState, composer, bloomPass, grainPass,
      renderOnce: () => render(0.016, glState.clock + 0.016),
      frameCost: () => glState.frameCost,
    },
  });

  return { renderer, scene, camera };
}

function baseBloomStrength() {
  return state.tier >= 2 ? 0.55 : 0.42;
}

function applyTier() {
  const dpr = dprForTier();
  renderer.setPixelRatio(dpr);
  composer.setPixelRatio(dpr);
  bloomPass.strength = state.xray ? baseBloomStrength() + 0.22 : baseBloomStrength();
  bloomPass.resolution.set(state.tier >= 2 ? 1280 : 256, state.tier >= 2 ? 720 : 144);
  glState.bypassComposer = state.tier <= 0;
  grainPass.enabled = state.tier > 0;
  document.body.dataset.grain = state.tier > 0 ? 'gpu' : 'css';
  resize();
}

/* runtime downgrade ladder: reflector 512 → reflector off → bloom 256 → tier0 bypass */
function governorStep() {
  glState.governorRung++;
  const r = glState.governorRung;
  if (r === 1 && glState.reflector) {
    const rt = glState.reflector.getRenderTarget && glState.reflector.getRenderTarget();
    if (rt) rt.setSize(512, 512);
  } else if (r === 2) {
    bus.emit('reflector:off');
  } else if (r === 3) {
    bloomPass.resolution.set(256, 144);
    bloomPass.strength = 0.4;
  } else if (r >= 4) {
    import('../capabilities.mjs').then(m => m.setTier(0));
  }
}

function onResize() {
  clearTimeout(onResize._t);
  onResize._t = setTimeout(resize, 120);
}

export function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = h > w ? 66 : 55;   // wider vertical fov for portrait phones
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
}

/* procedural PMREM environment — black hall with purple emissive strips.
   this is what makes chrome + clearcoat materials read as liquid metal. */
function bakeEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 12),
    new THREE.MeshBasicMaterial({ color: 0x02010a, side: THREE.BackSide })
  );
  env.add(room);

  const strip = (x, z, ry, c, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 6.4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) })
    );
    m.position.set(x, 0.4, z);
    m.rotation.y = ry;
    env.add(m);
  };
  strip(-3.4, -5.9, 0, 0x7a4dff, 4.2);
  strip(0.2, -5.9, 0, 0xb47aff, 3.2);
  strip(3.6, -5.9, 0, 0x5a3dff, 4.6);
  strip(-5.9, 0, Math.PI / 2, 0x8a5cff, 2.6);
  strip(5.9, 0, -Math.PI / 2, 0x3d2a8f, 3.0);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.16, 8, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf0eaff).multiplyScalar(1.6) })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3.6;
  env.add(ring);

  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1a1030).multiplyScalar(0.8) })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -3.9;
  env.add(floorGlow);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.05);
  scene.environment = rt.texture;
  pmrem.dispose();
  env.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

let costAcc = 0, costN = 0;
function render(dt, t) {
  if (state.phase === 'boot-idle') return;   // opaque doors cover everything
  glState.clock = t;
  grainPass.uniforms.uTime.value = t;
  const t0 = performance.now();
  if (glState.bypassComposer) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
  costAcc += performance.now() - t0; costN++;
  if (costN >= 30) { glState.frameCost = costAcc / costN; costAcc = 0; costN = 0; }
}
