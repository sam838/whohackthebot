import { useFrame } from "@react-three/fiber";
import { nearestTerminal } from "@whtb/shared/geometry";
import { useGame } from "../net/store";
import type { Body } from "./useMovement";

/**
 * Each frame, checks which terminal (if any) the local player can reach, and
 * writes it to the store only when it changes, so React re-renders rarely.
 */
export function NearbyWatcher({ me }: { me: React.RefObject<Body> }) {
  useFrame(() => {
    const id = nearestTerminal(me.current)?.id;
    if (id !== useGame.getState().nearTerminal) useGame.setState({ nearTerminal: id });
  });
  return null;
}
