import { useFrame } from "@react-three/fiber";
import { buildObstacles, moveWithCollision } from "@whtb/shared/collision";
import { PLAYER_RADIUS, WALK_SPEED } from "@whtb/shared/constants";
import { SPAWN_SEATS } from "@whtb/shared/map";
import { useRef } from "react";
import { readDirection } from "./input";

const obstacles = buildObstacles();

export interface Body {
  x: number;
  z: number;
  heading: number;
  moving: boolean;
}

/**
 * The local player's body, moved every frame from joystick/keyboard input.
 * Lives in a ref, not React state, so 60 updates a second don't re-render.
 */
export function useMovement(): React.RefObject<Body> {
  const body = useRef<Body>({ ...SPAWN_SEATS[0], heading: Math.PI, moving: false });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const dir = readDirection();
    const b = body.current;
    b.moving = dir.x !== 0 || dir.z !== 0;
    if (!b.moving) return;
    const next = moveWithCollision(b, dir.x * WALK_SPEED * dt, dir.z * WALK_SPEED * dt, PLAYER_RADIUS, obstacles);
    b.x = next.x;
    b.z = next.z;
    b.heading = Math.atan2(dir.x, dir.z);
  });

  return body;
}
