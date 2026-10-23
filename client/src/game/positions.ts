import type { PlayerPosition } from "@whtb/shared/types";

// Latest positions from the server, kept outside React state: socket messages
// write here ~12 times a second, and each remote character reads it every frame.
export const remotePositions = new Map<string, PlayerPosition>();

/** Set by the local player's movement hook; used to put them back on their seat after a meeting. */
export const localPlayer: { teleport?: (x: number, z: number) => void } = {};

export function applyPositions(all: Record<string, PlayerPosition>) {
  for (const [id, pos] of Object.entries(all)) remotePositions.set(id, pos);
  for (const id of remotePositions.keys()) if (!(id in all)) remotePositions.delete(id);
}
