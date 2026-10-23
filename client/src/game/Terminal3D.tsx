import { useFrame } from "@react-three/fiber";
import { TERMINAL_SIZE, type TerminalSpot } from "@whtb/shared/map";
import { useRef } from "react";
import type { Mesh } from "three";
import { useGame } from "../net/store";

const SCREEN_IDLE = "#ffd84d";
const SCREEN_NEAR = "#fff3b0";

/**
 * A Study-Bot terminal. It glows when you're close enough to use it, shows a
 * bobbing marker if it's on your task list, and, for the Bluffer only, a red
 * screen while their hack is waiting for a victim.
 */
export function Terminal3D({ spot }: { spot: TerminalSpot }) {
  const near = useGame((s) => s.nearTerminal === spot.id);
  const task = useGame((s) => s.tasks.find((t) => t.terminalId === spot.id));
  // Marker shows once you hold all the pieces (the Bluffer's fake tasks are always "ready").
  const isTask = Boolean(task && task.found === task.total);
  const hackedByMe = useGame((s) => s.myHacks.includes(spot.id));
  const marker = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (marker.current) {
      marker.current.position.y = 2.3 + Math.sin(clock.elapsedTime * 3) * 0.12;
      marker.current.rotation.y = clock.elapsedTime * 1.5;
    }
  });

  return (
    <group position={[spot.x, 0, spot.z]}>
      <mesh position-y={0.55}>
        <boxGeometry args={[TERMINAL_SIZE.w, 1.1, TERMINAL_SIZE.d]} />
        <meshToonMaterial color="#3b3550" />
      </mesh>
      <mesh position={[0, 1.35, 0.05]} rotation-x={-0.35}>
        <boxGeometry args={[0.8, 0.55, 0.08]} />
        <meshBasicMaterial color={hackedByMe ? "#e5484d" : near ? SCREEN_NEAR : SCREEN_IDLE} />
      </mesh>
      {near && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.95, 1.15, 40]} />
          <meshBasicMaterial color="#ffd84d" />
        </mesh>
      )}
      {isTask && (
        <mesh ref={marker} position-y={2.3}>
          <octahedronGeometry args={[0.22]} />
          <meshBasicMaterial color="#ffd84d" />
        </mesh>
      )}
    </group>
  );
}
