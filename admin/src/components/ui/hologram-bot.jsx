'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HOLO_COLOR = new THREE.Color(0x00e5ff);
const HOLO_COLOR_2 = new THREE.Color(0x8b5cf6);

function EnergyRing() {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.5;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
      <torusGeometry args={[0.5, 0.02, 16, 48]} />
      <meshStandardMaterial
        color={HOLO_COLOR}
        emissive={HOLO_COLOR}
        emissiveIntensity={1.5}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function HologramBot3D() {
  const groupRef = useRef();
  const coreRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
    }
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.3;
      coreRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main body - octahedron */}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color={HOLO_COLOR}
          emissive={HOLO_COLOR}
          emissiveIntensity={0.6}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0.8}
          wireframe={false}
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial
          color={HOLO_COLOR_2}
          emissive={HOLO_COLOR_2}
          emissiveIntensity={1}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Outer wireframe */}
      <mesh>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial
          color={HOLO_COLOR}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      <EnergyRing />

      {/* Second ring */}
      <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0]}>
        <torusGeometry args={[0.65, 0.015, 16, 48]} />
        <meshStandardMaterial
          color={HOLO_COLOR_2}
          emissive={HOLO_COLOR_2}
          emissiveIntensity={1}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

function Particles() {
  const count = 50;
  const ref = useRef();
  
  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 1;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={HOLO_COLOR}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, 2]} intensity={0.4} color="#8b5cf6" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color={HOLO_COLOR} />
      <HologramBot3D />
      <Particles />
    </>
  );
}

function HologramCanvas() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', minHeight: 320, background: 'transparent' }}
    >
      <Scene />
    </Canvas>
  );
}

function HologramBotWithDrag() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
        <span>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
        <span>3D preview</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320 }}>
      <ErrorBoundary onError={() => setError(true)}>
        <HologramCanvas />
      </ErrorBoundary>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {
    if (this.props.onError) this.props.onError();
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
          <span>3D preview</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default HologramBotWithDrag;
