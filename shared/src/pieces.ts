// Where question pieces can lie (prd.md > Question Pieces): free floor points on
// a grid inside each room, skipping anything a player would bump into.

import { buildObstacles } from "./collision";
import { ROOMS, type Point, type RoomId } from "./map";

export interface PieceSpot extends Point {
  room: RoomId;
}

const GRID_STEP = 1.5;
const MARGIN = 1;
const CLEARANCE = 0.5;

function isFree(p: Point): boolean {
  return !buildObstacles().some(
    (b) => p.x + CLEARANCE > b.minX && p.x - CLEARANCE < b.maxX && p.z + CLEARANCE > b.minZ && p.z - CLEARANCE < b.maxZ,
  );
}

export const PIECE_ROOMS: RoomId[] = ["classroom", "library", "lab", "canteen"];

export const PIECE_SPOTS: PieceSpot[] = ROOMS.filter((r) => PIECE_ROOMS.includes(r.id)).flatMap((r) => {
  const spots: PieceSpot[] = [];
  for (let x = r.x + MARGIN; x <= r.x + r.w - MARGIN; x += GRID_STEP) {
    for (let z = r.z + MARGIN; z <= r.z + r.d - MARGIN; z += GRID_STEP) {
      if (isFree({ x, z })) spots.push({ x, z, room: r.id });
    }
  }
  return spots;
});

/** How close you must walk to pick up one of your pieces. */
export const PICKUP_RADIUS = 1;
export const PIECES_PER_QUESTION = 3;
