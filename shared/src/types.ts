// Shapes that travel between server and client.

export type Phase = "lobby" | "playing" | "meeting" | "voteResult" | "over";

export type Role = "student" | "bluffer" | "factChecker";

export type Winner = "class" | "bluffer";

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  /** Avatar character id (shared/avatars.ts). */
  character: string;
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
  /** Who called the current meeting. */
  meetingCallerId?: string;
  /** Milliseconds left in the meeting or vote-result phase. */
  phaseMsLeft?: number;
  /** Who has voted in this meeting (not for whom). */
  votedIds: string[];
  /** Meetings each player can still call. */
  meetingCallsLeft: Record<string, number>;
}

export interface VoteResult {
  ejectedId: string | null;
  wasBluffer: boolean;
  /** Votes per player id, plus "skip". */
  counts: Record<string, number>;
}

export interface PlayerPosition {
  x: number;
  z: number;
  heading: number;
}

/** A question piece lying on the floor. Its text is only revealed to whoever picks it up. */
export interface PieceInfo {
  id: string;
  x: number;
  z: number;
}

export interface ArrangeCard {
  id: string;
  text: string;
}

/** A question as one player sees it. The correct answer stays on the server. */
export interface TerminalQuestion {
  terminalId: string;
  subject: string;
  /** The real question, or a twisted one if a hacked Study-Bot arranged it. */
  prompt: string;
  arrangedBy: "you" | "studybot" | "none";
  /** The 3 real pieces this question was built from, in order (empty for the Bluffer). */
  pieces: string[];
  choices: string[];
  /** The option Study-Bot recommends: correct, or the lie if the terminal was hacked. */
  botPick: number;
  /** How sure Study-Bot sounds, 0–100. Always high, whether right or not. */
  confidence: number;
  msLeft: number;
  /** True when Claude is writing Study-Bot's explanation (a terminal:botSays follows). */
  botTyping?: boolean;
}

export type AnswerOutcome = "correct" | "strike" | "wrong";

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
  | "COOLDOWN"
  | "HANDS_FULL";

export interface GameError {
  code: ErrorCode;
  message: string;
}
