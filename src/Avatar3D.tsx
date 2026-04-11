import React, {useRef, useMemo, useState} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {Environment, Stars} from '@react-three/drei';
import * as THREE from 'three';
import type {MouthShape} from './lipSync';

// ========== Space background with nebula and particles ==========
// ========== Shooting star ==========
function ShootingStar() {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const stateRef = useRef({
    active: false,
    timer: Math.random() * 5 + 3, // first one in 3–8s
    x: 0, y: 0, z: -10,
    vx: 0, vy: 0,
    life: 0,
    maxLife: 0.6 + Math.random() * 0.5,
  });

  useFrame((_, delta) => {
    const s = stateRef.current;

    if (!s.active) {
      s.timer -= delta;
      if (s.timer <= 0) {
        s.active = true;
        s.x = (Math.random() - 0.3) * 14;
        s.y = Math.random() * 4 + 3;
        s.z = -8 - Math.random() * 15;
        const angle = -0.4 - Math.random() * 0.8;
        const speed = 8 + Math.random() * 6;
        s.vx = Math.cos(angle) * speed;
        s.vy = Math.sin(angle) * speed;
        s.life = 0;
      }
    }

    if (s.active) {
      s.life += delta;
      s.x += s.vx * delta;
      s.y += s.vy * delta;

      const progress = s.life / s.maxLife;
      const fadeIn = Math.min(progress * 5, 1);
      const fadeOut = Math.max(1 - (progress - 0.5) * 2, 0);
      const opacity = fadeIn * fadeOut;
      const trailLen = 0.8 + progress * 1.5;

      if (meshRef.current) {
        meshRef.current.position.set(s.x, s.y, s.z);
        meshRef.current.visible = true;
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      }

      if (trailRef.current) {
        const trailAngle = Math.atan2(s.vy, s.vx);
        trailRef.current.position.set(
          s.x - Math.cos(trailAngle) * trailLen * 0.5,
          s.y - Math.sin(trailAngle) * trailLen * 0.5,
          s.z,
        );
        trailRef.current.rotation.z = trailAngle;
        trailRef.current.scale.set(trailLen, 1, 1);
        trailRef.current.visible = true;
        (trailRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
      }

      if (s.life >= s.maxLife) {
        s.active = false;
        s.timer = 3 + Math.random() * 6;
        if (meshRef.current) meshRef.current.visible = false;
        if (trailRef.current) trailRef.current.visible = false;
      }
    }
  });

  return (
    <>
      <mesh ref={meshRef} visible={false}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>
      <mesh ref={trailRef} visible={false}>
        <planeGeometry args={[1, 0.04]} />
        <meshBasicMaterial color="#aaccff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// Fiery meteor
function ShootingMeteor() {
  const headRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const emberRef = useRef<THREE.Points>(null);
  const state = useRef({active: false, timer: Math.random() * 6 + 2, x: 0, y: 0, z: -10, vx: 0, vy: 0, life: 0, maxLife: 0});

  useFrame((_, delta) => {
    const s = state.current;
    if (!s.active) {
      s.timer -= delta;
      if (s.timer <= 0) {
        s.active = true;
        s.x = (Math.random() - 0.3) * 14;
        s.y = Math.random() * 6 + 2;
        s.z = -8 - Math.random() * 15;
        const angle = -0.6 - Math.random() * 0.6;
        const speed = 14 + Math.random() * 8;
        s.vx = Math.cos(angle) * speed;
        s.vy = Math.sin(angle) * speed;
        s.life = 0;
        s.maxLife = 0.9 + Math.random() * 0.6;
      }
    }
    if (s.active) {
      s.life += delta;
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      const progress = s.life / s.maxLife;
      const opacity = Math.max(1 - progress * 1.2, 0);
      const trailLen = 1.2 + progress * 2.5;

      if (headRef.current) {
        headRef.current.position.set(s.x, s.y, s.z);
        headRef.current.visible = true;
        (headRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
      if (trailRef.current) {
        const angle = Math.atan2(s.vy, s.vx);
        trailRef.current.position.set(s.x - Math.cos(angle) * trailLen * 0.6, s.y - Math.sin(angle) * trailLen * 0.6, s.z);
        trailRef.current.rotation.z = angle;
        trailRef.current.scale.set(trailLen, 1, 1);
        trailRef.current.visible = true;
        (trailRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
      }

      if (emberRef.current) {
        emberRef.current.position.set(s.x, s.y, s.z);
        emberRef.current.visible = true;
      }

      if (s.life >= s.maxLife) {
        s.active = false;
        s.timer = 4 + Math.random() * 8;
        if (headRef.current) headRef.current.visible = false;
        if (trailRef.current) trailRef.current.visible = false;
        if (emberRef.current) emberRef.current.visible = false;
      }
    }
  });

  // ember particle geometry
  const emberGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 60;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  return (
    <>
      <mesh ref={headRef} visible={false}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#ff8c00" transparent opacity={0} />
      </mesh>
      <mesh ref={trailRef} visible={false}>
        <planeGeometry args={[1.6, 0.12]} />
        <meshBasicMaterial color="#ff511a" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <points ref={emberRef} geometry={emberGeo} visible={false}>
        <pointsMaterial size={0.04} color="#ffcc66" transparent opacity={0.9} depthWrite={false} />
      </points>
    </>
  );
}

function SpaceBackground() {
  const nebulaRef = useRef<THREE.Group>(null);

  // Shooting stars handled by ShootingStar components
  useFrame((_, delta) => {
    if (nebulaRef.current) nebulaRef.current.rotation.z += delta * 0.01;
  });

  return (
    <>
      {/* Starfield */}
      <Stars radius={80} depth={60} count={3000} factor={3} saturation={0.2} fade speed={0.5} />



      {/* Nebula clouds */}
      <group ref={nebulaRef}>
        <mesh position={[-4, 3, -22]}>
          <sphereGeometry args={[4, 16, 16]} />
          <meshBasicMaterial color="#2a0845" transparent opacity={0.12} />
        </mesh>
        <mesh position={[5, -2, -24]}>
          <sphereGeometry args={[5, 16, 16]} />
          <meshBasicMaterial color="#0a1545" transparent opacity={0.15} />
        </mesh>
        <mesh position={[2, 4, -26]}>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#301520" transparent opacity={0.08} />
        </mesh>
      </group>

      {/* Shooting stars (increased frequency) + fiery meteors */}
      <ShootingStar />
      <ShootingStar />
      <ShootingStar />
      <ShootingStar />
      <ShootingMeteor />
      <ShootingMeteor />

      {/* Subtle distant glow */}
      <mesh position={[0, -3, -12]}> 
        <planeGeometry args={[60, 10]} />
        <meshBasicMaterial color="#000010" transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ========== Mouth shape for each viseme ==========
function MouthMesh({shape, isSpeaking}: {shape: MouthShape; isSpeaking: boolean}) {
  const params = useMemo(() => {
    // Idle smile when not speaking and mouth is closed
    if (!isSpeaking && (shape === 'closed' || shape === 'M')) {
      return {w: 0.18, h: 0.015, open: false, smile: true};
    }
    switch (shape) {
      case 'A':
        return {w: 0.22, h: 0.14, open: true, smile: false};
      case 'E':
        return {w: 0.2, h: 0.06, open: true, smile: false};
      case 'I':
        return {w: 0.12, h: 0.08, open: true, smile: false};
      case 'O':
        return {w: 0.14, h: 0.16, open: true, smile: false};
      case 'U':
        return {w: 0.1, h: 0.12, open: true, smile: false};
      case 'F':
        return {w: 0.18, h: 0.03, open: true, smile: false};
      case 'L':
        return {w: 0.16, h: 0.08, open: true, smile: false};
      case 'M':
        return {w: 0.18, h: 0.015, open: false, smile: false};
      default:
        return {w: 0.18, h: 0.015, open: false, smile: false};
    }
  }, [shape, isSpeaking]);

  return (
    <group position={[0, -0.35, 0.83]}>
      {/* Lips / smile curve */}
      {params.smile ? (
        <>
          {/* Smile - curved lip line */}
          <mesh position={[0, 0.005, 0.005]}>
            <planeGeometry args={[0.22, 0.02]} />
            <meshStandardMaterial color="#c1665a" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* Left smile corner - angled up */}
          <mesh position={[-0.1, 0.02, 0.005]} rotation={[0, 0, 0.4]}>
            <planeGeometry args={[0.05, 0.015]} />
            <meshStandardMaterial color="#c1665a" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* Right smile corner - angled up */}
          <mesh position={[0.1, 0.02, 0.005]} rotation={[0, 0, -0.4]}>
            <planeGeometry args={[0.05, 0.015]} />
            <meshStandardMaterial color="#c1665a" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </>
      ) : (
        <>
          {/* Normal lips line */}
          <mesh position={[0, 0.005, 0.005]}>
            <planeGeometry args={[params.w + 0.04, 0.02]} />
            <meshStandardMaterial color="#c1665a" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
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

// ========== Eyelid for blinking ==========
// Rounded eyelid that slides down from just below the eyebrow to cover the eye.
// Uses a sphere scaled flat so it blends smoothly with the face curvature.
// blinkAmount: 0 = open (lid tucked under brow), 1 = closed (lid covers eye)
function Eyelid({side, blinkAmount, skinMat}: {side: 'left' | 'right'; blinkAmount: number; skinMat: THREE.Material}) {
  const x = side === 'left' ? -0.3 : 0.3;
  // Lid slides from hidden above eye (y=0.22) to eye center (y=0.1)
  const lidY = 0.22 - blinkAmount * 0.12;
  return (
    <mesh material={skinMat} position={[x, lidY, 0.76]} scale={[1.1, 0.5, 0.6]}>
      <sphereGeometry args={[0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  );
}

// ========== Head component ==========
function Head({mouthShape, breatheY, isSpeaking}: {mouthShape: MouthShape; breatheY: number; isSpeaking: boolean}) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRef = useRef(0);
  const [blinkAmount, setBlinkAmount] = useState(0); // 0 = open, 1 = closed
  const nextBlinkRef = useRef(Math.random() * 3 + 1.5);
  const blinkPhaseRef = useRef<'idle' | 'closing' | 'opening'>('idle');
  const blinkTimerRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    idleRef.current += delta;
    groupRef.current.rotation.y = Math.sin(idleRef.current * 0.5) * 0.05;
    groupRef.current.rotation.x = Math.sin(idleRef.current * 0.3) * 0.02;
    groupRef.current.position.y = breatheY * 0.01;

    // Random blink logic
    blinkTimerRef.current += delta;
    if (blinkPhaseRef.current === 'idle') {
      if (blinkTimerRef.current >= nextBlinkRef.current) {
        blinkPhaseRef.current = 'closing';
        blinkTimerRef.current = 0;
      }
    } else if (blinkPhaseRef.current === 'closing') {
      const t = Math.min(blinkTimerRef.current / 0.07, 1);
      setBlinkAmount(t);
      if (t >= 1) {
        blinkPhaseRef.current = 'opening';
        blinkTimerRef.current = 0;
      }
    } else if (blinkPhaseRef.current === 'opening') {
      const t = Math.min(blinkTimerRef.current / 0.1, 1);
      setBlinkAmount(1 - t);
      if (t >= 1) {
        blinkPhaseRef.current = 'idle';
        blinkTimerRef.current = 0;
        nextBlinkRef.current = Math.random() * 4 + 1.5; // 1.5–5.5s between blinks
      }
    }
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
      new THREE.MeshPhysicalMaterial({
        color: '#e84393',
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
        sheen: 1.0,
        sheenColor: new THREE.Color('#ff6eb4'),
        sheenRoughness: 0.3,
      }),
    [],
  );

  const hairHighlightMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ff8cc8',
        roughness: 0.3,
        metalness: 0.05,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        sheen: 1.0,
        sheenColor: new THREE.Color('#ffb6d9'),
        sheenRoughness: 0.2,
      }),
    [],
  );

  const hairDarkMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#c0306b',
        roughness: 0.4,
        metalness: 0.05,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        sheen: 0.8,
        sheenColor: new THREE.Color('#e84393'),
        sheenRoughness: 0.3,
      }),
    [],
  );

  const suitMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1a1a28',
        roughness: 0.55,
        metalness: 0.1,
        clearcoat: 0.15,
        clearcoatRoughness: 0.6,
      }),
    [],
  );

  const shirtMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#f5f5fa',
        roughness: 0.4,
        metalness: 0.0,
        clearcoat: 0.05,
      }),
    [],
  );

  const tieMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0a0a18',
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
      }),
    [],
  );

  const buttonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#222233',
        roughness: 0.2,
        metalness: 0.6,
      }),
    [],
  );

  const pocketMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8e8f0',
        roughness: 0.3,
        metalness: 0.0,
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

      {/* --- Base torso --- */}
      <mesh material={suitMat} position={[0, -1.75, 0]} scale={[1, 1, 0.8]}>
        <cylinderGeometry args={[0.72, 0.65, 1.3, 32]} />
      </mesh>

      {/* --- Chest --- */}
      <mesh material={suitMat} position={[0, -1.25, 0.02]} scale={[0.95, 0.75, 0.82]}>
        <sphereGeometry args={[0.78, 32, 20]} />
      </mesh>

      {/* --- Shoulders (natural slope) --- */}
      <mesh material={suitMat} position={[-0.7, -1.15, -0.02]} scale={[0.8, 0.45, 0.6]}>
        <sphereGeometry args={[0.48, 24, 16]} />
      </mesh>
      <mesh material={suitMat} position={[0.7, -1.15, -0.02]} scale={[0.8, 0.45, 0.6]}>
        <sphereGeometry args={[0.48, 24, 16]} />
      </mesh>

      {/* --- Upper arms --- */}
      <mesh material={suitMat} position={[-0.92, -1.45, 0]} rotation={[0, 0, 0.15]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.17, 0.45, 8, 16]} />
      </mesh>
      <mesh material={suitMat} position={[0.92, -1.45, 0]} rotation={[0, 0, -0.15]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.17, 0.45, 8, 16]} />
      </mesh>

      {/* --- Shirt front panel (visible under jacket) --- */}
      <mesh material={shirtMat} position={[0, -1.3, 0.48]} scale={[1, 1, 1]}>
        <planeGeometry args={[0.32, 0.65]} />
      </mesh>

      {/* --- Shirt collar left --- */}
      <mesh material={shirtMat} position={[-0.12, -1.0, 0.46]} rotation={[0.1, 0.2, 0.45]} scale={[1, 0.6, 0.5]}>
        <capsuleGeometry args={[0.05, 0.12, 4, 8]} />
      </mesh>
      {/* --- Shirt collar right --- */}
      <mesh material={shirtMat} position={[0.12, -1.0, 0.46]} rotation={[0.1, -0.2, -0.45]} scale={[1, 0.6, 0.5]}>
        <capsuleGeometry args={[0.05, 0.12, 4, 8]} />
      </mesh>

      {/* --- Bow tie --- */}
      {/* Left wing */}
      <mesh material={tieMat} position={[-0.065, -1.05, 0.5]} rotation={[0, 0, 0.3]} scale={[1.2, 0.6, 0.5]}>
        <sphereGeometry args={[0.05, 12, 8]} />
      </mesh>
      {/* Right wing */}
      <mesh material={tieMat} position={[0.065, -1.05, 0.5]} rotation={[0, 0, -0.3]} scale={[1.2, 0.6, 0.5]}>
        <sphereGeometry args={[0.05, 12, 8]} />
      </mesh>
      {/* Center knot */}
      <mesh material={tieMat} position={[0, -1.05, 0.52]}>
        <sphereGeometry args={[0.025, 8, 8]} />
      </mesh>

      {/* --- Suit jacket lapels (V-shape) --- */}
      {/* Left lapel */}
      <mesh material={suitMat} position={[-0.2, -1.3, 0.5]} rotation={[0.05, 0.1, 0.3]} scale={[0.6, 1, 0.2]}>
        <capsuleGeometry args={[0.08, 0.4, 6, 12]} />
      </mesh>
      {/* Right lapel */}
      <mesh material={suitMat} position={[0.2, -1.3, 0.5]} rotation={[0.05, -0.1, -0.3]} scale={[0.6, 1, 0.2]}>
        <capsuleGeometry args={[0.08, 0.4, 6, 12]} />
      </mesh>

      {/* --- Suit buttons --- */}
      <mesh material={buttonMat} position={[0, -1.35, 0.53]}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>
      <mesh material={buttonMat} position={[0, -1.5, 0.51]}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>

      {/* --- Pocket square (left breast) --- */}
      <mesh material={pocketMat} position={[-0.28, -1.25, 0.52]} rotation={[0, 0, 0.1]} scale={[1, 1, 0.3]}>
        <boxGeometry args={[0.07, 0.04, 0.04]} />
      </mesh>
      {/* Pocket square fabric peeking out */}
      <mesh material={pocketMat} position={[-0.28, -1.22, 0.53]} rotation={[0.2, 0, 0.15]} scale={[0.8, 0.6, 0.3]}>
        <sphereGeometry args={[0.03, 8, 6]} />
      </mesh>

      {/* --- Crossed arms --- */}
      {/* Left forearm (crosses to right) */}
      <mesh material={suitMat} position={[-0.3, -1.72, 0.38]} rotation={[0.15, 0.3, 0.5]} scale={[1, 1, 0.85]}>
        <capsuleGeometry args={[0.15, 0.55, 8, 16]} />
      </mesh>
      {/* Right forearm (crosses to left) */}
      <mesh material={suitMat} position={[0.3, -1.72, 0.4]} rotation={[0.15, -0.3, -0.5]} scale={[1, 1, 0.85]}>
        <capsuleGeometry args={[0.15, 0.55, 8, 16]} />
      </mesh>
      {/* Left hand */}
      <mesh material={skinMat} position={[0.55, -1.6, 0.42]} scale={[0.7, 0.5, 0.5]}>
        <sphereGeometry args={[0.1, 12, 8]} />
      </mesh>
      {/* Right hand */}
      <mesh material={skinMat} position={[-0.55, -1.6, 0.4]} scale={[0.7, 0.5, 0.5]}>
        <sphereGeometry args={[0.1, 12, 8]} />
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

      {/* ===== EYELIDS (blink) ===== */}
      <Eyelid side="left" blinkAmount={blinkAmount} skinMat={skinMat} />
      <Eyelid side="right" blinkAmount={blinkAmount} skinMat={skinMat} />

      {/* ===== EYEBROWS ===== */}
      {/* Rounded eyebrows that sit above the eyelids, z pushed forward */}
      <mesh position={[-0.3, 0.28, 0.79]} rotation={[0.15, 0, 0.1]} scale={[1, 0.35, 0.5]}>
        <sphereGeometry args={[0.13, 16, 8]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, 0.28, 0.79]} rotation={[0.15, 0, -0.1]} scale={[1, 0.35, 0.5]}>
        <sphereGeometry args={[0.13, 16, 8]} />
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

      {/* ===== HAIR (stylish pink) ===== */}

      {/* Base volume - dark pink underlay */}
      <mesh material={hairDarkMat} position={[0, 0.5, -0.05]} scale={[1.08, 0.6, 1.0]}>
        <sphereGeometry args={[0.84, 32, 32]} />
      </mesh>

      {/* Main top volume - swept dramatically to the right */}
      <mesh material={hairMat} position={[0.12, 0.72, 0.1]} scale={[1.15, 0.5, 0.95]}>
        <sphereGeometry args={[0.65, 32, 32]} />
      </mesh>

      {/* High swept spike - dramatic upward sweep */}
      <mesh material={hairHighlightMat} position={[0.25, 0.9, 0.05]} scale={[0.6, 0.55, 0.5]} rotation={[0, 0, -0.3]}>
        <sphereGeometry args={[0.4, 24, 16]} />
      </mesh>

      {/* Front fringe - sweeping across forehead */}
      <mesh material={hairMat} position={[0.2, 0.6, 0.58]} scale={[1.3, 0.32, 0.55]}>
        <sphereGeometry args={[0.38, 24, 16]} />
      </mesh>
      {/* Fringe highlight strand */}
      <mesh material={hairHighlightMat} position={[0.35, 0.58, 0.55]} scale={[0.6, 0.25, 0.4]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[0.3, 16, 12]} />
      </mesh>

      {/* Left side - textured layers */}
      <mesh material={hairDarkMat} position={[-0.72, 0.3, 0.1]} scale={[0.45, 0.9, 0.7]}>
        <sphereGeometry args={[0.25, 16, 16]} />
      </mesh>
      <mesh material={hairMat} position={[-0.65, 0.15, 0.2]} scale={[0.4, 0.7, 0.6]}>
        <sphereGeometry args={[0.22, 16, 12]} />
      </mesh>

      {/* Right side - longer stylish layers */}
      <mesh material={hairMat} position={[0.72, 0.35, 0.1]} scale={[0.5, 1.0, 0.7]}>
        <sphereGeometry args={[0.25, 16, 16]} />
      </mesh>
      <mesh material={hairHighlightMat} position={[0.68, 0.15, 0.18]} scale={[0.4, 0.8, 0.55]}>
        <sphereGeometry args={[0.22, 16, 12]} />
      </mesh>

      {/* Back volume */}
      <mesh material={hairDarkMat} position={[0, 0.2, -0.48]} scale={[1.12, 0.85, 0.5]}>
        <sphereGeometry args={[0.7, 24, 16]} />
      </mesh>
      {/* Back nape - tapered */}
      <mesh material={hairMat} position={[0, -0.05, -0.42]} scale={[0.8, 0.5, 0.4]}>
        <sphereGeometry args={[0.45, 16, 12]} />
      </mesh>

      {/* Extra spiky wisps on top for edginess */}
      <mesh material={hairHighlightMat} position={[-0.15, 0.85, 0.2]} scale={[0.35, 0.4, 0.35]} rotation={[0.1, 0, 0.4]}>
        <sphereGeometry args={[0.3, 12, 10]} />
      </mesh>
      <mesh material={hairMat} position={[0.4, 0.82, -0.05]} scale={[0.3, 0.35, 0.4]} rotation={[0, 0, -0.5]}>
        <sphereGeometry args={[0.28, 12, 10]} />
      </mesh>

      {/* ===== MOUTH ===== */}

      {/* MOUSTACHE (stylized) */}
      <group position={[0, -0.22, 0.82]}>
        {/* Left curl */}
        <mesh position={[-0.12, 0.02, 0]} rotation={[0, 0, 0.5]} scale={[1, 0.35, 0.5]}>
          <capsuleGeometry args={[0.04, 0.09, 6, 12]} />
          <meshStandardMaterial color="#2c1b12" roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Right curl */}
        <mesh position={[0.12, 0.02, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.35, 0.5]}>
          <capsuleGeometry args={[0.04, 0.09, 6, 12]} />
          <meshStandardMaterial color="#2c1b12" roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Center stache */}
        <mesh position={[0, 0.01, 0]} scale={[1, 0.25, 0.4]}>
          <boxGeometry args={[0.18, 0.04, 0.04]} />
          <meshStandardMaterial color="#2c1b12" roughness={0.6} metalness={0.02} />
        </mesh>
      </group>

      <MouthMesh shape={mouthShape} isSpeaking={isSpeaking} />
    </group>
  );
}

// ========== Main 3D Scene ==========
interface Avatar3DProps {
  mouthShape: MouthShape;
  breatheY: number;
  isSpeaking?: boolean;
  isMobile?: boolean;
}

export const Avatar3D: React.FC<Avatar3DProps> = ({mouthShape, breatheY, isSpeaking = false, isMobile = false}) => {
  const cameraPos = isMobile ? [0, -0.2, 6.5] : [0, -0.3, 4.5];
  const fov = isMobile ? 30 : 35;
  return (
    <Canvas
      camera={{position: cameraPos, fov}}
      style={{width: '100%', height: '100%'}}
      gl={{antialias: true, alpha: true}}
    >
      <color attach="background" args={['#030510']} />

      {/* Space background */}
      <SpaceBackground />

      {/* Lighting — slightly cooler for space feel */}
      <ambientLight intensity={0.35} color="#aabbdd" />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color="#eef0ff" />
      <directionalLight position={[-2, 2, 3]} intensity={0.35} color="#7788bb" />
      <pointLight position={[0, -1, 4]} intensity={0.25} color="#8899dd" />
      {/* Rim light — blue edge glow */}
      <directionalLight position={[0, 1, -3]} intensity={0.7} color="#3355aa" />
      {/* Subtle bottom fill */}
      <pointLight position={[0, -3, 2]} intensity={0.15} color="#443366" />

      <Environment preset="night" />

      <Head mouthShape={mouthShape} breatheY={breatheY} isSpeaking={isSpeaking} />
    </Canvas>
  );
};
