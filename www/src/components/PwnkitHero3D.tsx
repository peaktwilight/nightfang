'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const CRIMSON = '#DC2626';

// SVG viewBox is 0 0 32 32, path centers around (16, 16)
// Convert to Three.js coords: center at origin, flip Y, scale
function svgPt(x: number, y: number): THREE.Vector2 {
  const s = 0.065;
  return new THREE.Vector2((x - 16) * s, -(y - 16) * s);
}

// Build a smooth rounded path through the fang vertices
function createFangCurve(): THREE.CurvePath<THREE.Vector3> {
  // M8,12 L16,6 L24,12 L24,22 L20,26 L16,22 L12,26 L8,22 Z
  const pts = [
    svgPt(8, 12),   // top-left
    svgPt(16, 6),   // top-center (peak)
    svgPt(24, 12),  // top-right
    svgPt(24, 22),  // right side
    svgPt(20, 26),  // right fang
    svgPt(16, 22),  // center valley
    svgPt(12, 26),  // left fang
    svgPt(8, 22),   // left side
  ];

  // Create rounded corners using quadratic bezier at each vertex
  const radius = 0.04; // corner rounding radius
  const path = new THREE.CurvePath<THREE.Vector3>();

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const prev = pts[(i - 1 + pts.length) % pts.length];

    // Direction vectors
    const toNext = new THREE.Vector2().subVectors(next, curr).normalize();
    const toPrev = new THREE.Vector2().subVectors(prev, curr).normalize();

    // Points offset from corner
    const edgeLen = curr.distanceTo(next);
    const r = Math.min(radius, edgeLen * 0.3);

    const startPt = new THREE.Vector2().addVectors(curr, toPrev.clone().multiplyScalar(r));
    const endPt = new THREE.Vector2().addVectors(curr, toNext.clone().multiplyScalar(r));

    // Rounded corner (quadratic bezier through the corner point)
    path.add(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startPt.x, startPt.y, 0),
      new THREE.Vector3(curr.x, curr.y, 0),
      new THREE.Vector3(endPt.x, endPt.y, 0),
    ));

    // Straight line to the next corner's start
    const nextPt = pts[(i + 1) % pts.length];
    const nextNext = pts[(i + 2) % pts.length];
    const toNextNext = new THREE.Vector2().subVectors(nextNext, nextPt).normalize();
    const nextToCurr = new THREE.Vector2().subVectors(curr, nextPt).normalize();
    const nextEdgeLen = nextPt.distanceTo(curr);
    const nextR = Math.min(radius, nextEdgeLen * 0.3);
    const lineEnd = new THREE.Vector2().addVectors(nextPt, nextToCurr.clone().multiplyScalar(nextR));

    path.add(new THREE.LineCurve3(
      new THREE.Vector3(endPt.x, endPt.y, 0),
      new THREE.Vector3(lineEnd.x, lineEnd.y, 0),
    ));
  }

  return path;
}

const Shield = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Fang outline as a tube for smooth rounded look
  const tubeGeo = useMemo(() => {
    const curvePath = createFangCurve();
    const allPoints: THREE.Vector3[] = [];
    curvePath.curves.forEach(c => {
      const pts = c.getPoints(8);
      allPoints.push(...pts);
    });
    // Close the loop
    if (allPoints.length > 0) allPoints.push(allPoints[0].clone());
    const curve = new THREE.CatmullRomCurve3(allPoints, false);
    return new THREE.TubeGeometry(curve, 120, 0.006, 8, false);
  }, []);

  // Inner outline (slightly smaller)
  const innerTubeGeo = useMemo(() => {
    const curvePath = createFangCurve();
    const allPoints: THREE.Vector3[] = [];
    curvePath.curves.forEach(c => {
      const pts = c.getPoints(8);
      allPoints.push(...pts);
    });
    if (allPoints.length > 0) allPoints.push(allPoints[0].clone());
    // Scale down
    const scaled = allPoints.map(p => p.clone().multiplyScalar(0.82));
    const curve = new THREE.CatmullRomCurve3(scaled, false);
    return new THREE.TubeGeometry(curve, 120, 0.003, 8, false);
  }, []);

  // Floating particles
  const particleGeo = useMemo(() => {
    const count = 80;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.2;
      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(theta);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.1 + pointer.x * 0.06;
      groupRef.current.rotation.x = Math.cos(t * 0.25) * 0.03 + pointer.y * -0.03;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.02;
      const breathe = 1 + Math.sin(t * 1.2) * 0.012;
      groupRef.current.scale.setScalar(breathe * 2.2);
    }

    // Eye blink
    const blinkCycle = 2.5;
    const blinkDur = 0.12;
    const blinkPhase = t % blinkCycle;
    let ey1 = 1;
    if (blinkPhase < blinkDur) {
      ey1 = blinkPhase < blinkDur / 2
        ? 1 - (blinkPhase / (blinkDur / 2))
        : (blinkPhase - blinkDur / 2) / (blinkDur / 2);
    }
    const blinkPhase2 = (t + 0.03) % blinkCycle;
    let ey2 = 1;
    if (blinkPhase2 < blinkDur) {
      ey2 = blinkPhase2 < blinkDur / 2
        ? 1 - (blinkPhase2 / (blinkDur / 2))
        : (blinkPhase2 - blinkDur / 2) / (blinkDur / 2);
    }
    if (leftEyeRef.current) leftEyeRef.current.scale.set(1, ey1, 1);
    if (rightEyeRef.current) rightEyeRef.current.scale.set(1, ey2, 1);

    if (particlesRef.current) {
      particlesRef.current.rotation.z = t * 0.02;
    }
  });

  const leftEye = svgPt(13, 16);
  const rightEye = svgPt(19, 16);

  return (
    <group ref={groupRef}>
      {/* Main outline — tube for smooth rounded corners */}
      <mesh geometry={tubeGeo}>
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.85} />
      </mesh>

      {/* Inner outline */}
      <mesh geometry={innerTubeGeo} position-z={0.02}>
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.2} />
      </mesh>

      {/* Left eye */}
      <mesh ref={leftEyeRef} position={[leftEye.x, leftEye.y, 0.01]}>
        <circleGeometry args={[0.012, 24]} />
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.9} />
      </mesh>

      {/* Right eye */}
      <mesh ref={rightEyeRef} position={[rightEye.x, rightEye.y, 0.01]}>
        <circleGeometry args={[0.012, 24]} />
        <meshBasicMaterial color={CRIMSON} transparent opacity={0.9} />
      </mesh>

      {/* Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          color={CRIMSON}
          size={0.008}
          transparent
          opacity={0.15}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default function PwnkitHero3D() {
  return (
    <div className="mx-auto mb-6" style={{ width: '180px', height: '180px' }}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Shield />
      </Canvas>
    </div>
  );
}
