// Procedural "neural vein" network authored in the hero plane's local space
// (x in [-ASPECT, ASPECT], y in [-1, 1]). Branches grow from the flower base out
// into the three petals; the engine flows energy pulses along them and lights
// them near the cursor. Returns faint line geometry + a dense point cloud whose
// per-point path parameter drives the travelling pulse.
import * as THREE from 'three'

export const ASPECT = 2.0

type V2 = [number, number]
interface Strand { pts: V2[] }

const rnd = () => Math.random()
const rot = ([x, y]: V2, a: number): V2 => {
  const c = Math.cos(a), s = Math.sin(a)
  return [x * c - y * s, x * s + y * c]
}
const norm = ([x, y]: V2): V2 => {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

function grow(start: V2, dir: V2, len: number, steps: number, depth: number, out: Strand[]) {
  const pts: V2[] = [start]
  let p = start
  let d = norm(dir)
  for (let i = 0; i < steps; i++) {
    d = norm(rot(d, (rnd() - 0.5) * 0.5))
    p = [p[0] + d[0] * (len / steps), p[1] + d[1] * (len / steps)]
    pts.push(p)
    if (depth > 0 && i > 1 && rnd() < 0.4) {
      const side = rnd() < 0.5 ? 1 : -1
      grow(p, rot(d, side * (0.5 + rnd() * 0.7)), len * 0.55, Math.max(3, steps - 2), depth - 1, out)
    }
  }
  out.push({ pts })
}

export interface VeinGeo {
  lines: THREE.BufferGeometry
  points: THREE.BufferGeometry
}

export function buildVeins(): VeinGeo {
  const base: V2 = [0, -0.32]
  // main branches aimed at the iris structure: up spike, two upper falls, two lower
  const targets: V2[] = [
    [0, 0.9], [-1.5, 0.15], [1.5, 0.15], [-0.55, -0.75], [0.6, -0.7], [-0.15, 0.55], [0.2, 0.5],
  ]
  const strands: Strand[] = []
  for (const t of targets) {
    const dir: V2 = [t[0] - base[0], t[1] - base[1]]
    const len = Math.hypot(dir[0], dir[1]) * 1.05
    grow(base, dir, len, 9, 2, strands)
  }

  // faint line segments
  const linePos: number[] = []
  for (const s of strands) {
    for (let i = 0; i < s.pts.length - 1; i++) {
      linePos.push(s.pts[i][0], s.pts[i][1], 0.02, s.pts[i + 1][0], s.pts[i + 1][1], 0.02)
    }
  }
  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3))

  // dense point cloud, aT increases outward for the flow direction
  const pos: number[] = []
  const aT: number[] = []
  const aPhase: number[] = []
  const aHue: number[] = []
  const aRnd: number[] = []
  const SUB = 4
  for (const s of strands) {
    const phase = rnd()
    const hue = rnd()
    const total = (s.pts.length - 1) * SUB
    let k = 0
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i], b = s.pts[i + 1]
      for (let j = 0; j < SUB; j++) {
        const f = j / SUB
        pos.push(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.03)
        aT.push(k / total)
        aPhase.push(phase)
        aHue.push(hue)
        aRnd.push(rnd())
        k++
      }
    }
  }
  const points = new THREE.BufferGeometry()
  points.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  points.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1))
  points.setAttribute('aPhase', new THREE.Float32BufferAttribute(aPhase, 1))
  points.setAttribute('aHue', new THREE.Float32BufferAttribute(aHue, 1))
  points.setAttribute('aRnd', new THREE.Float32BufferAttribute(aRnd, 1))
  return { lines, points }
}
