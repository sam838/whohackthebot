import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Player } from "./Player";
import { remotePositions } from "./positions";
import type { Body } from "./useMovement";

/**
 * Another player's character. Each frame it glides toward the latest position
 * the server sent, so 12 updates a second still look smooth at 60 frames.
 */
export function RemotePlayer({ id, color, character }: { id: string; color: string; character: string }) {
  const body = useRef<Body | null>(null);

  useFrame((_, delta) => {
    const target = remotePositions.get(id);
    if (!target) return;
    if (!body.current) {
      body.current = { ...target, moving: false };
      return;
    }
    const b = body.current;
    const k = Math.min(1, delta * 12);
    const dx = target.x - b.x;
    const dz = target.z - b.z;
    b.x += dx * k;
    b.z += dz * k;
    b.heading = target.heading;
    b.moving = Math.hypot(dx, dz) > 0.02;
  });

  const spawn = remotePositions.get(id);
  if (!body.current && spawn) body.current = { ...spawn, moving: false };

  return <Player color={color} character={character} body={body} />;
}
