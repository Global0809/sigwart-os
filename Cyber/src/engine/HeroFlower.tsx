// The reactive hero: the iris photo on a plane with a neural-vein point cloud,
// all in one group so they zoom/pan together. Cursor drives a liquid refraction
// ripple + vein glow; the scroll wheel zooms toward the pointer with inertia;
// the live Biosphere Index grades the image.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useEnv } from '../state/store'
import { buildVeins, ASPECT } from './veins'
import { planeVert, planeFrag, veinVert, veinFrag } from './heroShaders'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function HeroFlower() {
  const tex = useTexture('/hero.jpg')
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.minFilter = THREE.LinearMipmapLinearFilter
  }, [tex])

  const vein = useMemo(buildVeins, [])

  const planeUniforms = useMemo(
    () => ({
      uMap: { value: tex },
      uTime: { value: 0 },
      uMouseUv: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseV: { value: 0 },
      uHealth: { value: 0.7 },
    }),
    [tex],
  )
  const veinUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 2.6 },
      uSpeed: { value: 0.14 },
      uMouseWorld: { value: new THREE.Vector2(0, 0) },
      uColA: { value: new THREE.Color('#39f0d8') },
      uColB: { value: new THREE.Color('#ff2d78') },
    }),
    [],
  )

  const planeMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: planeVert, fragmentShader: planeFrag, uniforms: planeUniforms }),
    [planeUniforms],
  )
  const veinMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: veinVert, fragmentShader: veinFrag, uniforms: veinUniforms,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
    [veinUniforms],
  )
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: new THREE.Color('#39f0d8'), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  )

  const group = useRef<THREE.Group>(null!)
  const ndc = useRef({ x: 0, y: 0 })
  const prevNdc = useRef({ x: 0, y: 0 })
  const mouseWorld = useRef({ x: 0, y: 0 })
  const tScale = useRef(0)
  const tPos = useRef({ x: 0, y: 0 })
  const fitRef = useRef(1)
  const velRef = useRef(0)

  const { camera, size } = useThree()

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      ndc.current.x = (e.clientX / window.innerWidth) * 2 - 1
      ndc.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0012)
      const fit = fitRef.current
      const cur = tScale.current || fit
      const s = clamp(cur * factor, fit, fit * 5)
      const mw = mouseWorld.current
      const lx = (mw.x - tPos.current.x) / cur
      const ly = (mw.y - tPos.current.y) / cur
      tScale.current = s
      tPos.current.x = mw.x - s * lx
      tPos.current.y = mw.y - s * ly
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera
    const visH = 2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.z
    const visW = visH * (size.width / size.height)
    const fit = visH / 2
    fitRef.current = fit
    if (tScale.current === 0) tScale.current = fit
    tScale.current = clamp(tScale.current, fit, fit * 5)
    if (tScale.current <= fit * 1.002) { tPos.current.x = 0; tPos.current.y = 0 }

    // pointer → world + uv, velocity
    const nx = ndc.current.x, ny = ndc.current.y
    const mwx = nx * visW * 0.5, mwy = ny * visH * 0.5
    mouseWorld.current.x = mwx
    mouseWorld.current.y = mwy
    const vel = Math.min(1, (Math.hypot(nx - prevNdc.current.x, ny - prevNdc.current.y) / Math.max(dt, 1e-4)) * 0.35)
    prevNdc.current.x = nx; prevNdc.current.y = ny
    velRef.current += (vel - velRef.current) * Math.min(1, dt * 6)

    const g = group.current
    const k = Math.min(1, dt * 6)
    g.scale.setScalar(lerp(g.scale.x || fit, tScale.current, k))
    g.position.x = lerp(g.position.x, tPos.current.x, k)
    g.position.y = lerp(g.position.y, tPos.current.y, k)

    // local → uv (using smoothed transform)
    const lx = (mwx - g.position.x) / (g.scale.x || 1)
    const ly = (mwy - g.position.y) / (g.scale.x || 1)
    planeUniforms.uMouseUv.value.set(lx / (2 * ASPECT) + 0.5, ly / 2 + 0.5)
    veinUniforms.uMouseWorld.value.set(lx, ly)

    const snap = useEnv.getState().snapshot
    const health = snap?.derived.health ?? 0.7
    planeUniforms.uTime.value += dt
    planeUniforms.uMouseV.value = velRef.current
    planeUniforms.uHealth.value += (health - planeUniforms.uHealth.value) * Math.min(1, dt)
    veinUniforms.uTime.value += dt
    veinUniforms.uSpeed.value = 0.12 + velRef.current * 0.35
  })

  return (
    <group ref={group}>
      <mesh material={planeMat}>
        <planeGeometry args={[2 * ASPECT, 2]} />
      </mesh>
      <lineSegments geometry={vein.lines} material={lineMat} frustumCulled={false} />
      <points geometry={vein.points} material={veinMat} frustumCulled={false} />
    </group>
  )
}
