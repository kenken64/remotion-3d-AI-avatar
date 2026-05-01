import React, {useRef, useMemo, useEffect, useState, Suspense} from 'react';
import {Canvas, useFrame} from '@react-three/fiber';
import {Environment, PerspectiveCamera, Stars, useGLTF, useTexture, Html, useProgress} from '@react-three/drei';
import * as THREE from 'three';
import type {MouthShape} from './lipSync';

// Inlined version of three/examples/jsm/utils/SkeletonUtils.clone(). Uses our
// deduped `three` instance — importing from the examples path pulls in a 2nd
// copy of three.js (Vite's dedupe doesn't reach the examples/jsm subtree),
// which silently breaks rendering of the cloned scene.
function parallelTraverse(
  a: THREE.Object3D,
  b: THREE.Object3D,
  cb: (x: THREE.Object3D, y: THREE.Object3D) => void,
) {
  cb(a, b);
  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], cb);
  }
}

function cloneSkeleton(source: THREE.Object3D): THREE.Object3D {
  const sourceLookup = new Map<THREE.Object3D, THREE.Object3D>();
  const cloneLookup = new Map<THREE.Object3D, THREE.Object3D>();
  const clone = source.clone();
  parallelTraverse(source, clone, (s, c) => {
    sourceLookup.set(c, s);
    cloneLookup.set(s, c);
  });
  clone.traverse((node) => {
    const skinned = node as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const sourceMesh = sourceLookup.get(node) as THREE.SkinnedMesh;
    const sourceSkeleton = sourceMesh.skeleton;
    skinned.skeleton = sourceSkeleton.clone();
    skinned.bindMatrix.copy(sourceMesh.bindMatrix);
    skinned.skeleton.bones = sourceSkeleton.bones.map(
      (b) => cloneLookup.get(b) as THREE.Bone,
    );
    skinned.bind(skinned.skeleton, skinned.bindMatrix);
  });
  return clone;
}

// Matches `base: '/remotion'` in vite.config.ts.
const AVATAR_URL = '/remotion/avatar.glb';
const BACKGROUND_URL = '/remotion/background.webp';
useGLTF.preload(AVATAR_URL);
useTexture.preload(BACKGROUND_URL);

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

function ImageBackdrop() {
  const texture = useTexture(BACKGROUND_URL);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, 0, -58]}>
      <planeGeometry args={[178, 100]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SpaceBackground() {
  return (
    <>
      <ImageBackdrop />

      {/* Starfield (expanded so it fills the frustum) */}
      <Stars radius={200} depth={140} count={4000} factor={4} saturation={0.15} fade speed={0.4} />

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
        <meshBasicMaterial color="#001018" transparent opacity={0.18} side={THREE.DoubleSide} />
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

// Reused per frame in the arm-bone loop to avoid allocation churn.
const _armEuler = new THREE.Euler();
const _armOffset = new THREE.Quaternion();
const _gestureEuler = new THREE.Euler();
const _gestureOffset = new THREE.Quaternion();
const _groupGestureEuler = new THREE.Euler();
const _idleQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _parentWorldQuat = new THREE.Quaternion();
const _vecAlong = new THREE.Vector3();
const _vecTarget = new THREE.Vector3();

// Wave-gesture targets in WORLD space. aimBoneAtWorldDir bypasses bone-axis
// quirks of the rig — point each bone's "along" direction at these vectors.
const WAVE_RIGHT_ARM_DIR = new THREE.Vector3(-0.55, 0.15, 0.85).normalize(); // forward + side so hand is beside the face
const WAVE_RIGHT_FOREARM_DIR = new THREE.Vector3(0, 1, 0); // straight up (forms the L)

function aimBoneAtWorldDir(bone: THREE.Object3D, worldDir: THREE.Vector3, outQuat: THREE.Quaternion) {
  let child: THREE.Object3D | undefined;
  for (const c of bone.children) {
    if ((c as THREE.Bone).isBone) {
      child = c;
      break;
    }
  }
  if (!child) {
    outQuat.identity();
    return;
  }
  _vecAlong.copy(child.position).normalize();
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_parentWorldQuat);
    _parentWorldQuat.invert();
  } else {
    _parentWorldQuat.identity();
  }
  _vecTarget.copy(worldDir).applyQuaternion(_parentWorldQuat).normalize();
  outQuat.setFromUnitVectors(_vecAlong, _vecTarget);
}

function smoothstep(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

// Trapezoid envelope: rises slowly (first 35%), holds, then falls in the
// last 25%. Asymmetric because raising a real arm takes longer than dropping
// it — and a fast raise reads as cartoonish.
function envHold(progress: number): number {
  if (progress < 0.35) return smoothstep(progress / 0.35);
  if (progress > 0.75) return smoothstep((1 - progress) / 0.25);
  return 1;
}

// Gesture identifiers. Wave uses world-space arm aiming; everything else is
// handled via per-bone Euler offsets in fillGestureEuler / fillGestureGroup.
type GestureType =
  | 'wave'
  | 'stretch'
  | 'cheer'
  | 'shrug'
  | 'akimbo'
  | 'point'
  | 'clap'
  | 'bow'
  | 'nod'
  | 'spin';

// Per-bone Euler offset for the active gesture, given progress 0..1.
// Sign conventions assume an RPM/Wolf3D rig in T-pose-ish bind. Sin/cos
// envelopes give a smooth rise–hold–fall over the gesture's duration.
function fillGestureEuler(
  boneName: string,
  type: GestureType,
  progress: number,
  out: THREE.Euler,
) {
  out.set(0, 0, 0);
  const env = Math.sin(progress * Math.PI); // 0 → 1 → 0
  // Wave is handled via aimBoneAtWorldDir in useFrame (world-space targets).
  if (type === 'wave') return;
  if (type === 'stretch') {
    // Both arms raise outward to the sides, slight elbow bend, then lower.
    if (boneName === 'LeftArm') { out.z = env * 1.1; out.x = env * -0.2; }
    else if (boneName === 'RightArm') { out.z = env * -1.1; out.x = env * -0.2; }
    else if (boneName === 'LeftForeArm' || boneName === 'RightForeArm') { out.y = env * 0.3; }
    else if (boneName === 'LeftShoulder') { out.z = env * 0.15; }
    else if (boneName === 'RightShoulder') { out.z = env * -0.15; }
  } else if (type === 'cheer') {
    // Both arms shoot straight up — V-shape — slight forward lean of forearms.
    if (boneName === 'LeftArm') { out.z = env * 2.4; out.x = env * -0.15; }
    else if (boneName === 'RightArm') { out.z = env * -2.4; out.x = env * -0.15; }
    else if (boneName === 'LeftForeArm' || boneName === 'RightForeArm') { out.y = env * 0.25; }
    else if (boneName === 'LeftShoulder') { out.z = env * 0.25; }
    else if (boneName === 'RightShoulder') { out.z = env * -0.25; }
  } else if (type === 'shrug') {
    // Shoulders raised, forearms angled outward, palms-up vibe.
    if (boneName === 'LeftArm') { out.z = env * 0.4; out.x = env * -0.1; }
    else if (boneName === 'RightArm') { out.z = env * -0.4; out.x = env * -0.1; }
    else if (boneName === 'LeftShoulder') { out.z = env * 0.4; }
    else if (boneName === 'RightShoulder') { out.z = env * -0.4; }
    else if (boneName === 'LeftForeArm') { out.x = env * -0.6; out.z = env * -0.5; }
    else if (boneName === 'RightForeArm') { out.x = env * -0.6; out.z = env * 0.5; }
  } else if (type === 'akimbo') {
    // Hands on hips: arms slightly out, forearms folded back toward the waist.
    if (boneName === 'LeftArm') { out.z = env * 0.5; out.x = env * 0.15; }
    else if (boneName === 'RightArm') { out.z = env * -0.5; out.x = env * 0.15; }
    else if (boneName === 'LeftForeArm') { out.x = env * -1.4; out.z = env * -0.6; }
    else if (boneName === 'RightForeArm') { out.x = env * -1.4; out.z = env * 0.6; }
  } else if (type === 'point') {
    // Right arm extended forward. Left stays at side.
    if (boneName === 'RightArm') { out.x = env * -1.45; out.z = env * -0.25; }
    else if (boneName === 'RightForeArm') { out.y = env * 0.2; }
    else if (boneName === 'RightShoulder') { out.x = env * -0.1; }
  } else if (type === 'clap') {
    // Both arms forward, hands oscillating together (6 claps over the gesture).
    const osc = (Math.sin(progress * Math.PI * 12) + 1) * 0.5; // 0..1, 6 cycles
    if (boneName === 'LeftArm') { out.x = env * -1.25; out.z = env * (0.45 + osc * 0.25); }
    else if (boneName === 'RightArm') { out.x = env * -1.25; out.z = env * -(0.45 + osc * 0.25); }
    else if (boneName === 'LeftForeArm') { out.x = env * -0.5; out.y = env * 0.3; }
    else if (boneName === 'RightForeArm') { out.x = env * -0.5; out.y = env * -0.3; }
  } else if (type === 'spin') {
    // Pirouette balance pose — arms out to the sides, slight forward bend in
    // forearms. Combined with the eased group rotation + bob in fillGestureGroup,
    // this stops the spin from looking like a turntable.
    if (boneName === 'LeftArm') { out.z = env * 0.95; out.x = env * -0.1; }
    else if (boneName === 'RightArm') { out.z = env * -0.95; out.x = env * -0.1; }
    else if (boneName === 'LeftForeArm') { out.x = env * -0.2; out.y = env * 0.25; }
    else if (boneName === 'RightForeArm') { out.x = env * -0.2; out.y = env * -0.25; }
    else if (boneName === 'LeftShoulder') { out.z = env * 0.12; }
    else if (boneName === 'RightShoulder') { out.z = env * -0.12; }
  }
  // bow / nod act on the spine/head bone in useFrame; spin's group rotation
  // and bob are in fillGestureGroup + the spin position offset there.
}

// Whole-avatar Euler offset for gestures that rotate the body as a rigid
// unit. Bow/nod aren't here because they need to bend at the spine/head
// (legs planted); only spin pivots the entire group.
function fillGestureGroup(type: GestureType, progress: number, out: THREE.Euler) {
  out.set(0, 0, 0);
  if (type === 'spin') {
    // Cubic ease-in-out so the rotation accelerates and decelerates
    // instead of looking like a turntable at constant rpm.
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    out.y = eased * Math.PI * 2; // one full revolution
  }
}

// Vertical bob applied to the avatar group during spin — small up-and-down
// motion makes the pirouette feel grounded and human, not turntable-static.
function spinBobY(progress: number) {
  return Math.sin(progress * Math.PI) * 0.06;
}

function GLBAvatar({mouthShape, breatheY, isSpeaking}: {mouthShape: MouthShape; breatheY: number; isSpeaking: boolean}) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRef = useRef(0);
  const [avatarScale, setAvatarScale] = useState(1);

  // Procedural-sway shader uniforms for the hair material. The mesh has no
  // hair bones or morph targets, so we patch its vertex shader to add a
  // small wind-driven displacement that scales with height above the scalp.
  const hairUniformsRef = useRef<{uTime: {value: number}; uWindStrength: {value: number}} | null>(null);

  // Idle arm-bone offsets. Each bone gets sine-driven micro-rotations on top
  // of its bind-pose rotation so the avatar's arms shift slightly instead of
  // sitting frozen at her sides.
  const armBonesRef = useRef<{
    bone: THREE.Object3D;
    base: THREE.Quaternion;
    freq: number;
    phase: number;
    amp: number;
  }[]>([]);

  // Body bones used by gestures that bend the torso/head without moving the
  // legs (bow, nod). We hold the bind-pose quaternion so each frame we can
  // reset → optionally apply the gesture offset.
  const spineBoneRef = useRef<{bone: THREE.Object3D; base: THREE.Quaternion} | null>(null);
  const headBoneRef = useRef<{bone: THREE.Object3D; base: THREE.Quaternion} | null>(null);

  // Layered gesture state — periodic gesture on top of idle motion. The
  // auto-scheduler only picks from the calmer set (wave/stretch); the rest
  // are reserved for keyboard triggers via 3-0.
  const gestureRef = useRef({
    active: false,
    type: 'wave' as GestureType,
    progress: 0,
    duration: 3,
    nextIn: 8 + Math.random() * 12, // first one within 8–20s of mount
  });

  // Blink state machine — ported from the previous primitive-head version.
  const blinkRef = useRef({
    amount: 0,
    phase: 'idle' as 'idle' | 'closing' | 'opening',
    timer: 0,
    nextBlinkIn: Math.random() * 3 + 1.5,
  });

  const {scene} = useGLTF(AVATAR_URL);

  // Re-root the cloned GLB under a plain Group so transforms apply normally
  // when this asset is mounted inside the scene graph. SkeletonUtils.clone
  // properly rebinds each SkinnedMesh's skeleton to the *cloned* bones —
  // the default Object3D.clone(true) leaves them pointing at the originals,
  // which silently breaks any bone-rotation animation we apply.
  const sceneClone = useMemo(() => {
    const clone = cloneSkeleton(scene) as THREE.Object3D;
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

  // Patch the hair material with a procedural sway. Hair has no bones or
  // morph targets, so we displace vertices in the vertex shader by a wave
  // scaled by height above ~the scalp line — tips move, roots don't.
  useEffect(() => {
    const hair = sceneClone.getObjectByName('Wolf3D_Hair') as THREE.SkinnedMesh | undefined;
    if (!hair) return;

    const original = hair.material as THREE.Material;
    const mat = (Array.isArray(original) ? original[0] : original).clone() as THREE.MeshStandardMaterial;
    hair.material = mat;

    const uniforms = {uTime: {value: 0}, uWindStrength: {value: 0.05}};
    hairUniformsRef.current = uniforms;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWindStrength = uniforms.uWindStrength;
      shader.vertexShader =
        'uniform float uTime;\nuniform float uWindStrength;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           // Local-space y of the avatar's head is ~1.65–1.95 in the GLB's
           // bind pose; clamp so vertices below the forehead don't move.
           float heightAboveScalp = max(position.y - 1.65, 0.0);
           float wave = sin(uTime * 1.2 + position.y * 4.0 + position.x * 2.5)
                      * cos(uTime * 0.7 + position.z * 3.0);
           transformed.x += wave * uWindStrength * heightAboveScalp;
           transformed.z += wave * 0.3 * uWindStrength * heightAboveScalp;`,
        );
    };
    mat.needsUpdate = true;
  }, [sceneClone]);

  // Cache arm-chain bones + their bind rotations on load. We add small
  // offsets every frame on top of `base`, never overwriting the bind pose.
  // Ready Player Me exports arms in T-pose (horizontal); we apply a one-time
  // rest offset so the avatar starts with hands relaxed at her sides — idle
  // sway and gestures then layer on top of that arms-down rest pose.
  useEffect(() => {
    const cfg: {name: string; amp: number; freq: number}[] = [
      {name: 'LeftShoulder', amp: 0.025, freq: 0.45},
      {name: 'RightShoulder', amp: 0.025, freq: 0.50},
      {name: 'LeftArm', amp: 0.04, freq: 0.40},
      {name: 'RightArm', amp: 0.04, freq: 0.42},
      {name: 'LeftForeArm', amp: 0.06, freq: 0.55},
      {name: 'RightForeArm', amp: 0.06, freq: 0.58},
      {name: 'LeftHand', amp: 0.08, freq: 0.70},
      {name: 'RightHand', amp: 0.08, freq: 0.72},
    ];
    // Per-bone Euler offsets (radians) applied once at bind to bring the
    // T-pose into a relaxed arms-at-sides rest pose. Tune if your rig has
    // different axis conventions — start by flipping the Z signs.
    // T-pose bind: rotate around the bone's local X axis to swing arms down.
    // (Z swings forward/backward on this rig, not vertical, so it's wrong here.)
    const REST_POSE: Record<string, [number, number, number]> = {
      LeftArm: [1.3, 0, 0],
      RightArm: [1.3, 0, 0],
    };
    const _restEuler = new THREE.Euler();
    const _restQuat = new THREE.Quaternion();
    const list: typeof armBonesRef.current = [];
    const missing: string[] = [];
    for (const c of cfg) {
      const bone = sceneClone.getObjectByName(c.name);
      if (bone) {
        const rest = REST_POSE[c.name];
        if (rest) {
          _restEuler.set(rest[0], rest[1], rest[2]);
          _restQuat.setFromEuler(_restEuler);
          bone.quaternion.multiply(_restQuat);
        }
        list.push({
          bone,
          base: bone.quaternion.clone(),
          freq: c.freq,
          phase: Math.random() * Math.PI * 2,
          amp: c.amp,
        });
      } else {
        missing.push(c.name);
      }
    }
    console.log('[Avatar3D] arm bones found:', list.map((b) => b.bone.name));
    if (missing.length) console.warn('[Avatar3D] arm bones NOT found in GLB:', missing);
    armBonesRef.current = list;

    // Spine + Head for bow/nod. Try a couple of common RPM/Mixamo names.
    const spine =
      sceneClone.getObjectByName('Spine') ||
      sceneClone.getObjectByName('Spine1') ||
      sceneClone.getObjectByName('mixamorigSpine');
    const head =
      sceneClone.getObjectByName('Head') ||
      sceneClone.getObjectByName('mixamorigHead');
    spineBoneRef.current = spine ? {bone: spine, base: spine.quaternion.clone()} : null;
    headBoneRef.current = head ? {bone: head, base: head.quaternion.clone()} : null;
    if (!spine) console.warn('[Avatar3D] Spine bone not found — bow gesture will be a no-op');
    if (!head) console.warn('[Avatar3D] Head bone not found — nod gesture will be a no-op');
  }, [sceneClone]);

  // Keyboard gestures: 1 wave · 2 stretch · 3 cheer · 4 shrug · 5 akimbo
  //                    6 point · 7 clap · 8 bow · 9 nod · 0 spin
  // Ignored while typing in chat inputs so digit keys don't double-fire.
  useEffect(() => {
    const KEY_TO_GESTURE: Record<string, {type: GestureType; duration: number}> = {
      '1': {type: 'wave', duration: 5},
      '2': {type: 'stretch', duration: 5},
      '3': {type: 'cheer', duration: 3.5},
      '4': {type: 'shrug', duration: 2.8},
      '5': {type: 'akimbo', duration: 4},
      '6': {type: 'point', duration: 3.5},
      '7': {type: 'clap', duration: 3.2},
      '8': {type: 'bow', duration: 3},
      '9': {type: 'nod', duration: 2.5},
      '0': {type: 'spin', duration: 2.4},
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const choice = KEY_TO_GESTURE[e.key];
      if (!choice) return;
      const g = gestureRef.current;
      g.active = true;
      g.progress = 0;
      g.duration = choice.duration;
      g.type = choice.type;
      console.log('[Avatar3D] manually triggered gesture:', g.type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

    // Idle motion + breathing — applied to the whole avatar group. Group-level
    // gestures (bow / nod / spin) layer on top via fillGestureGroup below.
    idleRef.current += delta;
    let groupRotX = Math.sin(idleRef.current * 0.3) * 0.015;
    let groupRotY = Math.sin(idleRef.current * 0.5) * 0.04;
    let groupRotZ = 0;
    if (gestureRef.current.active) {
      fillGestureGroup(gestureRef.current.type, gestureRef.current.progress, _groupGestureEuler);
      groupRotX += _groupGestureEuler.x;
      groupRotY += _groupGestureEuler.y;
      groupRotZ += _groupGestureEuler.z;
    }
    groupRef.current.rotation.x = groupRotX;
    groupRef.current.rotation.y = groupRotY;
    groupRef.current.rotation.z = groupRotZ;
    // Vertical bob during spin — keeps the gesture from feeling turntable-y.
    groupRef.current.position.y =
      gestureRef.current.active && gestureRef.current.type === 'spin'
        ? spinBobY(gestureRef.current.progress)
        : 0;

    // Drive the hair-sway shader uniform.
    if (hairUniformsRef.current) {
      hairUniformsRef.current.uTime.value += delta;
    }

    // Periodic gesture scheduler.
    const g = gestureRef.current;
    if (g.active) {
      g.progress += delta / g.duration;
      if (g.progress >= 1) {
        g.active = false;
        g.progress = 0;
        g.nextIn = 15 + Math.random() * 25; // next gesture in 15–40s
      }
    } else {
      g.nextIn -= delta;
      if (g.nextIn <= 0) {
        g.active = true;
        g.progress = 0;
        g.duration = 4.5 + Math.random() * 2; // 4.5–6.5s — slower, more natural
        g.type = Math.random() < 0.5 ? 'wave' : 'stretch';
        console.log('[Avatar3D] gesture firing:', g.type, 'duration', g.duration.toFixed(1) + 's');
      }
    }

    // Idle arm motion + (optional) layered gesture, all on top of bind pose.
    const t = idleRef.current;
    for (const arm of armBonesRef.current) {
      const phase = t * arm.freq + arm.phase;
      _armEuler.set(
        Math.sin(phase) * arm.amp,
        Math.sin(phase * 1.3) * arm.amp * 0.5,
        Math.cos(phase * 0.7) * arm.amp,
      );
      _armOffset.setFromEuler(_armEuler);
      arm.bone.quaternion.copy(arm.base).multiply(_armOffset);

      if (!g.active) continue;

      if (g.type === 'wave') {
        const hold = envHold(g.progress);
        if (hold <= 0.001) continue;
        if (arm.bone.name === 'RightArm') {
          _idleQuat.copy(arm.bone.quaternion);
          aimBoneAtWorldDir(arm.bone, WAVE_RIGHT_ARM_DIR, _targetQuat);
          arm.bone.quaternion.slerpQuaternions(_idleQuat, _targetQuat, hold);
        } else if (arm.bone.name === 'RightForeArm') {
          _idleQuat.copy(arm.bone.quaternion);
          aimBoneAtWorldDir(arm.bone, WAVE_RIGHT_FOREARM_DIR, _targetQuat);
          arm.bone.quaternion.slerpQuaternions(_idleQuat, _targetQuat, hold);
        } else if (arm.bone.name === 'RightShoulder') {
          _gestureEuler.set(hold * -0.1, 0, 0);
          _gestureOffset.setFromEuler(_gestureEuler);
          arm.bone.quaternion.multiply(_gestureOffset);
        }
      } else {
        fillGestureEuler(arm.bone.name, g.type, g.progress, _gestureEuler);
        _gestureOffset.setFromEuler(_gestureEuler);
        arm.bone.quaternion.multiply(_gestureOffset);
      }
    }

    // Bow / nod — bend at the spine or head, leaving legs and hips planted.
    // Always reset to bind pose first; only layer the gesture offset when
    // the matching gesture is active.
    const sb = spineBoneRef.current;
    if (sb) {
      sb.bone.quaternion.copy(sb.base);
      if (g.active && g.type === 'bow') {
        const env = Math.sin(g.progress * Math.PI);
        _gestureEuler.set(env * 0.55, 0, 0);
        _gestureOffset.setFromEuler(_gestureEuler);
        sb.bone.quaternion.multiply(_gestureOffset);
      }
    }
    const hb = headBoneRef.current;
    if (hb) {
      hb.bone.quaternion.copy(hb.base);
      if (g.active && g.type === 'nod') {
        const env = Math.sin(g.progress * Math.PI);
        const nodAngle = env * Math.sin(g.progress * Math.PI * 8) * 0.32;
        _gestureEuler.set(nodAngle, 0, 0);
        _gestureOffset.setFromEuler(_gestureEuler);
        hb.bone.quaternion.multiply(_gestureOffset);
      }
    }

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
      position={[0, 0, 0]}
      scale={1}
    >
      <primitive object={sceneClone} position={[0, -0.5, 0]} scale={avatarScale} />
    </group>
  );
}

// Suspense fallback for GLB load — shows a centered card with progress.
// Rendered inside the Canvas via drei's <Html>, so it lives in the same
// pixel space as the avatar will once it finishes loading.
function AvatarLoader() {
  const {progress} = useProgress();
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <Html center>
      <div
        style={{
          color: '#e5e7eb',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          background: 'rgba(0,0,0,0.55)',
          padding: '12px 18px',
          borderRadius: 14,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          minWidth: 160,
        }}
      >
        <div style={{fontWeight: 600, marginBottom: 8}}>Loading Mona…</div>
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: '#7c3aed',
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
        <div style={{fontSize: 11, opacity: 0.6, marginTop: 6}}>{pct}%</div>
      </div>
    </Html>
  );
}

function FramedCamera({position, target, fov, zoom = 1}: {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom?: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // zoom scales the camera's distance to the target along the existing look
  // vector. zoom > 1 brings the camera closer; zoom < 1 pulls it farther.
  // The look-at target and fov stay fixed so the avatar's shoulder/head
  // framing is preserved regardless of zoom level.
  const z = Math.max(0.0001, zoom);
  const px = target[0] + (position[0] - target[0]) / z;
  const py = target[1] + (position[1] - target[1]) / z;
  const pz = target[2] + (position[2] - target[2]) / z;

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.position.set(px, py, pz);
    cameraRef.current.lookAt(target[0], target[1], target[2]);
    cameraRef.current.updateProjectionMatrix();
  }, [px, py, pz, target, fov]);

  return <PerspectiveCamera ref={cameraRef} makeDefault position={[px, py, pz]} fov={fov} />;
}

// ========== Main 3D Scene ==========
interface Avatar3DProps {
  mouthShape: MouthShape;
  breatheY: number;
  isSpeaking?: boolean;
  isMobile?: boolean;
  zoom?: number;
}

export const Avatar3D: React.FC<Avatar3DProps> = ({mouthShape, breatheY, isSpeaking = false, isMobile = false, zoom = 1}) => {
  const cameraPos: [number, number, number] = isMobile ? [0, 1.95, 2.15] : [0, 1.8, 1.95];
  const cameraTarget: [number, number, number] = isMobile ? [0, 1.7, 0] : [0, 1.55, 0];
  const fov = isMobile ? 26 : 22;

  return (
    <Canvas
      style={{width: '100%', height: '100%'}}
      gl={{antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping}}
    >
      <FramedCamera position={cameraPos} target={cameraTarget} fov={fov} zoom={zoom} />

      <color attach="background" args={['#03131a']} />

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

      <Suspense fallback={<AvatarLoader />}>
        <GLBAvatar mouthShape={mouthShape} breatheY={breatheY} isSpeaking={isSpeaking} />
      </Suspense>
    </Canvas>
  );
};
