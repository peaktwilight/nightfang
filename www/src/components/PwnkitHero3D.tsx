'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const CRIMSON = '#DC2626';
const CRIMSON_DARK = '#991B1B';

// Build the fang shape as a THREE.Shape for extrusion
function createFangShape(scale = 1): THREE.Shape {
  // SVG: M8,12 L16,6 L24,12 L24,22 L20,26 L16,22 L12,26 L8,22 Z
  // Center around origin, flip Y
  const cx = 16, cy = 16;
  const s = 0.065 * scale;
  const p = (x: number, y: number): [number, number] => [(x - cx) * s, -(y - cy) * s];

  const shape = new THREE.Shape();
  const pts: [number, number][] = [
    p(8, 12), p(16, 6), p(24, 12), p(24, 22),
    p(20, 26), p(16, 22), p(12, 26), p(8, 22),
  ];

  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();

  return shape;
}

const Shield = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Extruded 3D fang shape
  const extrudeGeo = useMemo(() => {
    const shape = createFangShape(1);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
    });
  }, []);

  // Edges for the wireframe outline
  const edgesGeo = useMemo(() => {
    return new THREE.EdgesGeometry(extrudeGeo, 15);
  }, [extrudeGeo]);

  // Thick outline using tube around the fang path
  const outlineTubeGeo = useMemo(() => {
    const s = 0.065;
    const cx = 16, cy = 16;
    const rawPts = [
      [8, 12], [16, 6], [24, 12], [24, 22],
      [20, 26], [16, 22], [12, 26], [8, 22],
    ].map(([x, y]) => new THREE.Vector3((x - cx) * s, -(y - cy) * s, 0.04));

    // Close the shape
    rawPts.push(rawPts[0].clone());

    const curve = new THREE.CatmullRomCurve3(rawPts, false, 'catmullrom', 0.15);
    return new THREE.TubeGeometry(curve, 100, 0.018, 12, false);
  }, []);

  // Glow outline (bigger, more transparent)
  const glowTubeGeo = useMemo(() => {
    const s = 0.065;
    const cx = 16, cy = 16;
    const rawPts = [
      [8, 12], [16, 6], [24, 12], [24, 22],
      [20, 26], [16, 22], [12, 26], [8, 22],
    ].map(([x, y]) => new THREE.Vector3((x - cx) * s, -(y - cy) * s, 0.04));
    rawPts.push(rawPts[0].clone());
    const curve = new THREE.CatmullRomCurve3(rawPts, false, 'catmullrom', 0.15);
    return new THREE.TubeGeometry(curve, 100, 0.035, 12, false);
  }, []);

  // Floating particles
  const particleGeo = useMemo(() => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.8;
      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(theta);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.15 + pointer.x * 0.08;
      groupRef.current.rotation.x = Math.cos(t * 0.25) * 0.05 + pointer.y * -0.04;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.015;
      const breathe = 1 + Math.sin(t * 1.2) * 0.012;
      groupRef.current.scale.setScalar(breathe * 1.8);
    }

    // Eye blink
    const blinkCycle = 2.5;
    const blinkDur = 0.12;
    const bp1 = t % blinkCycle;
    let e1 = 1;
    if (bp1 < blinkDur) {
      e1 = bp1 < blinkDur / 2 ? 1 - bp1 / (blinkDur / 2) : (bp1 - blinkDur / 2) / (blinkDur / 2);
    }
    const bp2 = (t + 0.03) % blinkCycle;
    let e2 = 1;
    if (bp2 < blinkDur) {
      e2 = bp2 < blinkDur / 2 ? 1 - bp2 / (blinkDur / 2) : (bp2 - blinkDur / 2) / (blinkDur / 2);
    }
    if (leftEyeRef.current) leftEyeRef.current.scale.set(1, e1, 1);
    if (rightEyeRef.current) rightEyeRef.current.scale.set(1, e2, 1);

    // Glow pulse
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(t * 1.5) * 0.04;
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.z = t * 0.02;
    }
  });

  const s = 0.065;
  const cx = 16, cy = 16;
  const leftEye: [number, number] = [(13 - cx) * s, -(16 - cy) * s];
  const rightEye: [number, number] = [(19 - cx) * s, -(16 - cy) * s];

  return (
    <group ref={groupRef}>
      {/* Solid extruded 3D body (dark fill) */}
      <mesh geometry={extrudeGeo} position-z={-0.04}>
        <meshBasicMaterial color="#1a0000" transparent opacity={0.5} />
      </mesh>

      {/* Glow outline (wide, soft) */}
      <mesh ref={glowRef} geometry={glowTubeGeo}>
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.1} />
      </mesh>

      {/* Main thick outline */}
      <mesh geometry={outlineTubeGeo}>
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.9} />
      </mesh>

      {/* Left eye */}
      <mesh ref={leftEyeRef} position={[leftEye[0], leftEye[1], 0.05]}>
        <circleGeometry args={[0.025, 24]} />
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.9} />
      </mesh>

      {/* Right eye */}
      <mesh ref={rightEyeRef} position={[rightEye[0], rightEye[1], 0.05]}>
        <circleGeometry args={[0.025, 24]} />
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.9} />
      </mesh>

      {/* Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          color={CRIMSON}
          size={0.008}
          transparent
          opacity={0.12}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default function PwnkitHero3D() {
  return (
    <div className="mx-auto mb-4" style={{ width: '280px', height: '280px' }}>
      <Canvas
        camera={{ position: [0, 0, 2], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Shield />
      </Canvas>
    </div>
  );
}
