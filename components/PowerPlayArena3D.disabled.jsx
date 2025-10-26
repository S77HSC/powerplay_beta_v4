'use client'
import React, { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Environment,
  OrbitControls,
  MeshReflectorMaterial,
  Float,
  Edges,
  Html,
  Instances,
  Instance,
  useTexture,
} from '@react-three/drei'
import { EffectComposer, Bloom, SMAA, Vignette, DepthOfField } from '@react-three/postprocessing'

/* ---------- Crowd shimmer (instanced quads) ---------- */
function Crowd({ rows = 6, cols = 70, width = 24, depth = 18 }) {
  const total = rows * cols
  const positions = useMemo(() => {
    const arr = []
    for (let r = 0; r < rows; r++) {
      const z = -6 - (r + 1) * (depth / rows)
      const y = 0.6 + r * 0.35
      for (let c = 0; c < cols; c++) {
        const x = -width / 2 + (c / (cols - 1)) * width + ((Math.random() - 0.5) * 0.1)
        arr.push([x, y, z])
      }
    }
    return arr
  }, [rows, cols, width, depth])

  const refs = useRef([])
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    refs.current.forEach((m, i) => {
      if (!m) return
      const flicker = 0.85 + 0.15 * Math.sin(t * 3 + i * 0.37)
      m.scale.y = flicker
      m.material.emissiveIntensity = 0.7 + 0.6 * flicker
    })
  })

  return (
    <Instances limit={total} position={[0, 0, 0]}>
      <planeGeometry args={[0.3, 0.6]} />
      <meshStandardMaterial color="#1a2547" emissive="#4aa8ff" emissiveIntensity={0.8} />
      {positions.map((p, i) => (
        <Instance ref={(el) => (refs.current[i] = el)} position={p} rotation={[-Math.PI / 2.4, 0, 0]} key={i} />
      ))}
    </Instances>
  )
}

/* ---------- Moving spotlights ---------- */
function SweepLights() {
  const left = useRef()
  const right = useRef()
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (left.current) {
      left.current.target.position.set(Math.sin(t * 0.6) * 6, 0, -8)
      left.current.target.updateMatrixWorld()
      left.current.position.set(-8, 7.5, -8 + Math.cos(t * 0.5) * 3)
    }
    if (right.current) {
      right.current.target.position.set(Math.sin(t * 0.5 + 0.8) * 6, 0, -8)
      right.current.target.updateMatrixWorld()
      right.current.position.set(8, 7.5, -8 + Math.sin(t * 0.45) * 3)
    }
  })
  return (
    <>
      <spotLight
        ref={left}
        color="#9fd6ff"
        castShadow
        intensity={2.4}
        angle={0.55}
        penumbra={0.6}
        position={[-8, 7.5, -6]}
      />
      <spotLight
        ref={right}
        color="#ff8ad2"
        castShadow
        intensity={2.2}
        angle={0.55}
        penumbra={0.6}
        position={[8, 7.5, -10]}
      />
    </>
  )
}

/* ---------- Neon frames / ribs ---------- */
function NeonFrame({ w = 22, h = 12, depth = 0.6, color = '#40d1ff', emissive = 2, y = 2.6, z = -6, scale = 1 }) {
  return (
    <group position={[0, y, z]} scale={scale}>
      <mesh>
        <boxGeometry args={[w, 0.22, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[-w / 2, -h / 2 + h * 0.5, 0]}>
        <boxGeometry args={[0.22, h, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[w / 2, -h / 2 + h * 0.5, 0]}>
        <boxGeometry args={[0.22, h, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
      </mesh>
    </group>
  )
}

/* ---------- Goals ---------- */
function Goal({ x = -12.6, color = '#40d1ff' }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 2.1, -9]} castShadow>
        <boxGeometry args={[0.28, 4.2, 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.25, 0, -9]}>
        <boxGeometry args={[0.25, 8, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[0.25, 0, -7]}>
        <boxGeometry args={[0.25, 8, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} />
      </mesh>
    </group>
  )
}

/* ---------- Arena shell ---------- */
function ArenaShell() {
  return (
    <group position={[0, -1.25, 0]}>
      {/* Reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 50]} />
        <MeshReflectorMaterial
          color="#0d1b2a"
          metalness={0.35}
          roughness={0.2}
          blur={[600, 100]}
          resolution={1024}
          mixStrength={3.2}
          mirror={0.35}
        />
      </mesh>

      {/* Terraces / bowl */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.35 + i * 0.8, -10 - i * 6]} castShadow receiveShadow>
          <boxGeometry args={[26, 0.7, 6]} />
          <meshStandardMaterial color="#0b172e" metalness={0.15} roughness={0.85} />
          <Edges color="#1b3b6d" />
        </mesh>
      ))}

      {/* Neon frames */}
      <NeonFrame color="#40d1ff" />
      <NeonFrame color="#ff56be" y={2.2} z={-12} scale={0.85} />

      {/* LED bars */}
      {[...Array(11)].map((_, i) => (
        <mesh key={i} position={[-11 + i * 2.2, 5, -6]} castShadow>
          <boxGeometry args={[1.8, 0.16, 0.16]} />
          <meshStandardMaterial color="#8ad8ff" emissive="#8ad8ff" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* Goals */}
      <Goal x={-12.6} color="#40d1ff" />
      <Goal x={12.6} color="#ff56be" />

      {/* Pitch markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[0.12, 50]} />
        <meshBasicMaterial color="#99b6ff" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.2, 3.38, 64]} />
        <meshBasicMaterial color="#99b6ff" />
      </mesh>

      {/* Crowd */}
      <Crowd />
    </group>
  )
}

/* ---------- Ball ---------- */
function PowerPlayBall() {
  const tex = useTexture('/powerplay-assets/v3_ball_powerplay.png')
  const ref = useRef()
  useFrame((_, dt) => (ref.current.rotation.y += dt * 0.6))
  return (
    <Float rotationIntensity={0.35} floatIntensity={0.6} speed={1.3}>
      <mesh ref={ref} position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.46, 64, 64]} />
        <meshPhysicalMaterial
          map={tex}
          clearcoat={0.95}
          clearcoatRoughness={0.1}
          roughness={0.3}
          metalness={0.1}
          envMapIntensity={1.6}
        />
      </mesh>
    </Float>
  )
}

/* ---------- Main ---------- */
export default function PowerPlayArena3D() {
  return (
    <div className="relative mx-auto h-[calc(100vh-80px)] w-[min(1280px,95vw)] overflow-hidden rounded-2xl border border-white/10 bg-black">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 6.5, 14], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, physicallyCorrectLights: true }}
      >
        <color attach="background" args={['#070d1b']} />
        <fog attach="fog" args={['#070d1b', 20, 70]} />

        <hemisphereLight intensity={0.7} color="#cfe0ff" groundColor="#0b1120" />
        <directionalLight
          castShadow
          position={[6, 9, 10]}
          intensity={1.1}
          color="#9fd6ff"
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <SweepLights />

        <Suspense fallback={<Html center className="text-white/80">Loading arena…</Html>}>
          <Environment preset="city" background={false} />
          <ArenaShell />
          <PowerPlayBall />
        </Suspense>

        <EffectComposer multisampling={0}>
          <SMAA />
          <Bloom intensity={1.25} luminanceThreshold={0.22} luminanceSmoothing={0.08} />
          <DepthOfField focusDistance={0.018} focalLength={0.025} bokehScale={1.8} />
          <Vignette eskil offset={0.22} darkness={0.9} />
        </EffectComposer>

        <OrbitControls enablePan={false} minDistance={10} maxDistance={20} />
      </Canvas>
    </div>
  )
}
