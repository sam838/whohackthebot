import { describe, expect, it } from "vitest";
import { buildObstacles } from "./collision";
import { INTERACT_RADIUS, PLAYER_RADIUS } from "./constants";
import { distance } from "./geometry";
import { MEETING_BUTTON, SPAWN_SEATS, TERMINALS, WORLD_DEPTH, WORLD_WIDTH, roomAt, type Point } from "./map";
import { MAX_PLAYERS, QUESTIONS_PER_CLASSMATE } from "./constants";
import { EXAMINE_RADIUS, HIDING_SPOTS, PIECE_ROOMS, PIECES_PER_QUESTION } from "./pieces";

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

  it("every hiding spot can be reached and examined, in the room it says", () => {
    for (const s of HIDING_SPOTS) {
      expect(canReach(s, 0.3), `${s.id} reachable`).toBe(true);
      expect(roomAt(s)?.id, `${s.id} room`).toBe(s.room);
    }
  });

  it("hiding spots never sit where Use or the meeting button would take over", () => {
    for (const s of HIDING_SPOTS) {
      for (const t of TERMINALS) expect(distance(s, t), `${s.id} vs ${t.id}`).toBeGreaterThan(INTERACT_RADIUS);
      expect(distance(s, MEETING_BUTTON), `${s.id} vs meeting button`).toBeGreaterThan(INTERACT_RADIUS);
      for (const o of HIDING_SPOTS) if (o !== s) expect(distance(s, o), `${s.id} vs ${o.id}`).toBeGreaterThan(EXAMINE_RADIUS);
    }
  });

  it("there are more hiding spots than pieces in the biggest game, in every piece room", () => {
    expect(new Set(HIDING_SPOTS.map((s) => s.id)).size).toBe(HIDING_SPOTS.length);
    expect(HIDING_SPOTS.length).toBeGreaterThan((MAX_PLAYERS - 1) * QUESTIONS_PER_CLASSMATE * PIECES_PER_QUESTION);
    for (const room of PIECE_ROOMS) expect(HIDING_SPOTS.some((s) => s.room === room), room).toBe(true);
  });
});
