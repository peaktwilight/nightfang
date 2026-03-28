'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const CRIMSON = '#DC2626';

const Shield = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);

  // The fang outline as a smooth tube
  // SVG: M8,12 L16,6 L24,12 L24,22 L20,26 L16,22 L12,26 L8,22 Z
  // viewBox 0 0 32 32, center=(16,16)
  const outlineGeo = useMemo(() => {
    const s = 0.05; // smaller scale
    const cx = 16, cy = 16;
    const pts = [
      [8, 12], [16, 6], [24, 12], [24, 22],
      [20, 26], [16, 22], [12, 26], [8, 22],
    ].map(([x, y]) => new THREE.Vector3((x - cx) * s, -(y - cy) * s, 0));
    pts.push(pts[0].clone());

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
    return new THREE.TubeGeometry(curve, 80, 0.016, 8, false);
  }, []);

  // Glow (wider, softer)
  const glowGeo = useMemo(() => {
    const s = 0.05;
    const cx = 16, cy = 16;
    const pts = [
      [8, 12], [16, 6], [24, 12], [24, 22],
      [20, 26], [16, 22], [12, 26], [8, 22],
    ].map(([x, y]) => new THREE.Vector3((x - cx) * s, -(y - cy) * s, 0));
    pts.push(pts[0].clone());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
    return new THREE.TubeGeometry(curve, 80, 0.03, 8, false);
  }, []);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.2 + pointer.x * 0.1;
      groupRef.current.rotation.x = Math.cos(t * 0.25) * 0.06 + pointer.y * -0.05;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.01;
      const breathe = 1 + Math.sin(t * 1.2) * 0.015;
      groupRef.current.scale.setScalar(breathe);
    }

    // Blink
    const bc = 2.5, bd = 0.12;
    const b1 = t % bc;
    let e1 = 1;
    if (b1 < bd) e1 = b1 < bd / 2 ? 1 - b1 / (bd / 2) : (b1 - bd / 2) / (bd / 2);
    const b2 = (t + 0.03) % bc;
    let e2 = 1;
    if (b2 < bd) e2 = b2 < bd / 2 ? 1 - b2 / (bd / 2) : (b2 - bd / 2) / (bd / 2);
    if (leftEyeRef.current) leftEyeRef.current.scale.set(1, e1, 1);
    if (rightEyeRef.current) rightEyeRef.current.scale.set(1, e2, 1);
  });

  const s = 0.05;
  const cx = 16, cy = 16;
  const le: [number, number] = [(13 - cx) * s, -(16 - cy) * s];
  const re: [number, number] = [(19 - cx) * s, -(16 - cy) * s];

  return (
    <group ref={groupRef}>
      {/* Glow */}
      <mesh geometry={glowGeo}>
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.12} />
      </mesh>

      {/* Outline */}
      <mesh geometry={outlineGeo}>
        <meshBasicMaterial color={CRIMSON} />
      </mesh>

      {/* Eyes */}
      <mesh ref={leftEyeRef} position={[le[0], le[1], 0.01]}>
        <circleGeometry args={[0.02, 24]} />
        <meshBasicMaterial color={CRIMSON} />
      </mesh>
      <mesh ref={rightEyeRef} position={[re[0], re[1], 0.01]}>
        <circleGeometry args={[0.02, 24]} />
        <meshBasicMaterial color={CRIMSON} />
      </mesh>
    </group>
  );
};

export default function PwnkitHero3D() {
  return (
    <div className="mx-auto mb-4" style={{ width: '200px', height: '200px' }}>
      <Canvas
        camera={{ position: [0, 0, 1.8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Shield />
      </Canvas>
    </div>
  );
}
