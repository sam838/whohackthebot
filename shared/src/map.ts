// The school layout, in world units. The client draws it and collides with it;
// the server uses it for proximity checks. x runs left→right, z runs top→bottom
// (away from → toward the camera).

export type RoomId = "classroom" | "library" | "lab" | "canteen" | "gym" | "server" | "music" | "art" | "hallway";

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
  kind:
    | "desk"
    | "teacherDesk"
    | "board"
    | "shelf"
    | "table"
    | "labTable"
    | "canteenTable"
    | "plant"
    | "fridge"
    | "trashcan"
    | "books"
    | "sink"
    | "counter"
    | "vending"
    // The new wing (plain boxes, dressed up in client/src/game/Decor.tsx).
    | "bleachers"
    | "mat"
    | "ballCart"
    | "serverRack"
    | "piano"
    | "stage"
    | "speaker"
    | "easel"
    | "paintShelf";
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

export const WORLD_WIDTH = 46;
export const WORLD_DEPTH = 18;
export const WALL_HEIGHT = 1.6;
export const WALL_THICKNESS = 0.3;

export const ROOMS: Room[] = [
  { id: "classroom", name: "Classroom", x: 0, z: 0, w: 12, d: 8, color: "#f3dfa2" },
  { id: "library", name: "Library", x: 12, z: 0, w: 12, d: 8, color: "#cdbbe8" },
  { id: "lab", name: "Science Lab", x: 0, z: 10, w: 12, d: 8, color: "#b8e0d2" },
  { id: "canteen", name: "Canteen", x: 12, z: 10, w: 12, d: 8, color: "#f7c59f" },
  // The new wing, east of the first four rooms.
  { id: "gym", name: "Gym", x: 24, z: 0, w: 14, d: 8, color: "#f4d6a8" },
  { id: "server", name: "Server Room", x: 38, z: 0, w: 8, d: 8, color: "#b9c6d8" },
  { id: "music", name: "Music Room", x: 24, z: 10, w: 11, d: 8, color: "#e8c1c8" },
  { id: "art", name: "Art Room", x: 35, z: 10, w: 11, d: 8, color: "#c8e6c9" },
  { id: "hallway", name: "Hallway", x: 0, z: 8, w: 46, d: 2, color: "#e4e1ea" },
];

// Every room opens onto the long hallway through a 2-unit doorway (the gaps below).
export const WALLS: WallSegment[] = [
  [0, 0, 46, 0],
  [0, 18, 46, 18],
  [0, 0, 0, 18],
  [46, 0, 46, 18],
  // between rooms
  [12, 0, 12, 8],
  [12, 10, 12, 18],
  [24, 0, 24, 8],
  [24, 10, 24, 18],
  [38, 0, 38, 8],
  [35, 10, 35, 18],
  // hallway, north side: doors at x 5–7, 17–19, 30–32 (gym), 41–43 (server room)
  [0, 8, 5, 8],
  [7, 8, 17, 8],
  [19, 8, 30, 8],
  [32, 8, 41, 8],
  [43, 8, 46, 8],
  // hallway, south side: doors at x 5–7, 17–19, 28.5–30.5 (music), 39.5–41.5 (art)
  [0, 10, 5, 10],
  [7, 10, 17, 10],
  [19, 10, 28.5, 10],
  [30.5, 10, 39.5, 10],
  [41.5, 10, 46, 10],
];

const desks: Furniture[] = [];
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 3; col++) {
    desks.push({ kind: "desk", x: 2 + col * 3, z: 3 + row * 2.2, w: 1.4, d: 0.8, h: 0.75, color: "#c98f5a", solid: true });
  }
}

export const FURNITURE: Furniture[] = [
  ...desks,
  { kind: "board", x: 6, z: 0.25, w: 5, d: 0.12, h: 1.0, y: 0.45, color: "#2f5d4a", solid: false },
  { kind: "teacherDesk", x: 10, z: 1.7, w: 1.6, d: 0.8, h: 0.8, color: "#a8744f", solid: true },
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
  { kind: "sink", x: 8.6, z: 10.6, w: 1.2, d: 0.7, h: 1.0, color: "#dfe6ea", solid: true },
  { kind: "counter", x: 20.8, z: 10.6, w: 2.2, d: 0.7, h: 1.0, color: "#c98f5a", solid: true },
  { kind: "vending", x: 12.7, z: 12.4, w: 0.8, d: 0.7, h: 1.8, color: "#e5484d", solid: true },
  // Gym
  { kind: "bleachers", x: 31, z: 1, w: 8, d: 1.4, h: 1, color: "#8aa1c1", solid: true },
  { kind: "mat", x: 27, z: 5.5, w: 2.4, d: 1.6, h: 0.1, color: "#3d7dd8", solid: false },
  { kind: "ballCart", x: 36.6, z: 6.6, w: 1, d: 0.7, h: 0.7, color: "#7a7f87", solid: true },
  // Server Room: where Study-Bot lives
  ...[40, 42, 44].map((x): Furniture => ({ kind: "serverRack", x, z: 0.75, w: 1.2, d: 0.9, h: 1.9, color: "#2b2d3a", solid: true })),
  { kind: "desk", x: 44.5, z: 5.5, w: 1.4, d: 0.8, h: 0.75, color: "#c98f5a", solid: true },
  // Music Room
  { kind: "piano", x: 26.5, z: 11, w: 2.4, d: 1, h: 1.1, color: "#1f1d2b", solid: true },
  { kind: "stage", x: 32, z: 13.5, w: 1.6, d: 1.4, h: 0.25, color: "#6f5f8c", solid: true },
  { kind: "speaker", x: 34.2, z: 17.3, w: 0.8, d: 0.7, h: 1.3, color: "#33303d", solid: true },
  // Art Room
  ...[38, 41].map((x): Furniture => ({ kind: "easel", x, z: 14, w: 1, d: 0.3, h: 1.6, color: "#a8744f", solid: true })),
  { kind: "table", x: 41.5, z: 16.3, w: 3, d: 1.2, h: 0.75, color: "#f2d0a4", solid: true },
  { kind: "paintShelf", x: 37, z: 10.6, w: 2, d: 0.6, h: 1.4, color: "#7fb3d5", solid: true },
];

export const TERMINAL_SIZE = { w: 0.9, d: 0.6 };

export const TERMINALS: TerminalSpot[] = [
  { id: "library-1", room: "library", x: 22.8, z: 3.2 },
  { id: "library-2", room: "library", x: 13.4, z: 6.6 },
  { id: "lab-1", room: "lab", x: 1.2, z: 16.6 },
  { id: "lab-2", room: "lab", x: 10.8, z: 11.4 },
  { id: "canteen-1", room: "canteen", x: 22.8, z: 11.4 },
  { id: "canteen-2", room: "canteen", x: 22.8, z: 16.6 },
  { id: "server-1", room: "server", x: 45.2, z: 3.5 },
  { id: "art-1", room: "art", x: 45.2, z: 13 },
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
