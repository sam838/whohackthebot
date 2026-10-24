import { describe, expect, it } from "vitest";
import { buildObstacles } from "./collision";
import { INTERACT_RADIUS, PLAYER_RADIUS } from "./constants";
import { distance } from "./geometry";
import { MEETING_BUTTON, SPAWN_SEATS, TERMINALS, WORLD_DEPTH, WORLD_WIDTH, type Point } from "./map";
import { PICKUP_RADIUS, PIECE_SPOTS } from "./pieces";

// Flood-fill the floor on a fine grid from the first classroom seat, keeping
// only spots a player's body fits into, so furniture can never wall anything off.
const STEP = 0.2;
const boxes = buildObstacles();
const free = (p: Point) =>
  !boxes.some(
    (b) => p.x + PLAYER_RADIUS > b.minX && p.x - PLAYER_RADIUS < b.maxX && p.z + PLAYER_RADIUS > b.minZ && p.z - PLAYER_RADIUS < b.maxZ,
  );

function reachable(): Point[] {
  const cols = Math.round(WORLD_WIDTH / STEP);
  const rows = Math.round(WORLD_DEPTH / STEP);
  const seen = new Set<number>();
  const out: Point[] = [];
  const start = SPAWN_SEATS[0];
  const queue: [number, number][] = [[Math.round(start.x / STEP), Math.round(start.z / STEP)]];
  while (queue.length) {
    const [c, r] = queue.pop()!;
    const key = r * cols + c;
    if (c < 0 || r < 0 || c > cols || r > rows || seen.has(key)) continue;
    seen.add(key);
    const p = { x: c * STEP, z: r * STEP };
    if (!free(p)) continue;
    out.push(p);
    queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return out;
}

const floor = reachable();
const canReach = (target: Point, radius: number) => floor.some((p) => distance(p, target) <= radius);

describe("the school stays playable", () => {
  it("every classroom seat is reachable", () => {
    for (const seat of SPAWN_SEATS) expect(canReach(seat, STEP), `seat ${seat.x},${seat.z}`).toBe(true);
  });

  it("every terminal can be used", () => {
    for (const t of TERMINALS) expect(canReach(t, INTERACT_RADIUS), t.id).toBe(true);
  });

  it("the meeting button can be pressed", () => {
    expect(canReach(MEETING_BUTTON, INTERACT_RADIUS)).toBe(true);
  });

  it("every piece hiding spot can be walked onto", () => {
    for (const s of PIECE_SPOTS) expect(canReach(s, PICKUP_RADIUS), `${s.room} ${s.x},${s.z}`).toBe(true);
  });
});
