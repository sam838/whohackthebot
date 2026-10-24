import { useFrame } from "@react-three/fiber";
import { nearMeetingButton, nearestTerminal } from "@whtb/shared/geometry";
import { nearestSpot } from "@whtb/shared/pieces";
import { useGame } from "../net/store";
import type { Body } from "./useMovement";

/**
 * Each frame, checks which terminal, meeting button, or hiding spot the local
 * player can reach, and writes it to the store only when it changes, so React
 * re-renders rarely.
 */
export function NearbyWatcher({ me }: { me: React.RefObject<Body> }) {
  useFrame(() => {
    const id = nearestTerminal(me.current)?.id;
    const button = nearMeetingButton(me.current);
    const spot = nearestSpot(me.current)?.id;
    const s = useGame.getState();
    if (id !== s.nearTerminal || button !== s.nearButton || spot !== s.nearSpot) {
      useGame.setState({ nearTerminal: id, nearButton: button, nearSpot: spot });
    }
  });
  return null;
}
