'use client';

import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';

const HOLO_CYAN = new THREE.Color(0x00e5ff);
const HOLO_PURPLE = new THREE.Color(0x8b5cf6);

function EnergyRing({ radius = 0.6, color = HOLO_CYAN }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.4;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <torusGeometry args={[radius, 0.02, 16, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.2}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function BotModel() {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/bot.glb', true);

  const cloned = useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: HOLO_CYAN,
          emissive: HOLO_CYAN,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.92,
          roughness: 0.3,
          metalness: 0.5,
        });
      }
    });
    return s;
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <group ref={groupRef} scale={1.4} position={[0, -1.01, 0]}>
      <primitive object={cloned} />
      <EnergyRing />
      <EnergyRing radius={0.72} color={HOLO_PURPLE} />
    </group>
  );
}

function FallbackGeometry() {
  const groupRef = useRef();
  const coreRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.12;
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.3;
      coreRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.01, 0]}>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color={HOLO_CYAN}
          emissive={HOLO_CYAN}
          emissiveIntensity={0.6}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial
          color={HOLO_PURPLE}
          emissive={HOLO_PURPLE}
          emissiveIntensity={1}
          transparent
          opacity={0.5}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial color={HOLO_CYAN} wireframe transparent opacity={0.3} />
      </mesh>
      <EnergyRing />
      <EnergyRing radius={0.72} color={HOLO_PURPLE} />
    </group>
  );
}

class ModelErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, 2]} intensity={0.4} color="#8b5cf6" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#00e5ff" />
      <Environment preset="night" />
      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>
        <ModelErrorBoundary fallback={<FallbackGeometry />}>
          <Suspense fallback={<FallbackGeometry />}>
            <BotModel />
          </Suspense>
        </ModelErrorBoundary>
      </Float>
      <Sparkles count={60} scale={3.5} size={1} speed={0.3} color="#00e5ff" opacity={0.5} />
    </>
  );
}

class OuterErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function HologramBot() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <OuterErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 8.125], fov: 38 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Scene />
        </Canvas>
      </OuterErrorBoundary>
    </div>
  );
}

export default HologramBot;
