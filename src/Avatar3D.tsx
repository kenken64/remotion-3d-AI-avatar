import React, {useRef, useMemo, useEffect, useState} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {Environment, PerspectiveCamera, Stars, useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import type {MouthShape} from './lipSync';

// Matches `base: '/remotion'` in vite.config.ts.
const AVATAR_URL = '/remotion/avatar.glb';
useGLTF.preload(AVATAR_URL);

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
      {/* Starfield (expanded so it fills the frustum) */}
      <Stars radius={200} depth={140} count={4000} factor={4} saturation={0.15} fade speed={0.4} />

      {/* Nebula clouds (pushed further back + larger) */}
      <group ref={nebulaRef}>
        <mesh position={[-6, 4, -40]}>
          <sphereGeometry args={[10, 24, 24]} />
          <meshBasicMaterial color="#2a0845" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[7, -3, -44]}>
          <sphereGeometry args={[12, 24, 24]} />
          <meshBasicMaterial color="#0a1545" transparent opacity={0.14} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[3, 5, -48]}>
          <sphereGeometry args={[8, 20, 20]} />
          <meshBasicMaterial color="#301520" transparent opacity={0.09} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      {/* Shooting stars + meteors */}
      <ShootingStar />
      <ShootingStar />
      <ShootingStar />
      <ShootingStar />
      <ShootingMeteor />
      <ShootingMeteor />

      {/* Subtle distant glow (pushed far back so it doesn't cut the scene) */}
      <mesh position={[0, -8, -60]}>
        <planeGeometry args={[180, 60]} />
        <meshBasicMaterial color="#000010" transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ========== Realistic GLB-driven avatar ==========

// Map our viseme enum onto the Oculus visemes baked into the GLB.
const VISEME_FOR_SHAPE: Record<MouthShape, string> = {
  A: 'viseme_aa',
  E: 'viseme_E',
  I: 'viseme_I',
  O: 'viseme_O',
  U: 'viseme_U',
  F: 'viseme_FF',
  L: 'viseme_nn',
  M: 'viseme_PP',
  closed: 'viseme_sil',
};

const ALL_VISEMES = Array.from(new Set(Object.values(VISEME_FOR_SHAPE)));

function GLBAvatar({mouthShape, breatheY, isSpeaking}: {mouthShape: MouthShape; breatheY: number; isSpeaking: boolean}) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRef = useRef(0);
  const [avatarScale, setAvatarScale] = useState(1);

  // Blink state machine — ported from the previous primitive-head version.
  const blinkRef = useRef({
    amount: 0,
    phase: 'idle' as 'idle' | 'closing' | 'opening',
    timer: 0,
    nextBlinkIn: Math.random() * 3 + 1.5,
  });

  const {scene} = useGLTF(AVATAR_URL);

  // Re-root the cloned GLB under a plain Group so transforms apply normally
  // when this asset is mounted inside the scene graph.
  const sceneClone = useMemo(() => {
    const clone = scene.clone(true);
    const root = new THREE.Group();
    while (clone.children.length > 0) {
      root.add(clone.children[0]);
    }
    return root;
  }, [scene]);

  // Normalize against the rendered geometry so framing stays stable even if
  // the rig's bone origins don't line up with the visible head.
  useEffect(() => {
    sceneClone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 2.35;

    setAvatarScale(size.y > 0 ? targetHeight / size.y : 1);
  }, [sceneClone]);

  // Collect every skinned mesh that has morph targets so we can drive them in lockstep.
  const morphMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    sceneClone.traverse((obj) => {
      const sm = obj as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh && sm.morphTargetDictionary && sm.morphTargetInfluences) {
        meshes.push(sm);
      }
    });
    return meshes;
  }, [sceneClone]);

  // Resolve target weights (visemes + blink + idle smile) for the current frame.
  const computeTargetWeights = (
    shape: MouthShape,
    speaking: boolean,
    blinkAmount: number,
  ): Record<string, number> => {
    const w: Record<string, number> = {};
    for (const v of ALL_VISEMES) w[v] = 0;
    const active = VISEME_FOR_SHAPE[shape] ?? 'viseme_sil';
    if (speaking) {
      w[active] = 1;
      w.mouthSmile = 0;
    } else {
      w.viseme_sil = 1;
      w.mouthSmile = 0.25; // gentle resting smile
    }
    w.eyeBlinkLeft = blinkAmount;
    w.eyeBlinkRight = blinkAmount;
    return w;
  };

  // Surface what morphs are actually present once, for sanity-checking.
  useEffect(() => {
    if (morphMeshes.length === 0) {
      console.warn('[Avatar3D] GLB has no morph targets — face animation will not work.');
      return;
    }
    const sample = morphMeshes[0];
    const dict = sample.morphTargetDictionary!;
    const missing = ALL_VISEMES.concat(['eyeBlinkLeft', 'eyeBlinkRight']).filter(
      (n) => !(n in dict),
    );
    if (missing.length) {
      console.warn('[Avatar3D] GLB is missing expected morph targets:', missing);
    }
  }, [morphMeshes]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Idle motion + breathing — applied to the whole avatar group.
    idleRef.current += delta;
    groupRef.current.rotation.y = Math.sin(idleRef.current * 0.5) * 0.04;
    groupRef.current.rotation.x = Math.sin(idleRef.current * 0.3) * 0.015;

    // Blink state machine.
    const b = blinkRef.current;
    b.timer += delta;
    if (b.phase === 'idle') {
      if (b.timer >= b.nextBlinkIn) {
        b.phase = 'closing';
        b.timer = 0;
      }
    } else if (b.phase === 'closing') {
      const t = Math.min(b.timer / 0.07, 1);
      b.amount = t;
      if (t >= 1) {
        b.phase = 'opening';
        b.timer = 0;
      }
    } else if (b.phase === 'opening') {
      const t = Math.min(b.timer / 0.1, 1);
      b.amount = 1 - t;
      if (t >= 1) {
        b.phase = 'idle';
        b.timer = 0;
        b.nextBlinkIn = Math.random() * 4 + 1.5;
      }
    }

    // Lerp every relevant morph influence toward its target — a hard switch
    // looks fine on a cartoon mouth but jarring on a realistic face.
    const targetWeights = computeTargetWeights(mouthShape, isSpeaking, b.amount);
    const lerpFactor = Math.min(1, delta * 14);
    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const inf = mesh.morphTargetInfluences!;
      for (const name in targetWeights) {
        const idx = dict[name];
        if (idx === undefined) continue;
        inf[idx] += (targetWeights[name] - inf[idx]) * lerpFactor;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, breatheY * 0.01, 0]}
      scale={1}
    >
      <primitive object={sceneClone} position={[0, -180, 0]} scale={avatarScale} />
    </group>
  );
}

function FramedCamera({position, target, fov}: {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.position.set(position[0], position[1], position[2]);
    cameraRef.current.lookAt(target[0], target[1], target[2]);
    cameraRef.current.updateProjectionMatrix();
  }, [position, target, fov]);

  return <PerspectiveCamera ref={cameraRef} makeDefault position={position} fov={fov} />;
}

// ========== Main 3D Scene ==========
interface Avatar3DProps {
  mouthShape: MouthShape;
  breatheY: number;
  isSpeaking?: boolean;
  isMobile?: boolean;
}

export const Avatar3D: React.FC<Avatar3DProps> = ({mouthShape, breatheY, isSpeaking = false, isMobile = false}) => {
  const cameraPos: [number, number, number] = isMobile ? [0, 1.95, 2.15] : [0, 1.8, 1.95];
  const cameraTarget: [number, number, number] = isMobile ? [0, 1.7, 0] : [0, 1.55, 0];
  const fov = isMobile ? 26 : 22;

  return (
    <Canvas
      style={{width: '100%', height: '100%'}}
      gl={{antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping}}
    >
      <FramedCamera position={cameraPos} target={cameraTarget} fov={fov} />

      <color attach="background" args={['#030510']} />

      {/* Space background */}
      <SpaceBackground />

      {/* Lighting — neutral key/fill so the realistic skin reads correctly,
          plus a cool rim to integrate with the space scene. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-2.5, 1.5, 2]} intensity={0.55} color="#ffe8d4" />
      <directionalLight position={[0, 1.5, -3]} intensity={0.9} color="#5577cc" />
      <pointLight position={[0, -1, 3]} intensity={0.3} color="#ffffff" />

      <Environment preset="studio" />

      <GLBAvatar mouthShape={mouthShape} breatheY={breatheY} isSpeaking={isSpeaking} />
    </Canvas>
  );
};
