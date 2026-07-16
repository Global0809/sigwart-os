// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — Act I · Mystery
// A sealed celestial instrument sleeps in the void. It breathes. Its
// engravings remember light. The guest holds it awake — and it does not
// break; it becomes everything that follows.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { GU, C, NOISE_GLSL, GOLD_GLSL, goldMaterial, glowMaterial, flameMaterial } from './materials.js';
import { PALETTE } from './config.js';
import { clamp, lerp, easeOutElastic, easeOutCubic } from './utils.js';

export class ActOne {
  constructor({ audio, onShatter }) {
    this.audio = audio;
    this.onShatter = onShatter;
    this.group = new THREE.Group();

    this.charge = 0;          // 0..1 while holding
    this.holding = false;
    this.shattered = false;
    this.emergence = 0;       // intro fade-in, time-driven
    this._age = 0;
    this._beatPhase = 0;

    this._buildCore();
    this._buildRings();
    this._buildFlame();
    this._buildAura();
    this._buildShockwave();
    this._bindInput();
  }

  // ── the engraved heart of the instrument ──────────────────────────────────
  _buildCore() {
    this.coreU = {
      uTime: GU.uTime,
      uFogColor: GU.uFogColor, uFogDensity: GU.uFogDensity,
      uAwaken: { value: 0 },     // engravings fill with light, foot → crown
      uBeat: { value: 0 },       // heartbeat flash
      uEmerge: { value: 0 },
      uDeep: { value: C(PALETTE.goldDeep) },
      uBase: { value: C(0xa8752c) },
      uHot: { value: C(PALETTE.goldHot) },
      uRuby: { value: C(PALETTE.ruby) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.coreU,
      vertexShader: /* glsl */`
        uniform float uTime, uAwaken, uBeat, uEmerge;
        varying vec3 vN; varying vec3 vW; varying vec3 vP;
        ${NOISE_GLSL}
        void main(){
          vP = position;
          // the sphere breathes — slow tide plus the heartbeat
          float breathe = sin(uTime * 0.9) * 0.012 + noise3(position * 2.0 + uTime * 0.12) * 0.01;
          breathe += uBeat * 0.05 + uAwaken * 0.02;
          vec3 pos = position * (1.0 + breathe * uEmerge);
          vec4 w = modelMatrix * vec4(pos, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uAwaken, uBeat, uEmerge;
        uniform vec3 uDeep, uBase, uHot, uRuby;
        varying vec3 vN; varying vec3 vW; varying vec3 vP;
        ${NOISE_GLSL} ${GOLD_GLSL}
        uniform vec3 uFogColor; uniform float uFogDensity;
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          vec3 p = normalize(vP);
          float az = atan(p.z, p.x);
          float el = asin(clamp(p.y, -1.0, 1.0));           // -π/2..π/2
          float band = (el / 1.5708) * 0.5 + 0.5;           // 0 foot → 1 crown

          // ── engraving: petals, latitude rings, meridian filigree ──
          float warp = fbm(vP * 3.0) * 0.35;
          float petals = abs(sin(az * 8.0 + sin(el * 5.0 + warp) * 1.4));
          float lat = abs(sin(el * 14.0 + warp * 2.0));
          float meridian = abs(sin(az * 24.0 + el * 3.0));
          float g1 = smoothstep(0.12, 0.02, petals);        // broad petal lines
          float g2 = smoothstep(0.08, 0.01, lat) * 0.8;     // ring grooves
          float g3 = smoothstep(0.05, 0.005, meridian) * 0.5 * smoothstep(0.6, 0.0, abs(p.y));
          float groove = clamp(g1 + g2 + g3, 0.0, 1.0);

          // ── base metal, aged in the hollows ──
          vec3 col = goldShade(N, V, uDeep * 0.55, uBase, uHot, uTime);
          col *= 1.0 - groove * 0.82;
          col *= 0.35 + 0.65 * uEmerge;

          // ── light remembers itself: fill grooves from the foot upward ──
          float fill = smoothstep(band - 0.06, band + 0.02, uAwaken * 1.12);
          float flicker = 0.75 + 0.25 * sin(uTime * 6.0 + band * 20.0);
          vec3 ember = mix(uRuby, uHot, clamp(band + 0.25, 0.0, 1.0));
          col += ember * groove * fill * flicker * (1.2 + uBeat * 2.4);

          // heat shimmer at the crack of dawn line
          float dawnLine = exp(-abs(band - uAwaken * 1.12) * 22.0) * step(0.01, uAwaken);
          col += uHot * dawnLine * groove * 2.2;

          // heartbeat glow through the shell
          col += uRuby * uBeat * 0.16 * uEmerge;

          float f = 1.0 - exp(-uFogDensity * uFogDensity * dot(cameraPosition - vW, cameraPosition - vW));
          col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat);
    this.group.add(this.core);
  }

  // ── three gyroscopic rings, tilted like an astrolabe ──────────────────────
  _buildRings() {
    this.rings = [];
    const specs = [
      { r: 1.55, tube: 0.045, tilt: new THREE.Euler(0.45, 0, 0.2), speed: 0.11 },
      { r: 1.92, tube: 0.038, tilt: new THREE.Euler(-0.6, 0.3, -0.35), speed: -0.07 },
      { r: 2.3, tube: 0.03, tilt: new THREE.Euler(0.2, -0.5, 1.25), speed: 0.045 },
    ];
    specs.forEach((s, i) => {
      const pivot = new THREE.Group();
      pivot.rotation.copy(s.tilt);
      const mat = goldMaterial({ engrave: 1, emissive: 0.9 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, s.tube, 24, 200), mat);
      pivot.add(ring);
      // a single jewel rides each ring
      const jewel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.075, 0),
        glowMaterial(PALETTE.ruby, 1.4),
      );
      jewel.position.set(s.r, 0, 0);
      pivot.add(jewel);
      this.group.add(pivot);
      this.rings.push({ pivot, ring, jewel, ...s, phase: i * 2.1 });
    });
  }

  // ── the sealed flame — revealed only when the shell gives way ────────────
  _buildFlame() {
    this.flame = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), flameMaterial(1));
    this.flame.material.uniforms.uAlpha.value = 0;
    this.flame.position.y = 0.25;
    this.flameGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMaterial(0xff9a3c, 2.8));
    this.flameGlow.material.uniforms.uAlpha.value = 0;
    this.group.add(this.flame, this.flameGlow);
  }

  _buildAura() {
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), glowMaterial(0xd88a2a, 3.4));
    this.aura.material.uniforms.uAlpha.value = 0;
    this.aura.position.z = -1.5;
    this.group.add(this.aura);
  }

  _buildShockwave() {
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 128),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uColor: { value: C(PALETTE.goldHot) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */`
          uniform float uT; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            float a = (1.0 - uT) * (1.0 - uT) * 1.4;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      }),
    );
    this.wave.visible = false;
    this.group.add(this.wave);
  }

  _bindInput() {
    const down = (e) => {
      if (this.shattered || this.emergence < 0.95) return;
      if (e.target && e.target.closest && e.target.closest('.ui')) return;
      this.holding = true;
      this.audio.start(); // first gesture — the hall may now hum
      document.body.classList.add('is-holding');
    };
    const up = () => {
      this.holding = false;
      document.body.classList.remove('is-holding');
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.repeat) down(e);
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Enter') up(); });
  }

  _shatter() {
    if (this.shattered) return;
    this.shattered = true;
    this.holding = false;
    document.body.classList.remove('is-holding');
    this._shatterAge = 0;
    this.wave.visible = true;
    this.audio.setCharge(0);
    this.audio.shatter();
    this.onShatter();
  }

  // ctx: { t, dt, camera, reduced }
  update(ctx) {
    const { dt, t } = ctx;
    this._age += dt;

    // slow emergence from absolute darkness
    this.emergence = clamp((this._age - 1.2) / 3.6, 0, 1);
    const em = easeOutCubic(this.emergence);
    this.coreU.uEmerge.value = em;
    this.aura.material.uniforms.uAlpha.value = em * 0.4 * (1 - (this.shattered ? this._shatterFade ?? 0 : 0));

    // charge while holding — release lets it sigh back down
    if (!this.shattered) {
      const speed = ctx.reduced ? 0.9 : 0.55;
      this.charge = clamp(this.charge + (this.holding ? dt * speed : -dt * 0.5), 0, 1);
      this.audio.setCharge(this.holding ? this.charge : 0);
      if (this.charge >= 1) this._shatter();
    }

    // heartbeat — accelerates as it wakes
    const rate = 1.1 + this.charge * 3.4;
    this._beatPhase += dt * rate;
    const beat = Math.pow(Math.max(0, Math.sin(this._beatPhase * Math.PI * 2)), 12);
    this.coreU.uBeat.value = beat * (0.25 + this.charge);
    this.coreU.uAwaken.value = this.charge;

    // rings: unfold at emergence, accelerate with charge
    this.rings.forEach((r, i) => {
      const unfold = easeOutElastic(clamp((this._age - 1.8 - i * 0.5) / 2.2, 0, 1));
      r.pivot.scale.setScalar(Math.max(0.001, unfold));
      r.pivot.rotation.z = r.tilt.z + (1 - unfold) * 2.2;
      const spin = r.speed * (1 + this.charge * 7);
      r.ring.rotation.z += spin * dt * 3;
      r.pivot.rotation.y += spin * dt;
      r.jewel.material.uniforms.uAlpha.value = em * (0.5 + this.charge);
      const jr = r.r;
      const a = t * spin * 3 + r.phase;
      r.jewel.position.set(Math.cos(a) * jr, Math.sin(a) * jr, 0);
    });

    // shatter choreography
    if (this.shattered) {
      this._shatterAge += dt;
      const s = this._shatterAge;
      const gone = clamp(s / 0.45, 0, 1);
      this._shatterFade = gone;
      this.core.scale.setScalar(Math.max(0.001, 1 - gone));
      this.rings.forEach((r, i) => {
        r.pivot.scale.setScalar(Math.max(0.001, (1 - gone) * (1 + s * (2 + i))));
        r.ring.material.uniforms.uReveal.value = 1 - gone;
      });
      // the flame survives, alone in the dark, then leads us on
      const fl = clamp((s - 0.25) / 0.8, 0, 1);
      const drift = clamp((s - 2.2) / 2.4, 0, 1);
      this.flame.material.uniforms.uAlpha.value = fl * (1 - drift);
      this.flame.scale.setScalar(0.7 + fl * 0.5 + drift * 2.5);
      this.flameGlow.material.uniforms.uAlpha.value = fl * 0.85 * (1 - drift);
      this.flameGlow.scale.setScalar(1 + drift * 3);
      // shockwave
      const w = clamp(s / 1.4, 0, 1);
      this.wave.material.uniforms.uT.value = w;
      this.wave.scale.setScalar(1 + w * 46);
      if (w >= 1) this.wave.visible = false;
      if (gone >= 1) { this.core.visible = false; this.rings.forEach(r => r.pivot.visible = false); }
    }

    // everything faces the guest
    this.aura.lookAt(ctx.camera.position);
    this.flameGlow.lookAt(ctx.camera.position);
    this.wave.lookAt(ctx.camera.position);
  }
}
