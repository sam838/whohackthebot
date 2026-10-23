import {
  FURNITURE,
  MEETING_BUTTON,
  MEETING_BUTTON_SIZE,
  TERMINALS,
  TERMINAL_SIZE,
  WALLS,
  WALL_THICKNESS,
  type Point,
} from "./map";

/** Axis-aligned box on the floor. */
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function boxAround(x: number, z: number, w: number, d: number): Box {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** Everything a player can bump into: walls, solid furniture, terminals, the button. */
export function buildObstacles(): Box[] {
  const half = WALL_THICKNESS / 2;
  const walls = WALLS.map(([x1, z1, x2, z2]) => ({
    minX: Math.min(x1, x2) - half,
    maxX: Math.max(x1, x2) + half,
    minZ: Math.min(z1, z2) - half,
    maxZ: Math.max(z1, z2) + half,
  }));
  const furniture = FURNITURE.filter((f) => f.solid).map((f) => boxAround(f.x, f.z, f.w, f.d));
  const terminals = TERMINALS.map((t) => boxAround(t.x, t.z, TERMINAL_SIZE.w, TERMINAL_SIZE.d));
  const button = boxAround(MEETING_BUTTON.x, MEETING_BUTTON.z, MEETING_BUTTON_SIZE, MEETING_BUTTON_SIZE);
  return [...walls, ...furniture, ...terminals, button];
}

function hits(p: Point, radius: number, boxes: Box[]): boolean {
  return boxes.some(
    (b) => p.x + radius > b.minX && p.x - radius < b.maxX && p.z + radius > b.minZ && p.z - radius < b.maxZ,
  );
}

/**
 * Moves a round body by (dx, dz), one axis at a time, so that hitting a wall
 * on one axis still lets it slide along the other.
 */
export function moveWithCollision(from: Point, dx: number, dz: number, radius: number, boxes: Box[]): Point {
  let x = from.x;
  let z = from.z;
  if (dx !== 0 && !hits({ x: x + dx, z }, radius, boxes)) x += dx;
  if (dz !== 0 && !hits({ x, z: z + dz }, radius, boxes)) z += dz;
  return { x, z };
}
