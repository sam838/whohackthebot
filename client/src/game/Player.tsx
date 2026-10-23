import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group, Mesh } from "three";
import type { Body } from "./useMovement";

interface PlayerProps {
  color: string;
  body: React.RefObject<Body>;
  isYou?: boolean;
  /** Kicked out: drawn see-through, like a ghost watching the class. */
  ghost?: boolean;
}

/**
 * A player character. For now this is the bean fallback (spec.md > Important
 * Failure Modes); CC0 models arrive in slice 5.
 */
export function Player({ color, body, isYou, ghost }: PlayerProps) {
  const group = useRef<Group>(null);
  const legL = useRef<Mesh>(null);
  const legR = useRef<Mesh>(null);
  const bob = useRef(0);

  useFrame((_, delta) => {
    const b = body.current;
    const g = group.current!;
    // A remote player has no body until their first position arrives.
    g.visible = Boolean(b);
    if (!b) return;
    if (b.moving) bob.current += delta * 12;
    else bob.current = 0;
    g.position.set(b.x, Math.abs(Math.sin(bob.current)) * 0.08, b.z);
    // Turn smoothly toward the heading.
    let diff = b.heading - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, delta * 12);
    const swing = Math.sin(bob.current) * 0.12;
    legL.current!.position.z = swing;
    legR.current!.position.z = -swing;
  });

  useEffect(() => {
    group.current?.traverse((o) => {
      const m = (o as Mesh).material as { transparent?: boolean; opacity?: number } | undefined;
      if (m) {
        m.transparent = Boolean(ghost);
        m.opacity = ghost ? 0.35 : 1;
      }
    });
  }, [ghost]);

  return (
    <group ref={group}>
      <mesh position-y={0.8}>
        <cylinderGeometry args={[0.45, 0.45, 0.7, 24]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={1.15}>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.45}>
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* visor */}
      <mesh position={[0, 1.12, 0.36]} scale={[1.1, 0.6, 0.55]}>
        <sphereGeometry args={[0.3, 20, 14]} />
        <meshToonMaterial color="#dff3ff" />
      </mesh>
      {/* school backpack */}
      <mesh position={[0, 0.85, -0.45]}>
        <boxGeometry args={[0.55, 0.55, 0.25]} />
        <meshToonMaterial color="#4a3f5c" />
      </mesh>
      <mesh ref={legL} position={[-0.18, 0.12, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh ref={legR} position={[0.18, 0.12, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
      {isYou && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.62, 0.76, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}
