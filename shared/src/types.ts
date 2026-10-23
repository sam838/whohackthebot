// Shapes that travel between server and client.

export type Phase = "lobby" | "playing" | "over";

export type Role = "student" | "bluffer" | "factChecker";

export type Winner = "class" | "bluffer";

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  alive: boolean;
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
  strikes: number;
  progress: number;
  goal: number;
}

export interface PlayerPosition {
  x: number;
  z: number;
  heading: number;
}

/** A question as one player sees it. The correct answer stays on the server. */
export interface TerminalQuestion {
  terminalId: string;
  subject: string;
  prompt: string;
  choices: string[];
  /** The option Study-Bot recommends: correct, or the lie if the terminal was hacked. */
  botPick: number;
  /** How sure Study-Bot sounds, 0–100. Always high, whether right or not. */
  confidence: number;
  msLeft: number;
}

export type AnswerOutcome = "correct" | "strike" | "wrong" | "faked";

export interface GameOver {
  winner: Winner;
  reason: string;
  roles: Record<string, Role>;
}

export type ErrorCode =
  | "NAME_REQUIRED"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ALREADY_STARTED"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "TOO_FAR"
  | "NOT_ALLOWED"
  | "NO_TASK_HERE"
  | "COOLDOWN";

export interface GameError {
  code: ErrorCode;
  message: string;
}
