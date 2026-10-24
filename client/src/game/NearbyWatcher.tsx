import { useFrame } from "@react-three/fiber";
import { nearMeetingButton, nearestTerminal } from "@whtb/shared/geometry";
import { EXPEL_RADIUS } from "@whtb/shared/constants";
import { distance } from "@whtb/shared/geometry";
import { nearestSpot } from "@whtb/shared/pieces";
import { canSee } from "@whtb/shared/vision";
import { useGame } from "../net/store";
import { remotePositions } from "./positions";
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

    // Bluffer: who's close enough to expel. (Whether anyone is watching is the Bluffer's call.)
    if (s.role !== "bluffer" || !s.game || !s.myId) return;
    const living = s.game.players.filter((p) => p.alive && p.id !== s.myId).map((p) => p.id);
    let victim: string | undefined;
    let best = EXPEL_RADIUS;
    for (const pid of living) {
      const p = remotePositions.get(pid);
      if (!p || !canSee(me.current, p)) continue;
      const d = distance(me.current, p);
      if (d <= best) {
        victim = pid;
        best = d;
      }
    }
    if (victim !== s.nearVictim) useGame.setState({ nearVictim: victim });
  });
  return null;
}
