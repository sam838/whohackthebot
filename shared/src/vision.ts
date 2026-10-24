// What a player can see (prd.md > Moving Around the School): a circle around them,
// cut off by walls. The client hides classmates outside it; the server uses the
// same rule for Expel's "nobody watching" check and for what bots notice.

import { distance } from "./geometry";
import { WALLS, type Point } from "./map";

/** How far you can see, in world units (about one room across). */
export const VISION_RADIUS = 7;

/** Which side of the line p→q the point r is on: 1, -1, or 0 if on the line. */
function side(p: Point, q: Point, r: Point): number {
  return Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
}

/** Whether segment a–b crosses segment c–d (a wall end touching the line counts). */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

/** True if `from` can see `to`: close enough, and no wall in between (doorways are gaps). */
export function canSee(from: Point, to: Point, radius = VISION_RADIUS): boolean {
  if (distance(from, to) > radius) return false;
  return !WALLS.some(([x1, z1, x2, z2]) => crosses(from, to, { x: x1, z: z1 }, { x: x2, z: z2 }));
}
