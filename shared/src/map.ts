// The school layout, in world units. The client draws it and collides with it;
// the server uses it for proximity checks. x runs left→right, z runs top→bottom
// (away from → toward the camera).

export type RoomId = "classroom" | "library" | "lab" | "canteen" | "hallway";

export interface Room {
  id: RoomId;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
}

/** A wall from (x1, z1) to (x2, z2). Walls are axis-aligned. */
export type WallSegment = [x1: number, z1: number, x2: number, z2: number];

export interface Furniture {
  kind: "desk" | "board" | "shelf" | "table" | "labTable" | "canteenTable" | "plant" | "fridge" | "trashcan" | "books";
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  /** Height the piece floats at (e.g. a board mounted on a wall). */
  y?: number;
  /** Whether players bump into it. */
  solid: boolean;
}

export interface TerminalSpot {
  id: string;
  room: RoomId;
  x: number;
  z: number;
}

export interface Point {
  x: number;
  z: number;
}

export const WORLD_WIDTH = 24;
export const WORLD_DEPTH = 18;
export const WALL_HEIGHT = 1.6;
export const WALL_THICKNESS = 0.3;

export const ROOMS: Room[] = [
  { id: "classroom", name: "Classroom", x: 0, z: 0, w: 12, d: 8, color: "#f3dfa2" },
  { id: "library", name: "Library", x: 12, z: 0, w: 12, d: 8, color: "#cdbbe8" },
  { id: "lab", name: "Science Lab", x: 0, z: 10, w: 12, d: 8, color: "#b8e0d2" },
  { id: "canteen", name: "Canteen", x: 12, z: 10, w: 12, d: 8, color: "#f7c59f" },
  { id: "hallway", name: "Hallway", x: 0, z: 8, w: 24, d: 2, color: "#e4e1ea" },
];

// Doorways are the gaps at x 5–7 and x 17–19 on the hallway walls.
export const WALLS: WallSegment[] = [
  [0, 0, 24, 0],
  [0, 18, 24, 18],
  [0, 0, 0, 18],
  [24, 0, 24, 18],
  [12, 0, 12, 8],
  [12, 10, 12, 18],
  [0, 8, 5, 8],
  [7, 8, 17, 8],
  [19, 8, 24, 8],
  [0, 10, 5, 10],
  [7, 10, 17, 10],
  [19, 10, 24, 10],
];

const desks: Furniture[] = [];
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 3; col++) {
    desks.push({ kind: "desk", x: 2 + col * 3, z: 3 + row * 2.2, w: 1.4, d: 0.8, h: 0.75, color: "#c98f5a", solid: true });
  }
}

export const FURNITURE: Furniture[] = [
  ...desks,
  { kind: "board", x: 6, z: 0.3, w: 5, d: 0.15, h: 1.4, y: 0.7, color: "#2f5d4a", solid: false },
  ...[0, 1, 2, 3].map(
    (i): Furniture => ({ kind: "shelf", x: 14.2 + i * 2.6, z: 0.65, w: 2, d: 0.7, h: 1.4, color: "#8a5a3c", solid: true }),
  ),
  { kind: "table", x: 17.5, z: 4.6, w: 3, d: 1.2, h: 0.75, color: "#a8744f", solid: true },
  { kind: "labTable", x: 4, z: 13, w: 3.5, d: 1.2, h: 0.9, color: "#f4f4f4", solid: true },
  { kind: "labTable", x: 7.5, z: 15.6, w: 3.5, d: 1.2, h: 0.9, color: "#f4f4f4", solid: true },
  { kind: "canteenTable", x: 16.5, z: 13, w: 4, d: 1.2, h: 0.75, color: "#e07a5f", solid: true },
  { kind: "canteenTable", x: 16.5, z: 15.8, w: 4, d: 1.2, h: 0.75, color: "#e07a5f", solid: true },
  // Decoration (CC0 models in slice 5), placed against walls out of the way.
  { kind: "books", x: 17.2, z: 4.6, w: 0.6, d: 0.35, h: 0.3, y: 0.75, color: "#c0392b", solid: false },
  { kind: "plant", x: 11.3, z: 0.8, w: 0.7, d: 0.7, h: 1.4, color: "#4cbf87", solid: true },
  { kind: "plant", x: 23.3, z: 7.3, w: 0.7, d: 0.7, h: 1.4, color: "#4cbf87", solid: true },
  { kind: "plant", x: 11.3, z: 17.3, w: 0.7, d: 0.7, h: 1.4, color: "#4cbf87", solid: true },
  { kind: "fridge", x: 12.7, z: 10.8, w: 0.9, d: 0.8, h: 1.9, color: "#e8e8e8", solid: true },
  { kind: "trashcan", x: 23.4, z: 14, w: 0.6, d: 0.6, h: 0.9, color: "#7a7f87", solid: true },
];

export const TERMINAL_SIZE = { w: 0.9, d: 0.6 };

export const TERMINALS: TerminalSpot[] = [
  { id: "library-1", room: "library", x: 22.8, z: 3.2 },
  { id: "library-2", room: "library", x: 13.4, z: 6.6 },
  { id: "lab-1", room: "lab", x: 1.2, z: 16.6 },
  { id: "lab-2", room: "lab", x: 10.8, z: 11.4 },
  { id: "canteen-1", room: "canteen", x: 22.8, z: 11.4 },
  { id: "canteen-2", room: "canteen", x: 22.8, z: 16.6 },
];

export const MEETING_BUTTON: Point = { x: 10.4, z: 4.6 };
export const MEETING_BUTTON_SIZE = 1.1;

/** Seats in front of the classroom desks, where players start and respawn. */
export const SPAWN_SEATS: Point[] = [
  { x: 2, z: 4.1 },
  { x: 5, z: 4.1 },
  { x: 8, z: 4.1 },
  { x: 2, z: 6.3 },
  { x: 5, z: 6.3 },
];

export function roomAt(p: Point): Room | undefined {
  // The hallway is listed last but overlaps nothing, so first match wins.
  return ROOMS.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.z >= r.z && p.z <= r.z + r.d);
}
