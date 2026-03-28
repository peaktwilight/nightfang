'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

// The pwnkit shield shape — pentagon top with W-shaped fangs at bottom
function createShieldShape(): THREE.Vector2[] {
  // Shield outline: top center → right → lower right → right fang → center valley → left fang → lower left → left → back to top
  // Normalized to roughly -1..1 range
  return [
    new THREE.Vector2(0, 1.1),       // top center
    new THREE.Vector2(0.85, 0.55),   // upper right
    new THREE.Vector2(0.85, -0.2),   // mid right
    new THREE.Vector2(0.55, -0.65),  // lower right (start of W)
    new THREE.Vector2(0.35, -0.45),  // right fang tip
    new THREE.Vector2(0, -0.9),      // center valley (bottom of W)
    new THREE.Vector2(-0.35, -0.45), // left fang tip
    new THREE.Vector2(-0.55, -0.65), // lower left
    new THREE.Vector2(-0.85, -0.2),  // mid left
    new THREE.Vector2(-0.85, 0.55),  // upper left
    new THREE.Vector2(0, 1.1),       // close back to top
  ];
}

// Glowing wireframe shield
const Shield = () => {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const scanRef = useRef(0);

  // Shield outline geometry
  const outlineGeo = useMemo(() => {
    const points = createShieldShape();
    const points3d = points.map(p => new THREE.Vector3(p.x, p.y, 0));
    return new THREE.BufferGeometry().setFromPoints(points3d);
  }, []);

  // Inner shield (slightly smaller, for depth)
  const innerGeo = useMemo(() => {
    const points = createShieldShape();
    const scale = 0.82;
    const points3d = points.map(p => new THREE.Vector3(p.x * scale, p.y * scale, 0.1));
    return new THREE.BufferGeometry().setFromPoints(points3d);
  }, []);

  // Floating particles around the shield
  const particleGeo = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere around the shield
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.2 + Math.random() * 2.5;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.3; // flatten z
      sizes[i] = Math.random() * 2 + 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  // Scan line geometry (horizontal line that sweeps)
  const scanGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(-1.2, 0, 0.05),
      new THREE.Vector3(1.2, 0, 0.05),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  const scanLineRef = useRef<THREE.Line>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      // Gentle floating + mouse follow
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.15 + pointer.x * 0.1;
      groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.05 + pointer.y * -0.05;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.05;
    }

    // Eye pulse
    if (eyeRef.current) {
      const scale = 1 + Math.sin(t * 2) * 0.15;
      eyeRef.current.scale.set(scale, scale, 1);
    }

    // Particles drift
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.05;
      particlesRef.current.rotation.x = t * 0.02;
    }

    // Scan line sweep
    scanRef.current = (Math.sin(t * 0.8) * 0.5 + 0.5) * 2.2 - 1.1;
    if (scanLineRef.current) {
      scanLineRef.current.position.y = scanRef.current;
      const mat = scanLineRef.current.material as THREE.LineBasicMaterial;
      // Fade near edges
      const edgeDist = 1 - Math.abs(scanRef.current) / 1.1;
      mat.opacity = edgeDist * 0.6;
    }
  });

  return (
    <group ref={groupRef} scale={1.6}>
      {/* Outer shield wireframe */}
      <line geometry={outlineGeo}>
        <lineBasicMaterial color="#DC2626" linewidth={2} transparent opacity={0.8} />
      </line>

      {/* Inner shield wireframe */}
      <group ref={innerRef}>
        <line geometry={innerGeo}>
          <lineBasicMaterial color="#DC2626" linewidth={1} transparent opacity={0.25} />
        </line>
      </group>

      {/* Eye */}
      <mesh ref={eyeRef} position={[0, 0.1, 0.05]}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color="#DC2626" transparent opacity={0.7} />
      </mesh>

      {/* Eye glow ring */}
      <mesh position={[0, 0.1, 0.04]}>
        <ringGeometry args={[0.12, 0.18, 32]} />
        <meshBasicMaterial color="#DC2626" transparent opacity={0.15} />
      </mesh>

      {/* Scan line */}
      <line ref={scanLineRef} geometry={scanGeo}>
        <lineBasicMaterial color="#DC2626" linewidth={1} transparent opacity={0.4} />
      </line>

      {/* Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          color="#DC2626"
          size={0.02}
          transparent
          opacity={0.3}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default function PwnkitHero3D() {
  return (
    <div className="absolute inset-0 z-0" style={{ opacity: 0.5 }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Shield />
      </Canvas>
    </div>
  );
}
