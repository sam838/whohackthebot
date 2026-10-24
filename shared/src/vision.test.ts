import { describe, expect, it } from "vitest";
import { VISION_RADIUS, canSee } from "./vision";

describe("what a player can see", () => {
  it("sees classmates in the same room", () => {
    expect(canSee({ x: 2, z: 4 }, { x: 8, z: 6 })).toBe(true);
  });

  it("can't see through a wall", () => {
    // Class 7A and the library share the wall at x = 12.
    expect(canSee({ x: 11, z: 4 }, { x: 13, z: 4 })).toBe(false);
    // Class 7A and the hallway: the wall at z = 8, away from the doorway.
    expect(canSee({ x: 2, z: 7 }, { x: 2, z: 9 })).toBe(false);
  });

  it("can see through a doorway", () => {
    // The classroom door is the gap at x 5–7 on the z = 8 wall.
    expect(canSee({ x: 6, z: 6 }, { x: 6, z: 9.5 })).toBe(true);
  });

  it("can't see past the vision circle, even with nothing in between", () => {
    expect(canSee({ x: 1, z: 9 }, { x: 1 + VISION_RADIUS + 0.5, z: 9 })).toBe(false);
    expect(canSee({ x: 1, z: 9 }, { x: 1 + VISION_RADIUS - 0.5, z: 9 })).toBe(true);
  });

  it("works both ways", () => {
    const a = { x: 30, z: 4 };
    const b = { x: 35, z: 9 };
    expect(canSee(a, b)).toBe(canSee(b, a));
  });
});
