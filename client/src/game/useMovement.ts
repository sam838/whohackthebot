import { useFrame } from "@react-three/fiber";
import { buildObstacles, moveWithCollision } from "@whtb/shared/collision";
import { MOVE_SEND_RATE, PLAYER_RADIUS, WALK_SPEED } from "@whtb/shared/constants";
import type { Point } from "@whtb/shared/map";
import { useEffect, useRef } from "react";
import { socket } from "../net/socket";
import { amAlive, panelOpen, useGame } from "../net/store";
import { readDirection } from "./input";
import { localPlayer } from "./positions";

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
 * Sends the position to the server about MOVE_SEND_RATE times a second.
 */
export function useMovement(spawn: Point): React.RefObject<Body> {
  const body = useRef<Body>({ x: spawn.x, z: spawn.z, heading: Math.PI, moving: false });
  const sinceSend = useRef(0);
  const unsent = useRef(true);

  useEffect(() => {
    localPlayer.teleport = (x, z) => {
      body.current.x = x;
      body.current.z = z;
      body.current.heading = Math.PI;
      unsent.current = true;
    };
    return () => {
      localPlayer.teleport = undefined;
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // Stand still in a terminal panel, a meeting, after being kicked out, or when the game ends.
    const state = useGame.getState();
    const frozen = panelOpen(state) || state.gameOver || state.game?.phase !== "playing" || !amAlive(state);
    const dir = frozen ? { x: 0, z: 0 } : readDirection();
    const b = body.current;
    b.moving = dir.x !== 0 || dir.z !== 0;
    if (b.moving) {
      const next = moveWithCollision(b, dir.x * WALK_SPEED * dt, dir.z * WALK_SPEED * dt, PLAYER_RADIUS, obstacles);
      b.x = next.x;
      b.z = next.z;
      b.heading = Math.atan2(dir.x, dir.z);
      unsent.current = true;
    }

    sinceSend.current += delta;
    if (unsent.current && sinceSend.current >= 1 / MOVE_SEND_RATE) {
      socket.emit("move", { x: b.x, z: b.z, heading: b.heading });
      sinceSend.current = 0;
      unsent.current = false;
    }
  });

  return body;
}
