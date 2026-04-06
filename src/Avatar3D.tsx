import React, {useRef, useMemo} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {Environment} from '@react-three/drei';
import * as THREE from 'three';
import type {MouthShape} from './lipSync';

// ========== Mouth shape for each viseme ==========
function MouthMesh({shape}: {shape: MouthShape}) {
  const params = useMemo(() => {
    switch (shape) {
      case 'A':
        return {w: 0.22, h: 0.14, open: true};
      case 'E':
        return {w: 0.2, h: 0.06, open: true};
      case 'I':
        return {w: 0.12, h: 0.08, open: true};
      case 'O':
        return {w: 0.14, h: 0.16, open: true};
      case 'U':
        return {w: 0.1, h: 0.12, open: true};
      case 'F':
        return {w: 0.18, h: 0.03, open: true};
      case 'L':
        return {w: 0.16, h: 0.08, open: true};
      case 'M':
        return {w: 0.18, h: 0.015, open: false};
      default:
        return {w: 0.18, h: 0.015, open: false};
    }
  }, [shape]);

  return (
    <group position={[0, -0.35, 0.83]}>
      {/* Lips line */}
      <mesh position={[0, 0.005, 0.005]}>
        <planeGeometry args={[params.w + 0.04, 0.02]} />
        <meshStandardMaterial color="#c1665a" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Mouth interior */}
      {params.open && (
        <mesh position={[0, -0.01, -0.005]}>
          <planeGeometry args={[params.w, params.h]} />
          <meshStandardMaterial color="#2a0505" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Teeth hint for wide open */}
      {params.open && params.h > 0.08 && (
        <mesh position={[0, 0.01, 0]}>
          <planeGeometry args={[params.w * 0.7, 0.03]} />
          <meshStandardMaterial color="#eeeee8" roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ========== Head component ==========
function Head({mouthShape, breatheY}: {mouthShape: MouthShape; breatheY: number}) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    idleRef.current += delta;
    groupRef.current.rotation.y = Math.sin(idleRef.current * 0.5) * 0.05;
    groupRef.current.rotation.x = Math.sin(idleRef.current * 0.3) * 0.02;
    groupRef.current.position.y = breatheY * 0.01;
  });

  const skinMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#f0c8a0',
        roughness: 0.55,
        metalness: 0.0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.8,
      }),
    [],
  );

  const hairMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a2e',
        roughness: 0.7,
        metalness: 0.1,
      }),
    [],
  );

  const suitMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a28',
        roughness: 0.6,
        metalness: 0.15,
      }),
    [],
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#888899',
        roughness: 0.3,
        metalness: 0.8,
      }),
    [],
  );

  const lensMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ddeeff',
        roughness: 0.1,
        metalness: 0.0,
        transmission: 0.85,
        thickness: 0.02,
        transparent: true,
        opacity: 0.2,
      }),
    [],
  );

  return (
    <group ref={groupRef}>
      {/* ===== HEAD ===== */}
      <mesh material={skinMat} position={[0, 0, 0]} scale={[1, 1.08, 0.95]}>
        <sphereGeometry args={[0.85, 64, 64]} />
      </mesh>

      {/* Jaw */}
      <mesh material={skinMat} position={[0, -0.35, 0.1]} scale={[0.9, 0.7, 0.85]}>
        <sphereGeometry args={[0.65, 32, 32]} />
      </mesh>

      {/* ===== EARS ===== */}
      <mesh material={skinMat} position={[-0.82, 0, 0]} scale={[0.5, 1.3, 0.8]}>
        <sphereGeometry args={[0.15, 16, 16]} />
      </mesh>
      <mesh material={skinMat} position={[0.82, 0, 0]} scale={[0.5, 1.3, 0.8]}>
        <sphereGeometry args={[0.15, 16, 16]} />
      </mesh>

      {/* ===== NECK ===== */}
      <mesh material={skinMat} position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.5, 16]} />
      </mesh>

      {/* ===== BODY / SUIT ===== */}
      <mesh material={suitMat} position={[0, -1.6, 0]} scale={[1, 1, 0.9]}>
        <boxGeometry args={[2.2, 0.9, 0.9]} />
      </mesh>
      <mesh material={suitMat} position={[0, -2.3, 0]}>
        <boxGeometry args={[1.8, 1.0, 0.8]} />
      </mesh>

      {/* Shirt V */}
      <mesh position={[0, -1.2, 0.39]}>
        <planeGeometry args={[0.35, 0.45]} />
        <meshStandardMaterial color="#f0f0f5" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Tie */}
      <mesh position={[0, -1.55, 0.42]}>
        <boxGeometry args={[0.1, 0.7, 0.02]} />
        <meshStandardMaterial color="#111122" roughness={0.5} />
      </mesh>
      <mesh position={[0, -1.18, 0.42]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#111122" roughness={0.5} />
      </mesh>

      {/* Lapels */}
      <mesh material={suitMat} position={[-0.22, -1.4, 0.41]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.18, 0.6, 0.03]} />
      </mesh>
      <mesh material={suitMat} position={[0.22, -1.4, 0.41]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.18, 0.6, 0.03]} />
      </mesh>

      {/* Crossed arms */}
      <mesh material={suitMat} position={[-0.5, -1.8, 0.3]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.9, 0.3, 0.35]} />
      </mesh>
      <mesh material={suitMat} position={[0.5, -1.8, 0.35]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.9, 0.3, 0.35]} />
      </mesh>

      {/* ===== EYES ===== */}
      {/* Left eye */}
      <group position={[-0.3, 0.1, 0.7]}>
        <mesh>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.07, 32, 32]} />
          <meshStandardMaterial color="#2c1810" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.11]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.1} />
        </mesh>
        <mesh position={[0.02, 0.03, 0.12]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Right eye */}
      <group position={[0.3, 0.1, 0.7]}>
        <mesh>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.07, 32, 32]} />
          <meshStandardMaterial color="#2c1810" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.11]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.1} />
        </mesh>
        <mesh position={[0.02, 0.03, 0.12]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* ===== EYEBROWS ===== */}
      <mesh position={[-0.3, 0.28, 0.74]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.22, 0.04, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, 0.28, 0.74]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.22, 0.04, 0.06]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>

      {/* ===== NOSE ===== */}
      <mesh material={skinMat} position={[0, -0.1, 0.85]} scale={[0.7, 1, 1]}>
        <sphereGeometry args={[0.08, 16, 16]} />
      </mesh>
      <mesh material={skinMat} position={[0, 0.05, 0.82]}>
        <boxGeometry args={[0.06, 0.2, 0.08]} />
      </mesh>

      {/* ===== GLASSES ===== */}
      {/* Left frame - rounded rectangle via torus */}
      <mesh material={glassMat} position={[-0.3, 0.1, 0.83]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.16, 0.015, 8, 4]} />
      </mesh>
      <mesh material={lensMat} position={[-0.3, 0.1, 0.83]}>
        <planeGeometry args={[0.28, 0.22]} />
      </mesh>
      {/* Right frame */}
      <mesh material={glassMat} position={[0.3, 0.1, 0.83]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.16, 0.015, 8, 4]} />
      </mesh>
      <mesh material={lensMat} position={[0.3, 0.1, 0.83]}>
        <planeGeometry args={[0.28, 0.22]} />
      </mesh>
      {/* Bridge */}
      <mesh material={glassMat} position={[0, 0.1, 0.86]}>
        <boxGeometry args={[0.12, 0.015, 0.015]} />
      </mesh>
      {/* Temples */}
      <mesh material={glassMat} position={[-0.55, 0.1, 0.55]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.015, 0.015]} />
      </mesh>
      <mesh material={glassMat} position={[0.55, 0.1, 0.55]} rotation={[0, -0.5, 0]}>
        <boxGeometry args={[0.4, 0.015, 0.015]} />
      </mesh>

      {/* ===== HAIR ===== */}
      {/* Main volume */}
      <mesh material={hairMat} position={[0, 0.55, 0]} scale={[1.05, 0.6, 1.0]}>
        <sphereGeometry args={[0.82, 32, 32]} />
      </mesh>
      {/* Top sweep */}
      <mesh material={hairMat} position={[0.1, 0.75, 0.15]} scale={[1.1, 0.45, 0.9]}>
        <sphereGeometry args={[0.6, 32, 32]} />
      </mesh>
      {/* Front sweep */}
      <mesh material={hairMat} position={[0.15, 0.6, 0.55]} scale={[1.2, 0.35, 0.6]}>
        <sphereGeometry args={[0.4, 16, 16]} />
      </mesh>
      {/* Side left */}
      <mesh material={hairMat} position={[-0.75, 0.2, 0.15]} scale={[0.5, 1.2, 0.8]}>
        <sphereGeometry args={[0.2, 16, 16]} />
      </mesh>
      {/* Side right */}
      <mesh material={hairMat} position={[0.75, 0.2, 0.15]} scale={[0.5, 1.2, 0.8]}>
        <sphereGeometry args={[0.2, 16, 16]} />
      </mesh>
      {/* Back */}
      <mesh material={hairMat} position={[0, 0.15, -0.5]} scale={[1.1, 0.9, 0.5]}>
        <sphereGeometry args={[0.7, 16, 16]} />
      </mesh>

      {/* ===== MOUTH ===== */}
      <MouthMesh shape={mouthShape} />
    </group>
  );
}

// ========== Main 3D Scene ==========
interface Avatar3DProps {
  mouthShape: MouthShape;
  breatheY: number;
}

export const Avatar3D: React.FC<Avatar3DProps> = ({mouthShape, breatheY}) => {
  return (
    <Canvas
      camera={{position: [0, -0.3, 4.5], fov: 35}}
      style={{width: '100%', height: '100%'}}
      gl={{antialias: true, alpha: true}}
    >
      <color attach="background" args={['#0f1828']} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.0} color="#fff5ee" />
      <directionalLight position={[-2, 2, 3]} intensity={0.4} color="#8899cc" />
      <pointLight position={[0, -1, 4]} intensity={0.3} color="#aabbff" />
      <directionalLight position={[0, 1, -3]} intensity={0.6} color="#4466aa" />

      <Environment preset="studio" />

      <Head mouthShape={mouthShape} breatheY={breatheY} />
    </Canvas>
  );
};
