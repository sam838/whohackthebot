// Walking paths for practice bots (spec.md > Practice Mode & Bots): a grid of
// spots a player's body fits into, built from the same obstacles as collision,
// and A* paths across it.

import { buildObstacles } from "./collision";
import { PLAYER_RADIUS } from "./constants";
import { WORLD_DEPTH, WORLD_WIDTH, type Point } from "./map";

export const NAV_STEP = 0.5;
const COLS = Math.round(WORLD_WIDTH / NAV_STEP);
const ROWS = Math.round(WORLD_DEPTH / NAV_STEP);
// A little extra room so bots don't scrape along furniture.
const CLEARANCE = PLAYER_RADIUS + 0.05;

const walkable: boolean[] = (() => {
  const boxes = buildObstacles();
  const out: boolean[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c + 0.5) * NAV_STEP;
      const z = (r + 0.5) * NAV_STEP;
      out.push(!boxes.some((b) => x + CLEARANCE > b.minX && x - CLEARANCE < b.maxX && z + CLEARANCE > b.minZ && z - CLEARANCE < b.maxZ));
    }
  }
  return out;
})();

const cellOf = (p: Point): [number, number] => [
  Math.min(COLS - 1, Math.max(0, Math.floor(p.x / NAV_STEP))),
  Math.min(ROWS - 1, Math.max(0, Math.floor(p.z / NAV_STEP))),
];
const centerOf = (c: number, r: number): Point => ({ x: (c + 0.5) * NAV_STEP, z: (r + 0.5) * NAV_STEP });
const isOpen = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && walkable[r * COLS + c];

/** The nearest walkable cell to a point (targets like terminals sit inside obstacles). */
function nearestOpen(p: Point): [number, number] | undefined {
  const [c0, r0] = cellOf(p);
  for (let radius = 0; radius < 8; radius++) {
    let best: [number, number] | undefined;
    let bestD = Infinity;
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius || !isOpen(c0 + dc, r0 + dr)) continue;
        const ctr = centerOf(c0 + dc, r0 + dr);
        const d = Math.hypot(ctr.x - p.x, ctr.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = [c0 + dc, r0 + dr];
        }
      }
    }
    if (best) return best;
  }
  return undefined;
}

export function isWalkable(p: Point): boolean {
  const [c, r] = cellOf(p);
  return isOpen(c, r);
}

/**
 * A* from one point to another over the walkable grid. Returns waypoints
 * (cell centers, ending near the target), or an empty list if unreachable.
 */
export function findPath(from: Point, to: Point): Point[] {
  const start = nearestOpen(from);
  const goal = nearestOpen(to);
  if (!start || !goal) return [];
  const key = (c: number, r: number) => r * COLS + c;
  const goalKey = key(goal[0], goal[1]);
  const g = new Map<number, number>([[key(start[0], start[1]), 0]]);
  const came = new Map<number, number>();
  const open: { k: number; c: number; r: number; f: number }[] = [{ k: key(start[0], start[1]), c: start[0], r: start[1], f: 0 }];
  const h = (c: number, r: number) => Math.hypot(c - goal[0], r - goal[1]);
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.k === goalKey) break;
    for (const [dc, dr, cost] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (!isOpen(nc, nr)) continue;
      // No cutting corners diagonally past an obstacle.
      if (dc && dr && (!isOpen(cur.c + dc, cur.r) || !isOpen(cur.c, cur.r + dr))) continue;
      const nk = key(nc, nr);
      const ng = g.get(cur.k)! + cost;
      if (ng >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, ng);
      came.set(nk, cur.k);
      open.push({ k: nk, c: nc, r: nr, f: ng + h(nc, nr) });
    }
  }

  if (!g.has(goalKey)) return [];
  const path: Point[] = [];
  for (let k: number | undefined = goalKey; k !== undefined; k = came.get(k)) {
    path.push(centerOf(k % COLS, Math.floor(k / COLS)));
  }
  return path.reverse();
}
