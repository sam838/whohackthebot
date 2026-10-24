import { useFrame } from "@react-three/fiber";
import { characterFile } from "@whtb/shared/avatars";
import { Suspense, useEffect, useRef } from "react";
import type { Group, Mesh } from "three";
import { Character } from "./Character";
import { nameTag } from "./textures";
import { ModelBoundary } from "./ModelBoundary";
import type { Body } from "./useMovement";

interface PlayerProps {
  color: string;
  /** Avatar character id; the bean is used if it's missing or fails to load. */
  character?: string;
  body: React.RefObject<Body | null>;
  isYou?: boolean;
  /** Kicked out: drawn see-through, like a ghost watching the class. */
  ghost?: boolean;
  /** Size in the school (the menus' avatar preview uses 1). */
  scale?: number;
  /** For classmates: whether you can see them right now (limited vision). */
  seen?: (at: Body) => boolean;
  /** Shown above their head, so classmates can tell who's who at a glance. */
  name?: string;
}

/** The fallback character, built from simple shapes (spec.md > Important Failure Modes). */
function Bean({ color, body, ghost }: { color: string; body: React.RefObject<Body | null>; ghost?: boolean }) {
  const group = useRef<Group>(null);
  const legL = useRef<Mesh>(null);
  const legR = useRef<Mesh>(null);
  const bob = useRef(0);

  useFrame((_, delta) => {
    if (body.current?.moving) bob.current += delta * 12;
    else bob.current = 0;
    group.current!.position.y = Math.abs(Math.sin(bob.current)) * 0.08;
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
      <mesh position={[0, 1.12, 0.36]} scale={[1.1, 0.6, 0.55]}>
        <sphereGeometry args={[0.3, 20, 14]} />
        <meshToonMaterial color="#dff3ff" />
      </mesh>
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
    </group>
  );
}

/** Characters are drawn a bit smaller in the school than in the menus, so more of it fits on screen. */
export const PLAYER_SCALE = 0.8;

/**
 * A player in the school: their chosen CC0 character (or the bean), standing
 * on a ring in their player color so friends can tell everyone apart.
 */
export function Player({ color, character, body, isYou, ghost, scale = 1, seen, name }: PlayerProps) {
  const group = useRef<Group>(null);
  const file = characterFile(character);

  useFrame((_, delta) => {
    const b = body.current;
    const g = group.current!;
    // A remote player has no body until their first position arrives,
    // and is hidden while you can't see them.
    g.visible = Boolean(b) && (!seen || seen(b!));
    if (!b) return;
    g.position.set(b.x, 0, b.z);
    // Turn smoothly toward the heading.
    let diff = b.heading - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    g.rotation.y += diff * Math.min(1, delta * 12);
  });

  const bean = <Bean color={color} body={body} ghost={ghost} />;

  return (
    <group ref={group} scale={scale}>
      {file ? (
        <ModelBoundary fallback={bean}>
          {/* Models are preloaded at startup; the bean only stands in if one fails to load. */}
          <Suspense fallback={null}>
            <Character file={file} body={body} ghost={ghost} />
          </Suspense>
        </ModelBoundary>
      ) : (
        bean
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color={color} transparent opacity={ghost ? 0.25 : 0.85} />
      </mesh>
      {name && (
        // Always faces the camera, drawn over walls so it's never hidden behind its own head.
        <sprite position-y={2.3} scale={[2.3, 0.58, 1]} renderOrder={10}>
          <spriteMaterial map={nameTag(name, color)} transparent opacity={ghost ? 0.5 : 1} depthTest={false} />
        </sprite>
      )}
      {isYou && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.62, 0.76, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}
