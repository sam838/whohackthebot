import { useFrame, useThree } from "@react-three/fiber";
import type { Body } from "./useMovement";

// Fixed angle above and in front of the player (spec.md > Look and Feel):
// about 50° down, never rotated by the player.
const OFFSET = { y: 11, z: 9 };

export function FollowCamera({ target }: { target: React.RefObject<Body> }) {
  const camera = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const t = target.current;
    const k = Math.min(1, delta * 6);
    camera.position.x += (t.x - camera.position.x) * k;
    camera.position.y = OFFSET.y;
    camera.position.z += (t.z + OFFSET.z - camera.position.z) * k;
    camera.lookAt(camera.position.x, 0, camera.position.z - OFFSET.z);
  });

  return null;
}
