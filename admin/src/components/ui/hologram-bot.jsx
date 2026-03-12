'use client';

import React, { Suspense, useRef, useState, useMemo, useEffect } from 'react';
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

function BotModel({ dragRotationRef }) {
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

  const idleY = useRef(0);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    idleY.current += delta * 0.12;
    const dr = dragRotationRef?.current || [0, 0];
    groupRef.current.rotation.x = dr[0];
    groupRef.current.rotation.y = dr[1] + idleY.current;
  });

  return (
    <group ref={groupRef} scale={1.4}>
      <primitive object={cloned} />
      <EnergyRing />
      <EnergyRing radius={0.72} color={HOLO_PURPLE} />
    </group>
  );
}

function FallbackGeometry({ dragRotationRef }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const idleY = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      idleY.current += delta * 0.12;
      const dr = dragRotationRef?.current || [0, 0];
      groupRef.current.rotation.x = dr[0];
      groupRef.current.rotation.y = dr[1] + idleY.current;
    }
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.3;
      coreRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
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

function Scene({ dragRotationRef }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, 2]} intensity={0.4} color="#8b5cf6" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#00e5ff" />
      <Environment preset="night" />
      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>
        <ModelErrorBoundary fallback={<FallbackGeometry dragRotationRef={dragRotationRef} />}>
          <Suspense fallback={<FallbackGeometry dragRotationRef={dragRotationRef} />}>
            <BotModel dragRotationRef={dragRotationRef} />
          </Suspense>
        </ModelErrorBoundary>
      </Float>
      <Sparkles count={60} scale={3.5} size={1} speed={0.3} color="#00e5ff" opacity={0.5} />
    </>
  );
}

function HologramCanvas({ dragRotationRef }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', minHeight: 320, background: 'transparent' }}
    >
      <Scene dragRotationRef={dragRotationRef} />
    </Canvas>
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

function HologramBotWithDrag() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dragRotationRef = useRef([0, 0]);
  const isDragging = useRef(false);
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

  if (!mounted) return null;

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <OuterErrorBoundary>
        <HologramCanvas dragRotationRef={dragRotationRef} />
      </OuterErrorBoundary>
    </div>
  );
}

export default HologramBotWithDrag;
