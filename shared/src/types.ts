// Shapes that travel between server and client.

export type Phase = "lobby" | "reveal" | "playing" | "meeting" | "voteResult" | "over";

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
  /** Milliseconds left in the role reveal, meeting, or vote-result phase. */
  phaseMsLeft?: number;
  /** Who has voted in this meeting (not for whom). */
  votedIds: string[];
  /** Who has closed their role book and is ready for class (role reveal only). */
  readyIds: string[];
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

/** The real answer and why, shown once a question is settled (never after a plain wrong answer, which can be retried). */
export interface Truth {
  answer: string;
  why: string;
}

/** One of this game's questions on the Game Over screen: the myth Study-Bot could push, and the truth. */
export interface MythBusted {
  question: string;
  myth: string;
  truth: string;
  why: string;
  solved: boolean;
}

export interface GameOver {
  winner: Winner;
  reason: string;
  roles: Record<string, Role>;
  myths: MythBusted[];
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
