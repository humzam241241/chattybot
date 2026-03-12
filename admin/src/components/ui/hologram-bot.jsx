'use client';

import React, { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  useGLTF,
  Float,
  Sparkles,
  Environment,
  useCursor,
} from '@react-three/drei';
import * as THREE from 'three';

const HOLO_COLOR = new THREE.Color(0x00e5ff);

function EnergyRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <torusGeometry args={[0.6, 0.03, 16, 48]} />
      <meshStandardMaterial
        color={HOLO_COLOR}
        emissive={HOLO_COLOR}
        emissiveIntensity={1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

class HologramErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function BotModel({ dragRotationRef }) {
  const groupRef = useRef();
  const [hovered, setHover] = useState(false);
  useCursor(hovered, 'grab');

  const { scene } = useGLTF('/models/bot.glb', true);
  const cloned = useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: HOLO_COLOR,
          emissive: HOLO_COLOR,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.9,
          roughness: 0.3,
          metalness: 0.5,
        });
      }
    });
    return s;
  }, [scene]);

  const idleY = useRef(0);
  useFrame((_, delta) => {
    if (!groupRef.current || !dragRotationRef.current) return;
    const [dx, dy] = dragRotationRef.current;
    idleY.current += delta * 0.12;
    groupRef.current.rotation.x = dx;
    groupRef.current.rotation.y = dy + idleY.current;
  });

  return (
    <group ref={groupRef} scale={1.4} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <primitive object={cloned} />
      <EnergyRing />
    </group>
  );
}

function FallbackBot() {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.2;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color={HOLO_COLOR}
          emissive={HOLO_COLOR}
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      <EnergyRing />
    </group>
  );
}

function Scene({ dragRotationRef }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} />
      <Environment preset="night" />
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
        <HologramErrorBoundary fallback={<FallbackBot />}>
          <Suspense fallback={<FallbackBot />}>
            <BotModel dragRotationRef={dragRotationRef} />
          </Suspense>
        </HologramErrorBoundary>
      </Float>
      <Sparkles
        count={80}
        scale={4}
        size={1.2}
        speed={0.3}
        color={HOLO_COLOR}
        opacity={0.6}
      />
    </>
  );
}

function HologramBotInner({ dragRotationRef }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5], fov: 42 }}
      frameloop="always"
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', minHeight: 320, background: 'transparent' }}
    >
      <Scene dragRotationRef={dragRotationRef} />
    </Canvas>
  );
}

function HologramBotWithDrag() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dragRotationRef = useRef([0, 0]);
  const prev = useRef([0, 0]);

  const onPointerDown = (e) => {
    isDragging.current = true;
    prev.current = [e.clientX, e.clientY];
  };
  const onPointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = (e.clientX - prev.current[0]) * 0.01;
    const dy = (e.clientY - prev.current[1]) * 0.01;
    prev.current = [e.clientX, e.clientY];
    dragRotationRef.current = [
      dragRotationRef.current[0] + dy,
      dragRotationRef.current[1] + dx,
    ];
  };
  const onPointerUp = () => { isDragging.current = false; };
  const onPointerLeave = () => { isDragging.current = false; };

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <HologramBotInner dragRotationRef={dragRotationRef} />
    </div>
  );
}

export default HologramBotWithDrag;
