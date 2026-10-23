import { describe, expect, it } from "vitest";
import { buildObstacles, moveWithCollision } from "./collision";
import { PLAYER_RADIUS } from "./constants";
import { SPAWN_SEATS } from "./map";

const boxes = buildObstacles();
const r = PLAYER_RADIUS;

describe("moveWithCollision", () => {
  it("moves freely in open floor", () => {
    expect(moveWithCollision({ x: 6, z: 9 }, 0.5, 0, r, boxes)).toEqual({ x: 6.5, z: 9 });
  });

  it("is blocked by a wall", () => {
    // The classroom/hallway wall at z = 8 (no doorway at x = 3).
    const start = { x: 3, z: 7.2 };
    const end = moveWithCollision(start, 0, 0.5, r, boxes);
    expect(end).toEqual(start);
  });

  it("slides along a wall instead of sticking", () => {
    const end = moveWithCollision({ x: 3, z: 7.2 }, 0.3, 0.5, r, boxes);
    expect(end.x).toBeCloseTo(3.3);
    expect(end.z).toBe(7.2);
  });

  it("passes through a doorway", () => {
    let p = { x: 6, z: 7.2 };
    for (let i = 0; i < 10; i++) p = moveWithCollision(p, 0, 0.3, r, boxes);
    expect(p.z).toBeGreaterThan(9);
  });

  it("is blocked by solid furniture", () => {
    // Desk at (2, 3); walking up from the seat below it.
    const start = { x: 2, z: 4.0 };
    expect(moveWithCollision(start, 0, -0.3, r, boxes)).toEqual(start);
  });

  it("every spawn seat starts clear of obstacles", () => {
    for (const seat of SPAWN_SEATS) {
      expect(moveWithCollision(seat, 0.01, 0.01, r, boxes)).not.toEqual(seat);
    }
  });
});
