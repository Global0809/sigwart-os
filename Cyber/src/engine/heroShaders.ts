// Hero image shaders. The plane samples the iris photo with a cursor-driven
// liquid refraction ripple, velocity-scaled chromatic aberration, and live
// data colour-grading (poor air desaturates + dims it). The vein points animate
// a travelling pulse and light up near the cursor.

export const planeVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const planeFrag = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uTime;
uniform vec2  uMouseUv;   // cursor in 0..1 plane uv
uniform float uMouseV;    // pointer speed 0..1
uniform float uHealth;    // 0..1
varying vec2 vUv;

void main(){
  vec2 uv = vUv;

  // liquid refraction ripple radiating from the cursor
  vec2 d = uv - uMouseUv;
  float dist = length(d);
  float ring = sin(dist * 32.0 - uTime * 4.0) * exp(-dist * 6.0);
  uv += normalize(d + 1e-5) * ring * (0.010 + uMouseV * 0.03);

  // chromatic aberration (radial + cursor velocity)
  vec2 ca = (uv - 0.5) * (0.0022 + uMouseV * 0.012);
  vec3 col;
  col.r = texture2D(uMap, uv + ca).r;
  col.g = texture2D(uMap, uv).g;
  col.b = texture2D(uMap, uv - ca).b;

  // live grading: clean air = vivid + bright, poor air = desaturated + dim
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, mix(0.35, 1.18, uHealth));
  col *= mix(0.55, 1.12, uHealth);
  col += col * 0.12 * sin(uTime * 0.5 + vUv.x * 9.0);   // faint iridescent shimmer

  gl_FragColor = vec4(col, 1.0);
}
`

export const veinVert = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform vec2  uMouseWorld;
uniform float uSpeed;
attribute float aT;
attribute float aPhase;
attribute float aHue;
attribute float aRnd;
varying float vB;
varying float vHue;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // travelling pulse: bright band sweeps outward along the strand
  float w = fract(aT - uTime * uSpeed + aPhase);
  float pulse = exp(-pow(w * 6.0, 2.0)) + 0.12;
  // cursor proximity glow (world space)
  float dm = distance(position.xy, uMouseWorld);
  float near = exp(-dm * dm * 2.0);
  vB = pulse * (0.5 + near * 2.2);
  vHue = aHue;
  gl_PointSize = clamp(uSize * (0.6 + aRnd) * (1.0 + near * 2.0) * (34.0 / -mv.z), 1.0, 8.0);
  gl_Position = projectionMatrix * mv;
}
`

export const veinFrag = /* glsl */ `
precision highp float;
uniform vec3 uColA;
uniform vec3 uColB;
varying float vB;
varying float vHue;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vB;
  vec3 col = mix(uColA, uColB, vHue);
  gl_FragColor = vec4(col * a, a);
}
`
