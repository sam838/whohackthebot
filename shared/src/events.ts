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
  TerminalQuestion,
  VoteResult,
} from "./types";

export interface ClientToServerEvents {
  "lobby:create": (p: { name: string; character: string; color: string }) => void;
  "lobby:join": (p: { code: string; name: string; character: string; color: string }) => void;
  "lobby:start": () => void;
  move: (p: PlayerPosition) => void;
  "piece:pickup": (p: { pieceId: string }) => void;
  "terminal:open": (p: { terminalId: string }) => void;
  "terminal:arrange": (p: { order: string[] }) => void;
  "terminal:botArrange": () => void;
  /** Walk away from the terminal without answering. */
  "terminal:close": () => void;
  "meeting:call": () => void;
  "chat:send": (p: { text: string }) => void;
  "vote:cast": (p: { targetId: string | null }) => void;
  /** Leave the room and go back to the menu. */
  "room:leave": () => void;
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
  /** The pieces you carry, with their text. */
  "game:bag": (p: { pieces: ArrangeCard[] }) => void;
  "piece:collected": (p: { pieceId: string; text: string }) => void;
  // Everyone: pieces lying on the floor, without their text.
  "pieces:state": (p: { pieces: PieceInfo[] }) => void;
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
  "chat:message": (p: { fromId: string; text: string }) => void;
  "vote:result": (p: VoteResult) => void;
  /** After a meeting everyone goes back to their classroom seat. */
  "game:respawn": (p: { seats: Record<string, { x: number; z: number }> }) => void;
}
