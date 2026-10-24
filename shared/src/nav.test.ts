import { describe, expect, it } from "vitest";
import { buildObstacles } from "./collision";
import { MEETING_BUTTON, ROOMS, SPAWN_SEATS, TERMINALS } from "./map";
import { findPath, isWalkable } from "./nav";

const boxes = buildObstacles();
const insideObstacle = (p: { x: number; z: number }) => boxes.some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ);

describe("bot navigation", () => {
  it("finds a path from the classroom to every terminal and the meeting button", () => {
    const start = SPAWN_SEATS[0];
    for (const target of [...TERMINALS, MEETING_BUTTON]) {
      const path = findPath(start, target);
      expect(path.length, `to ${"id" in target ? target.id : "button"}`).toBeGreaterThan(0);
      const end = path.at(-1)!;
      expect(Math.hypot(end.x - target.x, end.z - target.z)).toBeLessThan(1.6);
    }
  });

  it("never walks through walls or furniture", () => {
    const path = findPath(SPAWN_SEATS[0], { x: 22, z: 16 });
    expect(path.length).toBeGreaterThan(10);
    for (const p of path) {
      expect(insideObstacle(p)).toBe(false);
      expect(isWalkable(p)).toBe(true);
    }
  });

  it("can reach the middle of every room", () => {
    for (const r of ROOMS) {
      expect(findPath(SPAWN_SEATS[0], { x: r.x + r.w / 2, z: r.z + r.d / 2 }).length, r.id).toBeGreaterThan(0);
    }
  });
});
