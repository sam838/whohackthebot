// The client↔server contract (spec.md > Socket Events). Socket.IO uses these
// interfaces to type-check every emit and handler on both sides.

import type {
  AnswerOutcome,
  ArrangeCard,
  GameError,
  GameOver,
  GameStatePublic,
  LobbyState,
  PieceInfo,
  PlayerPosition,
  Role,
  TaskInfo,
  TerminalQuestion,
} from "./types";

export interface ClientToServerEvents {
  "lobby:create": (p: { name: string }) => void;
  "lobby:join": (p: { code: string; name: string }) => void;
  "lobby:start": () => void;
  move: (p: PlayerPosition) => void;
  "piece:pickup": (p: { pieceId: string }) => void;
  "terminal:open": (p: { terminalId: string }) => void;
  "terminal:arrange": (p: { order: string[] }) => void;
  "terminal:botArrange": () => void;
  "terminal:answer": (p: { choiceIndex: number }) => void;
  "terminal:doubleCheck": () => void;
  "terminal:verify": () => void;
  "terminal:hack": (p: { terminalId: string }) => void;
}

export interface ServerToClientEvents {
  "lobby:state": (s: LobbyState) => void;
  "game:state": (s: GameStatePublic) => void;
  positions: (p: Record<string, PlayerPosition>) => void;
  error: (e: GameError) => void;
  // Private: sent only to the player concerned.
  "game:role": (p: { role: Role }) => void;
  "game:tasks": (p: { tasks: TaskInfo[] }) => void;
  /** Non-Bluffers only: uncollected pieces, without their text. */
  "pieces:state": (p: { pieces: PieceInfo[] }) => void;
  "piece:collected": (p: { pieceId: string; terminalId: string; text: string }) => void;
  "terminal:arrange": (p: { terminalId: string; cards: ArrangeCard[]; msLeft: number }) => void;
  "terminal:arrangeWrong": () => void;
  "terminal:question": (q: TerminalQuestion) => void;
  "terminal:hint": (p: { hint: string; msLeft: number }) => void;
  "terminal:verifyResult": (p: { botIsRight: boolean }) => void;
  "terminal:result": (p: { outcome: AnswerOutcome }) => void;
  "terminal:hacked": (p: { terminalId: string; cooldownMs: number }) => void;
  /** To the Bluffer: someone just got your hacked answer. */
  "terminal:hackUsed": (p: { terminalId: string }) => void;
  // Everyone in the room.
  "game:over": (p: GameOver) => void;
}
