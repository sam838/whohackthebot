import { INTERACT_RADIUS } from "./constants";
import { MEETING_BUTTON, TERMINALS, type Point, type TerminalSpot } from "./map";

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** The closest terminal within reach, if any. Used by the client (button) and server (check). */
export function nearestTerminal(p: Point): TerminalSpot | undefined {
  let best: TerminalSpot | undefined;
  let bestDist = INTERACT_RADIUS;
  for (const t of TERMINALS) {
    const d = distance(p, t);
    if (d <= bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

export function nearMeetingButton(p: Point): boolean {
  return distance(p, MEETING_BUTTON) <= INTERACT_RADIUS;
}
