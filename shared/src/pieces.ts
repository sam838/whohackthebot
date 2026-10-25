// Where question pieces hide (prd.md > Question Pieces): inside things around the
// school that players Examine. Nothing lies on the floor, and only the server knows
// which spots hold a piece. There are more spots than pieces, so some searches
// come up empty.

import { distance } from "./geometry";
import type { Point, RoomId } from "./map";

export interface HidingSpot extends Point {
  id: string;
  room: RoomId;
  /** Where in the object the piece was, for the toast: "Found “What is” in the fridge!" */
  label: string;
}

// x, z is where you stand to examine it: on the floor just in front of the object.
// Objects right next to a terminal are left out, so "Use" and "Examine" never compete.
export const HIDING_SPOTS: HidingSpot[] = [
  // Class 7A
  ...[2, 5, 8].flatMap((x, col) =>
    [3.9, 6.1].map((z, row): HidingSpot => ({ id: `desk-${row * 3 + col + 1}`, room: "classroom", label: "inside a desk", x, z })),
  ),
  { id: "teacher-desk", room: "classroom", label: "in the teacher's desk drawer", x: 10, z: 2.6 },
  { id: "chalkboard", room: "classroom", label: "behind the chalkboard", x: 6, z: 1.1 },
  { id: "class-poster", room: "classroom", label: "behind the poster", x: 9.25, z: 1.0 },
  { id: "class-window", room: "classroom", label: "on the windowsill", x: 1.6, z: 1.0 },
  { id: "class-plant", room: "classroom", label: "in the plant pot", x: 11.3, z: 1.75 },
  // Hallway
  { id: "lockers-west", room: "hallway", label: "in the lockers", x: 2.5, z: 9 },
  { id: "lockers-middle", room: "hallway", label: "in the lockers", x: 12, z: 9 },
  { id: "lockers-east", room: "hallway", label: "in the lockers", x: 21.5, z: 9 },
  { id: "lockers-centre-west", room: "hallway", label: "in the lockers", x: 8.5, z: 9 },
  { id: "lockers-centre-east", room: "hallway", label: "in the lockers", x: 15.5, z: 9 },
  { id: "lockers-far-east", room: "hallway", label: "in the lockers", x: 23, z: 9 },
  // Library
  ...[14.2, 16.8, 19.4, 22].map((x, i): HidingSpot => ({ id: `bookshelf-${i + 1}`, room: "library", label: "between the books on a shelf", x, z: 1.5 })),
  { id: "reading-table", room: "library", label: "under the reading table", x: 17.5, z: 5.7 },
  { id: "library-rug", room: "library", label: "under the rug", x: 15.3, z: 4.6 },
  { id: "library-plant", room: "library", label: "in the plant pot", x: 22.5, z: 7.1 },
  // Science Lab
  { id: "periodic-table", room: "lab", label: "behind the periodic table poster", x: 2.2, z: 10.9 },
  { id: "goggles-poster", room: "lab", label: "behind the safety poster", x: 3.6, z: 10.9 },
  { id: "lab-table-1", room: "lab", label: "under a lab table", x: 4, z: 14.1 },
  { id: "lab-table-2", room: "lab", label: "under a lab table", x: 7.5, z: 14.6 },
  { id: "lab-sink", room: "lab", label: "under the sink", x: 8.6, z: 11.4 },
  { id: "lab-plant", room: "lab", label: "in the plant pot", x: 10.5, z: 17.1 },
  // Canteen
  { id: "fridge", room: "canteen", label: "in the fridge", x: 13.6, z: 11 },
  { id: "vending", room: "canteen", label: "in the vending machine", x: 13.6, z: 12.4 },
  { id: "menu-board", room: "canteen", label: "behind the menu board", x: 15.4, z: 10.9 },
  { id: "counter", room: "canteen", label: "behind the counter", x: 20.8, z: 11.4 },
  { id: "canteen-table-1", room: "canteen", label: "under a canteen table", x: 19, z: 13 },
  { id: "canteen-table-2", room: "canteen", label: "under a canteen table", x: 16.5, z: 16.8 },
  { id: "trash-can", room: "canteen", label: "in the trash can", x: 22.6, z: 14 },
  // Gym
  { id: "bleachers", room: "gym", label: "under the bleachers", x: 31, z: 2.3 },
  { id: "gym-mat", room: "gym", label: "under the gym mat", x: 27, z: 5.5 },
  { id: "ball-cart", room: "gym", label: "in the ball cart", x: 35.6, z: 6.6 },
  { id: "scoreboard", room: "gym", label: "behind the scoreboard", x: 25.5, z: 1.1 },
  { id: "trophy-case", room: "gym", label: "in the trophy case", x: 36.5, z: 1.1 },
  // Server Room
  ...[40, 42, 44].map((x, i): HidingSpot => ({ id: `server-rack-${i + 1}`, room: "server", label: "behind a server rack", x, z: 1.8 })),
  { id: "operator-desk", room: "server", label: "under the operator's desk", x: 44.5, z: 6.4 },
  { id: "router-box", room: "server", label: "in the router box", x: 38.9, z: 5 },
  // Music Room
  { id: "piano", room: "music", label: "inside the piano", x: 26.5, z: 12.1 },
  { id: "double-bass", room: "music", label: "behind the double bass", x: 32, z: 12.3 },
  { id: "speaker", room: "music", label: "behind the speaker", x: 33.3, z: 17.3 },
  { id: "guitar-case", room: "music", label: "in the guitar case", x: 25.6, z: 16.6 },
  { id: "sheet-music", room: "music", label: "in the sheet music", x: 33.7, z: 10.9 },
  // Art Room
  ...[38, 41].map((x, i): HidingSpot => ({ id: `easel-${i + 1}`, room: "art", label: "behind a painting on an easel", x, z: 14.7 })),
  { id: "art-table", room: "art", label: "under the art table", x: 39.4, z: 16.3 },
  { id: "paint-shelf", room: "art", label: "between the paint pots", x: 37, z: 11.4 },
  { id: "drying-rack", room: "art", label: "on the drying rack", x: 44, z: 16.8 },
];

/** Each question's pieces hide in different rooms, so the class has to spread out. */
export const PIECE_ROOMS: RoomId[] = ["classroom", "library", "lab", "canteen", "gym", "server", "music", "art", "hallway"];

/** How close you must stand to examine something. */
export const EXAMINE_RADIUS = 1.1;
export const PIECES_PER_QUESTION = 3;

/** The closest hiding spot within reach, if any. Used by the client (button) and server (check). */
export function nearestSpot(p: Point): HidingSpot | undefined {
  let best: HidingSpot | undefined;
  let bestDist = EXAMINE_RADIUS;
  for (const s of HIDING_SPOTS) {
    const d = distance(p, s);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}
