// SIGWART_OS // gl/world — the facility: atrium, descent shaft, hangar, holo chamber, comms wall

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { scene, glState, camera } from './stage.mjs';
import { bus, state, damp, clamp } from '../core.mjs';

/* room anchors (camera track keys live off these in camera.mjs) */
export const ROOMS = {
  gate:   { camY: 2.1,   floorY: 0 },
  shaft:  { camY: -16.0, floorY: null },
  hangar: { camY: -40.6, floorY: -44 },
  comms:  { camY: -59.6, floorY: -62 },
};

export const UNIT_COLORS = {
  ig: 0xd24bff,
  tt: 0x8a5cff,
  fb: 0x6a5cff,
  px: 0xefe4ff,
};

export const world = {
  doors: null,          // { left, right, open(amt) }
  pads: [],             // { group, ringMat, ringBase, light, glow, unit, pos }
  padCones: [],         // volumetric cones above the three visible pads (ig, tt, fb)
  secretWall: null,
  cones: [],
  blobs: [],
  neurons: [],
  setPadLit: null,
};

/* ---------- shared materials ---------- */
const matWall = new THREE.MeshStandardMaterial({
  color: 0x0b0716, metalness: 0.35, roughness: 0.8, envMapIntensity: 0.35,
});
const matFloorGloss = new THREE.MeshStandardMaterial({
  color: 0x060310, metalness: 0.7, roughness: 0.45, envMapIntensity: 0.18,
});
const matColumn = new THREE.MeshStandardMaterial({
  color: 0x0e0a1c, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.6,
});
export const sharedMats = { matWall, matFloorGloss, matColumn };

function emissive(color, intensity) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  m.toneMapped = false;
  return m;
}

/* soft radial glow texture, shared by door glow / pad glow / drone underglow */
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export function glowSprite(color, sx, sy, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.toneMapped = false;
  const s = new THREE.Sprite(mat);
  s.scale.set(sx, sy, 1);
  return s;
}

/* ---------- volumetric light cone (rim-lit additive shader) ---------- */
const coneUniformsList = [];
function makeCone(radius, height, color, intensity, seed) {
  const geo = new THREE.ConeGeometry(radius, height, 26, 1, true);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uSeed: { value: seed },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uSeed;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        // NaN-safe: cone apex normals degenerate to (0,0,0); normalize() there would
        // poison the whole bloom mip chain (blur spreads NaN across the frame).
        float nlen = max(length(vNormalView), 1e-5);
        float nz = abs(vNormalView.z) / nlen;
        float grad = pow(clamp(vUv.y, 0.0, 1.0), 1.5);      // bright toward the source (cone tip up)
        float fres = pow(clamp(1.0 - nz, 0.0, 1.0), 1.35);
        float flick = 0.84 + 0.16 * sin(uTime * 8.7 + uSeed * 13.0) * sin(uTime * 3.3 + uSeed * 5.0);
        float a = clamp(grad * fres * flick * uIntensity, 0.0, 1.0);
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  coneUniformsList.push(uniforms);
  const mesh = new THREE.Mesh(geo, mat);
  world.cones.push({ mesh, uniforms });
  return mesh;
}

const _mv = new THREE.Vector3();
const _sp = new THREE.Vector3();

export function tickWorld(dt, t) {
  for (let i = 0; i < coneUniformsList.length; i++) coneUniformsList[i].uTime.value = t;
  state.scrollVel = (state.scrollVel || 0) * Math.exp(-3 * dt);   // settle after scrolling stops
  world.stir = (world.stir || 0) * Math.exp(-2.2 * dt);           // liquid calms after the cursor rests

  for (let i = 0; i < world.blobs.length; i++) {
    const b = world.blobs[i];
    const u = b.uniforms;
    const vel = Math.min(Math.abs(state.scrollVel || 0), 1.3);
    u.mem.uTime.value = t;
    u.line.uTime.value = t;
    u.pts.uTime.value = t;
    u.ring.uTime.value = t;
    u.ring.uOrbit.value = 0.3 + vel * 2.2;                       // scrolling whips the ring around
    u.mem.uStir.value = Math.max(world.stir, vel * 1.1);         // scrolling stirs the liquid too

    // cinematic motion: slow revolve, scroll spins it further, velocity zooms it
    b.group.rotation.y = b.spin + t * 0.07 + (state.scrollP || 0) * 4.2;
    b.group.rotation.x = Math.sin(t * 0.16 + i * 3) * 0.08;
    b.group.scale.setScalar(b.radius * (1 + vel * 0.11));

    // cursor ray → membrane-local point, chased by an underdamped spring:
    // the reach point overshoots and jiggles — slime, not servo
    _mv.set(world.pmx || 0, world.pmy || 0, 0.5).unproject(camera);
    _mv.sub(camera.position).normalize();
    world.rayO = world.rayO || new THREE.Vector3();
    world.rayD = world.rayD || new THREE.Vector3();
    if (i === 0) { world.rayO.copy(camera.position); world.rayD.copy(_mv); }
    const dz = Math.abs(_mv.z) < 1e-4 ? -1e-4 : _mv.z;
    const tt = (b.group.position.z - camera.position.z) / dz;
    if (tt > 0) {
      _mv.multiplyScalar(tt).add(camera.position);
      b.membrane.worldToLocal(_mv);
      const L = _mv.length();
      if (L > 6) _mv.multiplyScalar(6 / L);
      b.mp = b.mp || new THREE.Vector3(9, 9, 9);
      b.mvv = b.mvv || new THREE.Vector3();
      _sp.copy(_mv).sub(b.mp).multiplyScalar(26 * dt);
      b.mvv.add(_sp).multiplyScalar(Math.exp(-5.0 * dt));
      b.mp.addScaledVector(b.mvv, dt);
      u.mem.uMouse.value.copy(b.mp);
      u.line.uMouse.value.copy(b.mp);
      u.pts.uMouse.value.copy(b.mp);
      u.ring.uMouse.value.copy(b.mp);
    }
  }

  // free-floating neuron fields (hangar corridor) — pulse, spin, lean to the cursor
  for (let i = 0; i < world.neurons.length; i++) {
    const nf = world.neurons[i];
    nf.uniforms.line.uTime.value = t;
    nf.uniforms.pts.uTime.value = t;
    nf.group.rotation.y = t * 0.09 + (state.scrollP || 0) * 3.0;
    nf.group.rotation.z = damp(nf.group.rotation.z, (world.pmx || 0) * 0.2, 3, dt);
    _mv.set(world.pmx || 0, world.pmy || 0, 0.5).unproject(camera);
    _mv.sub(camera.position).normalize();
    const dzn = Math.abs(_mv.z) < 1e-4 ? -1e-4 : _mv.z;
    const tn = (nf.group.position.z - camera.position.z) / dzn;
    if (tn > 0) {
      _mv.multiplyScalar(tn).add(camera.position);
      nf.group.worldToLocal(_mv);
      const L = _mv.length();
      if (L > 4) _mv.multiplyScalar(4 / L);
      nf.uniforms.line.uMouse.value.lerp(_mv, 0.2);
      nf.uniforms.pts.uMouse.value.copy(nf.uniforms.line.uMouse.value);
    }
  }
}

/* ========================================================================== */
export function buildWorld() {
  const g = new THREE.Group();
  scene.add(g);

  scene.add(new THREE.AmbientLight(0x1a1226, 1.4));
  scene.add(new THREE.HemisphereLight(0x2a1c4a, 0x05030a, 0.75));

  buildAtrium(g);
  buildShaft(g);
  buildHangar(g);
  buildComms(g);
  mountEnergyBlobs(g);
  return world;
}

/* ---------- B00 atrium ---------- */
function buildAtrium(g) {
  // no floor plane here — a huge glossy slab reads as a "purple block" that pops
  // in and out as the camera crosses its horizon. the void IS the look.
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 22), matWall);
  back.position.set(0, 9, -9);
  g.add(back);

  // signature emissive strips (echo the PMREM env → chrome reads coherent)
  const stripGeo = new THREE.PlaneGeometry(0.045, 12);
  const strips = [
    [-8.6, 0x7a4dff, 3.4], [3.4, 0x9a66ff, 1.8], [9.2, 0x5a3dff, 3.6],
  ];
  for (const [x, c, i] of strips) {
    const s = new THREE.Mesh(stripGeo, emissive(c, i));
    s.position.set(x, 7.4, -8.9);
    g.add(s);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.012, 8, 64), emissive(0xd9c8ff, 1.2));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 11.2, -2);
  g.add(ring);

  for (const x of [-11, 11]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 16, 0.8), matColumn);
    col.position.set(x, 8, -6);
    g.add(col);
  }

  const c1 = makeCone(2.6, 9, 0x8a5cff, 0.34, 1.7);
  c1.position.set(-4.5, 6.5, -3.5);
  g.add(c1);
  const c2 = makeCone(2.0, 8, 0xb47aff, 0.26, 4.2);
  c2.position.set(5.0, 6.0, -4.5);
  g.add(c2);
}

/* ---------- descent shaft (behind B01/B02 DOM) ---------- */
function buildShaft(g) {
  const colGeo = new THREE.BoxGeometry(0.55, 32, 0.55);
  for (const [x, z] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]]) {
    const col = new THREE.Mesh(colGeo, matColumn);
    col.position.set(x, -17, z);
    g.add(col);
  }
  const ringGeo = new THREE.TorusGeometry(6.1, 0.014, 6, 4);
  for (let i = 0; i < 9; i++) {
    const y = -3.4 - i * 3.3;
    const r = new THREE.Mesh(ringGeo, emissive(i % 3 === 0 ? 0xb47aff : 0x5a3dff, i % 3 === 0 ? 1.7 : 0.95));
    r.rotation.x = Math.PI / 2;
    r.rotation.z = Math.PI / 4;
    r.position.set(0, y, 0);
    g.add(r);
  }
}

/* ---------- B03 hangar ---------- */
function buildHangar(g) {
  const W = 36, D = 18, H = 9;
  const fy = ROOMS.hangar.floorY;           // -44
  const cz = -3;                            // room depth center

  // shell
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matWall);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, fy + H, cz);
  g.add(ceil);

  // back wall with a real doorway — the blast doors part to reveal the reactor core
  const gapW = 9.4, gapH = 7.0;
  const bwSide = new THREE.PlaneGeometry((W - gapW) / 2, H);
  const bwL = new THREE.Mesh(bwSide, matWall);
  bwL.position.set(-(gapW / 2 + (W - gapW) / 4), fy + H / 2, cz - D / 2);
  g.add(bwL);
  const bwR = new THREE.Mesh(bwSide.clone(), matWall);
  bwR.position.set(gapW / 2 + (W - gapW) / 4, fy + H / 2, cz - D / 2);
  g.add(bwR);
  const bwTop = new THREE.Mesh(new THREE.PlaneGeometry(gapW, H - gapH), matWall);
  bwTop.position.set(0, fy + gapH + (H - gapH) / 2, cz - D / 2);
  g.add(bwTop);
  // doorway frame glow
  const frameL = new THREE.Mesh(new THREE.PlaneGeometry(0.06, gapH), emissive(0x8a5cff, 1.6));
  frameL.position.set(-gapW / 2, fy + gapH / 2, cz - D / 2 + 0.05);
  g.add(frameL);
  const frameR = frameL.clone();
  frameR.position.x = gapW / 2;
  g.add(frameR);

  // single hairline above the doorway so the wall doesn't read as void
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, 0.012), emissive(0x4a3690, 0.8));
  hl.position.set(0, fy + 7.9, cz - D / 2 + 0.06);
  g.add(hl);
  for (const hx of [-11.5, 11.5]) {
    const vl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, H - 1.6), emissive(0x5a3dff, 1.0));
    vl.position.set(hx, fy + H / 2, cz - D / 2 + 0.06);
    g.add(vl);
  }

  // left wall solid; right wall has the secret alcove gap
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), matWall);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-W / 2, fy + H / 2, cz);
  g.add(leftWall);

  const rwGeoA = new THREE.PlaneGeometry(D / 2 - 2.2, H);
  const rwA = new THREE.Mesh(rwGeoA, matWall);
  rwA.rotation.y = -Math.PI / 2;
  rwA.position.set(W / 2, fy + H / 2, cz - D / 4 - 1.1);
  g.add(rwA);
  const rwB = new THREE.Mesh(rwGeoA.clone(), matWall);
  rwB.rotation.y = -Math.PI / 2;
  rwB.position.set(W / 2, fy + H / 2, cz + D / 4 + 1.1);
  g.add(rwB);
  const rwTop = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), matWall);
  rwTop.rotation.y = -Math.PI / 2;
  rwTop.position.set(W / 2, fy + H - 1.7, cz);
  g.add(rwTop);

  // secret alcove interior (revealed at P6)
  const alcove = new THREE.Group();
  const aBack = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.6), matWall);
  aBack.rotation.y = -Math.PI / 2;
  aBack.position.set(W / 2 + 4.2, fy + 2.8, cz);
  alcove.add(aBack);
  for (const dz of [-2.2, 2.2]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.6), matWall);
    side.position.set(W / 2 + 2.1, fy + 2.8, cz + dz);
    if (dz > 0) side.rotation.y = Math.PI;
    alcove.add(side);
  }
  const aStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 5.2), emissive(0xefe4ff, 1.9));
  aStrip.rotation.y = -Math.PI / 2;
  aStrip.position.set(W / 2 + 4.1, fy + 2.8, cz);
  alcove.add(aStrip);
  g.add(alcove);

  // secret sliding wall slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.6, 4.4), matColumn);
  slab.position.set(W / 2 + 0.18, fy + 2.8, cz);
  g.add(slab);
  world.secretWall = slab;

  // blast doors (slide apart on approach) — set into the back wall
  const doorGeo = new THREE.BoxGeometry(9.4, 7.2, 0.6);
  const doorL = new THREE.Mesh(doorGeo, matColumn);
  doorL.position.set(-4.72, fy + 3.6, cz - D / 2 + 0.5);
  const doorR = doorL.clone();
  doorR.position.x = 4.72;
  const seamL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 6.8, 0.09), emissive(0xb47aff, 2.8));
  seamL.position.set(4.66, 0, 0.3);
  doorL.add(seamL);
  const seamR = seamL.clone();
  seamR.position.x = -4.66;
  doorR.add(seamR);
  g.add(doorL, doorR);
  const doorGlow = glowSprite(0xb9a0ff, 15, 9, 0);
  doorGlow.position.set(0, fy + 3.4, cz - D / 2 + 0.35);
  g.add(doorGlow);
  world.doors = {
    left: doorL, right: doorR, glow: doorGlow, baseX: 4.72,
    open(amt) {
      doorL.position.x = -4.72 - amt * 8.6;
      doorR.position.x = 4.72 + amt * 8.6;
      doorGlow.material.opacity = amt * 0.5;
    },
  };

  // floor: real mirror on tier 2, glossy fallback otherwise
  const floorGeo = new THREE.PlaneGeometry(W, D);
  const fallback = new THREE.Mesh(floorGeo, matFloorGloss.clone());
  fallback.rotation.x = -Math.PI / 2;
  fallback.position.set(0, fy, cz);
  g.add(fallback);
  glState.reflectorFallback = fallback;

  if (state.tier >= 2) {
    const refl = new Reflector(floorGeo.clone(), {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x8a8a99,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(0, fy + 0.005, cz);
    g.add(refl);
    glState.reflector = refl;
    fallback.visible = false;

    // rough dark veil over the mirror = expensive-looking brushed floor
    const veil = new THREE.Mesh(
      floorGeo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x05030c, transparent: true, opacity: 0.52 })
    );
    veil.rotation.x = -Math.PI / 2;
    veil.position.set(0, fy + 0.012, cz);
    g.add(veil);
    glState.reflectorVeil = veil;

    bus.on('reflector:off', () => {
      refl.visible = false;
      veil.visible = false;
      fallback.visible = true;
    });
  }

  // dock pads
  const padBaseGeo = new THREE.CylinderGeometry(1.75, 1.95, 0.2, 36);
  const padRingGeo = new THREE.TorusGeometry(1.58, 0.035, 8, 64);
  const units = ['ig', 'tt', 'fb'];
  units.forEach((unit, i) => {
    const x = (i - 1) * 6.9;
    const grp = new THREE.Group();
    const base = new THREE.Mesh(padBaseGeo, matColumn);
    grp.add(base);
    const ringBase = new THREE.Color(UNIT_COLORS[unit]);
    const ringMat = emissive(UNIT_COLORS[unit], 0.06);
    const ring = new THREE.Mesh(padRingGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11;
    grp.add(ring);
    const light = new THREE.PointLight(UNIT_COLORS[unit], 0, 7, 2);
    light.position.y = 1.4;
    grp.add(light);
    const glow = glowSprite(UNIT_COLORS[unit], 5.2, 2.4, 0);
    glow.position.y = 0.35;
    grp.add(glow);
    grp.position.set(x, fy + 0.1, cz + 1.5);
    g.add(grp);
    world.pads.push({ group: grp, ringMat, ringBase, light, glow, unit, pos: grp.position.clone() });

    const cone = makeCone(2.3, 7.6, UNIT_COLORS[unit], 0.0, i * 2.3 + 1);
    cone.position.set(x, fy + H - 3.9, cz + 1.5);
    g.add(cone);
    world.padCones.push(world.cones[world.cones.length - 1]);
  });

  // hidden prototype pad in the alcove
  const pxGrp = new THREE.Group();
  const pxBase = new THREE.Mesh(padBaseGeo, matColumn);
  pxGrp.add(pxBase);
  const pxRing = new THREE.Mesh(padRingGeo, emissive(UNIT_COLORS.px, 0.12));
  pxRing.rotation.x = Math.PI / 2;
  pxRing.position.y = 0.11;
  pxGrp.add(pxRing);
  const pxLight = new THREE.PointLight(UNIT_COLORS.px, 0, 6, 2);
  pxLight.position.y = 1.2;
  pxGrp.add(pxLight);
  pxGrp.position.set(W / 2 + 2.4, fy + 0.1, cz);
  pxGrp.scale.setScalar(0.82);
  g.add(pxGrp);
  world.pads.push({ group: pxGrp, ringMat: pxRing.material, ringBase: new THREE.Color(UNIT_COLORS.px), light: pxLight, unit: 'px', pos: pxGrp.position.clone() });

  world.setPadLit = (unit, k) => {
    const pad = world.pads.find(p => p.unit === unit);
    if (!pad) return;
    pad.ringMat.color.copy(pad.ringBase).multiplyScalar(0.06 + k * 1.55);
    pad.light.intensity = k * 2.4;
    if (pad.glow) pad.glow.material.opacity = k * 0.4;
  };
}

/* ---------- B04 holo chamber ---------- */
function buildHolo(g) {
  const fy = ROOMS.holo.floorY;   // -62
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.3, 48), matFloorGloss);
  floor.position.set(0, fy - 0.15, 0);
  g.add(floor);

  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.6, 36), matColumn);
  ped.position.set(0, fy + 0.3, 0);
  g.add(ped);
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.03, 8, 48), emissive(0x9a6cff, 2.2));
  pedRing.rotation.x = Math.PI / 2;
  pedRing.position.set(0, fy + 0.62, 0);
  g.add(pedRing);

  const arc = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.18, 8, 60, Math.PI), matColumn);
  arc.rotation.x = Math.PI / 2;
  arc.rotation.z = Math.PI;
  arc.position.set(0, fy + 0.2, 0);
  g.add(arc);
  const arcGlow = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.04, 6, 60, Math.PI), emissive(0x6a4dff, 1.3));
  arcGlow.rotation.copy(arc.rotation);
  arcGlow.position.copy(arc.position).add(new THREE.Vector3(0, 0.16, 0));
  g.add(arcGlow);

  const cone = makeCone(2.4, 6.4, 0x8a5cff, 0.3, 9.1);
  cone.position.set(0, fy + 3.9, 0);
  g.add(cone);
}

/* ---------- B05 comms ---------- */
function buildComms(g) {
  const fy = ROOMS.comms.floorY;  // -78
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 18), matFloorGloss);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, fy, -2);
  g.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 13), matWall);
  wall.position.set(0, fy + 6.5, -8);
  g.add(wall);

  // instanced wall slits
  const slitGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
  const slitMat = emissive(0x6a4dff, 1.0);
  const inst = new THREE.InstancedMesh(slitGeo, slitMat, 16);
  const m4 = new THREE.Matrix4();
  const seedRand = (n) => { const x = Math.sin(n * 91.7) * 43758.55; return x - Math.floor(x); };
  for (let i = 0; i < 16; i++) {
    const x = (seedRand(i) - 0.5) * 26;
    const y = fy + 2 + seedRand(i + 40) * 9;
    const s = 0.7 + seedRand(i + 80) * 2.4;
    m4.makeScale(1, s, 1);
    m4.setPosition(x, y, -7.9);
    inst.setMatrixAt(i, m4);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
}

/* ==========================================================================
   NEURAL CORES — procedural liquid-glass brains (no textures, built in shaders).
   Iridescent membrane displaced by simplex noise, breathing; the surface
   REACHES toward the cursor like ferrofluid and ripples when you stir it.
   Inside: firing synapses. Scroll revolves it, velocity zooms it.
   ========================================================================== */

const SNOISE = `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

function makeNeuralCore(g, x, y, z, radius, spin) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(radius);

  /* --- liquid-glass membrane --- */
  const memUniforms = {
    uTime: { value: 0 },
    uStir: { value: 0 },
    uMouse: { value: new THREE.Vector3(9, 9, 9) },
  };
  const memMat = new THREE.ShaderMaterial({
    uniforms: memUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: SNOISE + `
      uniform float uTime;
      uniform float uStir;
      uniform vec3 uMouse;
      varying vec3 vN;
      varying vec3 vPv;
      varying float vNz;
      varying float vReach;
      void main() {
        vec3 p = position;
        vec3 n = normal;
        float t = uTime;
        vec3 off = vec3(0.0, t * 0.22, t * 0.13);
        float breath = 1.0 + 0.05 * sin(t * 0.8) + 0.018 * sin(t * 2.3 + 1.7);
        float n0 = snoise(p * 1.1 + off);
        float nz = n0 * 0.6
                 + snoise(p * 2.4 - vec3(t * 0.15)) * 0.28
                 + snoise(p * 4.8 + vec3(t * 0.08)) * 0.12;
        float md = distance(p, uMouse);
        float closeReach = exp(-md * md * 0.9) * 0.5;
        // long-range slime pull: the whole cursor-facing side strains toward the
        // pointer no matter how far it is — the further, the longer the tendril
        float mLen = length(uMouse);
        vec3 mDir = uMouse / max(mLen, 1e-4);
        float align = max(dot(normalize(p), mDir), 0.0);
        float farPull = pow(align, 7.0) * clamp(mLen - 0.6, 0.0, 2.6) * 0.55;
        float fingers = 0.62 + 0.58 * snoise(p * 3.2 + vec3(t * 0.5));
        float reach = (closeReach + farPull) * fingers;
        vec3 toM = normalize(uMouse - p + vec3(1e-4));
        float rip = sin(md * 9.0 - t * 6.0) * exp(-md * 1.4) * uStir;
        vec3 pos = p * breath + n * (nz * 0.34 + rip * 0.16) + toM * reach;
        float e = 0.14;
        float gx = snoise((p + vec3(e, 0.0, 0.0)) * 1.1 + off) - n0;
        float gy = snoise((p + vec3(0.0, e, 0.0)) * 1.1 + off) - n0;
        float gz = snoise((p + vec3(0.0, 0.0, e)) * 1.1 + off) - n0;
        vec3 nn = normalize(n + vec3(gx, gy, gz) * 2.0);
        vN = normalMatrix * nn;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vPv = mv.xyz;
        vNz = nz;
        vReach = reach * 1.1 + abs(rip) * 0.6;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vPv;
      varying float vNz;
      varying float vReach;
      void main() {
        vec3 V = normalize(-vPv);
        vec3 N = normalize(vN);
        float f = pow(1.0 - abs(dot(N, V)), 2.2);
        float w = clamp(f * 1.35 + vNz * 0.3, 0.0, 1.0);
        vec3 cDeep = vec3(0.07, 0.02, 0.16);    // deep violet glass
        vec3 cMag  = vec3(0.80, 0.22, 1.05);    // hot magenta
        vec3 cIce  = vec3(0.78, 0.66, 1.20);    // ice lavender rim
        vec3 col = mix(cDeep, cMag, smoothstep(0.15, 0.75, w));
        col = mix(col, cIce, smoothstep(0.75, 1.0, w));
        col += 0.06 * cos(6.2831 * (vNz * 1.4 + f * 2.0 + vec3(0.0, 0.33, 0.66))) * f;
        col += vReach * vec3(1.0, 0.7, 1.4) * 0.9;
        float a = 0.28 + f * 0.62 + vReach * 0.25;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
  });
  const membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 20), memMat);
  membrane.renderOrder = 2;
  group.add(membrane);

  /* --- firing synapses inside (dense web) --- */
  const N = 120;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u2 = Math.random() * Math.PI * 2;
    const v2 = Math.acos(2 * Math.random() - 1);
    const r = 0.38 + Math.pow(Math.random(), 0.55) * 0.56;
    pts.push(new THREE.Vector3(
      Math.sin(v2) * Math.cos(u2) * r,
      Math.cos(v2) * r * 0.92,
      Math.sin(v2) * Math.sin(u2) * r
    ));
  }
  const ePos = [], eT = [], ePh = [];
  for (let i = 0; i < N; i++) {
    const near = pts.map((p, j) => ({ j, dd: i === j ? 1e9 : pts[i].distanceToSquared(p) }))
      .sort((a, b) => a.dd - b.dd);
    for (let k = 0; k < 3; k++) {
      const q = pts[near[k].j];
      const ph = Math.random();
      ePos.push(pts[i].x, pts[i].y, pts[i].z, q.x, q.y, q.z);
      eT.push(0, 1);
      ePh.push(ph, ph);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ePos), 3));
  lineGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(eT), 1));
  lineGeo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(ePh), 1));
  const lineUniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(9, 9, 9) } };
  const lineMat = new THREE.ShaderMaterial({
    uniforms: lineUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aT;
      attribute float aPhase;
      uniform vec3 uMouse;
      varying float vT;
      varying float vPh;
      varying float vM;
      void main() {
        vT = aT;
        vPh = aPhase;
        vM = exp(-distance(position, uMouse) * 1.4);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying float vT;
      varying float vPh;
      varying float vM;
      void main() {
        float trip = fract(uTime * 0.42 + vPh);
        float s = exp(-abs(vT - trip) * 6.0);
        vec3 col = vec3(0.42, 0.28, 0.85) * 0.5 + s * vec3(1.3, 0.95, 1.7) + vM * vec3(0.9, 0.7, 1.3) * 0.6;
        gl_FragColor = vec4(col, 0.28 + s * 0.6 + vM * 0.3);
      }`,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.renderOrder = 1;
  group.add(lines);

  const nPos = new Float32Array(N * 3);
  const nSeed = new Float32Array(N);
  pts.forEach((p, i) => { nPos[i * 3] = p.x; nPos[i * 3 + 1] = p.y; nPos[i * 3 + 2] = p.z; nSeed[i] = Math.random() * 10; });
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  ptGeo.setAttribute('aSeed', new THREE.BufferAttribute(nSeed, 1));
  const ptUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector3(9, 9, 9) },
    uPix: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };
  const ptMat = new THREE.ShaderMaterial({
    uniforms: ptUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPix;
      uniform vec3 uMouse;
      varying float vPulse;
      varying float vM;
      void main() {
        vM = exp(-distance(position, uMouse) * 1.6);
        vPulse = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 9.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(uPix * (30.0 / -mv.z) * (0.7 + vPulse * 0.5 + vM), 1.0, 10.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vPulse;
      varying float vM;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * (0.5 + vPulse * 0.5 + vM * 0.6);
        gl_FragColor = vec4(vec3(0.85, 0.7, 1.2) + vM * 0.5, a);
      }`,
  });
  const nodes = new THREE.Points(ptGeo, ptMat);
  nodes.renderOrder = 1;
  group.add(nodes);

  /* --- saturn ring of orbiting reactive particles --- */
  const RN = 220;
  const rAng = new Float32Array(RN), rRad = new Float32Array(RN);
  const rYy = new Float32Array(RN), rSeed = new Float32Array(RN);
  const rZero = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) {
    rAng[i] = Math.random() * Math.PI * 2;
    rRad[i] = 1.45 + Math.pow(Math.random(), 1.4) * 0.6;
    rYy[i] = (Math.random() - 0.5) * 0.14;
    rSeed[i] = Math.random() * 10;
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(rZero, 3));
  ringGeo.setAttribute('aAng', new THREE.BufferAttribute(rAng, 1));
  ringGeo.setAttribute('aRad', new THREE.BufferAttribute(rRad, 1));
  ringGeo.setAttribute('aY', new THREE.BufferAttribute(rYy, 1));
  ringGeo.setAttribute('aSeed', new THREE.BufferAttribute(rSeed, 1));
  const ringUniforms = {
    uTime: { value: 0 },
    uOrbit: { value: 0.3 },
    uMouse: { value: new THREE.Vector3(9, 9, 9) },
    uPix: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };
  const ringMat = new THREE.ShaderMaterial({
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aAng;
      attribute float aRad;
      attribute float aY;
      attribute float aSeed;
      uniform float uTime;
      uniform float uOrbit;
      uniform vec3 uMouse;
      uniform float uPix;
      varying float vB;
      void main() {
        float ang = aAng + uTime * uOrbit * (1.35 - aRad * 0.35);
        vec3 p = vec3(cos(ang) * aRad, aY, sin(ang) * aRad);
        float md = distance(p, uMouse);
        float m = exp(-md * 1.6);
        p += normalize(p - uMouse + vec3(1e-4)) * m * 0.24;   // the ring parts around the cursor
        vB = 0.45 + 0.55 * sin(uTime * 2.2 + aSeed * 11.0) + m * 1.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uPix * (26.0 / -mv.z) * (0.6 + vB * 0.4), 1.0, 8.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vB;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        vec3 col = mix(vec3(0.55, 0.35, 1.0), vec3(1.0, 0.75, 1.35), clamp(vB - 0.6, 0.0, 1.0));
        gl_FragColor = vec4(col, smoothstep(0.5, 0.08, d) * (0.35 + vB * 0.45));
      }`,
  });
  const ringPts = new THREE.Points(ringGeo, ringMat);
  ringPts.renderOrder = 1;
  const ringTilt = new THREE.Group();
  ringTilt.rotation.x = 0.48;
  ringTilt.rotation.z = 0.14;
  ringTilt.add(ringPts);
  group.add(ringTilt);

  /* --- soft halo behind --- */
  const halo = glowSprite(0x8a5cff, 4.8, 4.8, 0.14);
  halo.renderOrder = 0;
  group.add(halo);

  g.add(group);
  world.blobs.push({
    group, membrane, radius, spin,
    uniforms: { mem: memUniforms, line: lineUniforms, pts: ptUniforms, ring: ringUniforms },
  });
}

function mountEnergyBlobs(g) {
  makeNeuralCore(g, 0.5, 4.9, -6.3, 3.1, 0);                          // hero — the organism
  makeNeuronField(g, 0, ROOMS.hangar.floorY + 3.8, -17.5, 3.4, 150);  // naked synapse cloud behind the blast doors
  makeNeuralCore(g, 0, ROOMS.comms.floorY + 5.3, -6.2, 2.2, 2.4);     // comms finale

  window.addEventListener('pointermove', e => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -((e.clientY / window.innerHeight) * 2 - 1);
    world.stir = Math.min((world.stir || 0) + (Math.abs(nx - (world.pmx || 0)) + Math.abs(ny - (world.pmy || 0))) * 2.4, 1.5);
    world.pmx = nx;
    world.pmy = ny;
  }, { passive: true });
}

/* ---------- naked synapse cloud (no membrane) — hangar corridor + anywhere airy ---------- */
function makeNeuronField(g, x, y, z, radius, count) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(radius);

  const pts = [];
  for (let i = 0; i < count; i++) {
    const u2 = Math.random() * Math.PI * 2;
    const v2 = Math.acos(2 * Math.random() - 1);
    const r = 0.25 + Math.pow(Math.random(), 0.5) * 0.75;
    pts.push(new THREE.Vector3(
      Math.sin(v2) * Math.cos(u2) * r,
      Math.cos(v2) * r * 0.7,
      Math.sin(v2) * Math.sin(u2) * r * 0.85
    ));
  }
  const ePos = [], eT = [], ePh = [];
  for (let i = 0; i < count; i++) {
    const near = pts.map((p, j) => ({ j, dd: i === j ? 1e9 : pts[i].distanceToSquared(p) }))
      .sort((a, b) => a.dd - b.dd);
    for (let k = 0; k < 2; k++) {
      const q = pts[near[k].j];
      const ph = Math.random();
      ePos.push(pts[i].x, pts[i].y, pts[i].z, q.x, q.y, q.z);
      eT.push(0, 1);
      ePh.push(ph, ph);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ePos), 3));
  lineGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(eT), 1));
  lineGeo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(ePh), 1));
  const lineUniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(9, 9, 9) } };
  const lineMat = new THREE.ShaderMaterial({
    uniforms: lineUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aT;
      attribute float aPhase;
      uniform vec3 uMouse;
      varying float vT;
      varying float vPh;
      varying float vM;
      void main() {
        vT = aT;
        vPh = aPhase;
        vM = exp(-distance(position, uMouse) * 1.2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying float vT;
      varying float vPh;
      varying float vM;
      void main() {
        float trip = fract(uTime * 0.5 + vPh);
        float s = exp(-abs(vT - trip) * 5.0);
        vec3 col = vec3(0.4, 0.26, 0.85) * 0.45 + s * vec3(1.25, 0.9, 1.65) + vM * vec3(0.9, 0.7, 1.3) * 0.7;
        gl_FragColor = vec4(col, 0.22 + s * 0.62 + vM * 0.35);
      }`,
  });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  const nPos = new Float32Array(count * 3);
  const nSeed = new Float32Array(count);
  pts.forEach((p, i) => { nPos[i * 3] = p.x; nPos[i * 3 + 1] = p.y; nPos[i * 3 + 2] = p.z; nSeed[i] = Math.random() * 10; });
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  ptGeo.setAttribute('aSeed', new THREE.BufferAttribute(nSeed, 1));
  const ptUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector3(9, 9, 9) },
    uPix: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };
  const ptMat = new THREE.ShaderMaterial({
    uniforms: ptUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPix;
      uniform vec3 uMouse;
      varying float vPulse;
      varying float vM;
      void main() {
        vM = exp(-distance(position, uMouse) * 1.4);
        vPulse = 0.55 + 0.45 * sin(uTime * 1.8 + aSeed * 9.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(uPix * (40.0 / -mv.z) * (0.7 + vPulse * 0.5 + vM), 1.0, 9.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vPulse;
      varying float vM;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * (0.45 + vPulse * 0.5 + vM * 0.7);
        gl_FragColor = vec4(vec3(0.85, 0.7, 1.2) + vM * 0.5, a);
      }`,
  });
  group.add(new THREE.Points(ptGeo, ptMat));

  g.add(group);
  world.neurons.push({ group, uniforms: { line: lineUniforms, pts: ptUniforms } });
}
