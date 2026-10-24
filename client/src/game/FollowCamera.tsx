import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "../net/store";
import type { Body } from "./useMovement";

// Fixed angle above and in front of the player (spec.md > Look and Feel):
// about 50° down, never rotated by the player.
const OFFSET = { y: 14, z: 11.5 };
/** At game start the camera swoops down from high above the school. */
const INTRO_HEIGHT = 34;
const INTRO_DELAY_MS = 1500;
const INTRO_MS = 1800;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function FollowCamera({ target }: { target: React.RefObject<Body> }) {
  const camera = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const t = target.current;
    const k = Math.min(1, delta * 6);
    camera.position.x += (t.x - camera.position.x) * k;
    const introAt = useGame.getState().introAt;
    const p = introAt === undefined || reduceMotion ? 1 : Math.min(1, Math.max(0, (performance.now() - introAt - INTRO_DELAY_MS) / INTRO_MS));
    camera.position.y = INTRO_HEIGHT + (OFFSET.y - INTRO_HEIGHT) * ease(p);
    camera.position.z += (t.z + OFFSET.z - camera.position.z) * k;
    camera.lookAt(camera.position.x, 0, camera.position.z - OFFSET.z);
  });

  return null;
}
