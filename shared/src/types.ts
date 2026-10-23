// Shapes that travel between server and client.

export type Phase = "lobby" | "playing";

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
}

export interface LobbyState {
  code: string;
  hostId: string;
  players: PublicPlayer[];
}

/** What every player in a started game may know. Never includes roles. */
export interface GameStatePublic {
  phase: Phase;
  players: PublicPlayer[];
}

export interface PlayerPosition {
  x: number;
  z: number;
  heading: number;
}

export type ErrorCode =
  | "NAME_REQUIRED"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ALREADY_STARTED"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS";

export interface GameError {
  code: ErrorCode;
  message: string;
}
