// Central WebGL stage: the reactive iris hero + neural veins, with a restrained
// post stack so the photo stays crisp (bloom only on highlights/veins).
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  EffectComposer, Bloom, ChromaticAberration, Noise, Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { HeroFlower } from './HeroFlower'

function PostFX() {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofx')) return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.85} mipmapBlur radius={0.6} />
      <ChromaticAberration
        offset={new THREE.Vector2(0.0006, 0.0009)}
        radialModulation
        modulationOffset={0.4}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise premultiply opacity={0.045} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.18} darkness={0.95} />
    </EffectComposer>
  )
}

export function Biosphere() {
  return (
    <Canvas
      className="stage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 100 }}
    >
      <color attach="background" args={['#000000']} />
      <Suspense fallback={null}>
        <HeroFlower />
        <PostFX />
      </Suspense>
    </Canvas>
  )
}
