// The client↔server contract (spec.md > Socket Events). Socket.IO uses these
// interfaces to type-check every emit and handler on both sides.

import type { GameError, GameStatePublic, LobbyState, PlayerPosition } from "./types";

export interface ClientToServerEvents {
  "lobby:create": (p: { name: string }) => void;
  "lobby:join": (p: { code: string; name: string }) => void;
  "lobby:start": () => void;
  move: (p: PlayerPosition) => void;
}

export interface ServerToClientEvents {
  "lobby:state": (s: LobbyState) => void;
  "game:state": (s: GameStatePublic) => void;
  positions: (p: Record<string, PlayerPosition>) => void;
  error: (e: GameError) => void;
}
