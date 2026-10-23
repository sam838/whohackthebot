import type {
  AnswerOutcome,
  GameError,
  GameOver,
  GameStatePublic,
  LobbyState,
  Role,
  TerminalQuestion,
} from "@whtb/shared/types";
import { create } from "zustand";
import { applyPositions } from "../game/positions";
import { socket } from "./socket";

export type Screen = "menu" | "join" | "lobby" | "playing";

/** A question open on this player's screen. Times are local (performance.now()). */
export interface OpenQuestion extends TerminalQuestion {
  endsAt: number;
  totalMs: number;
  hint?: string;
  verified?: boolean;
  outcome?: AnswerOutcome;
}

interface GameStore {
  connected: boolean;
  myId: string | undefined;
  /** Shown on screen until replaced or cleared. */
  error: GameError | undefined;
  lobby: LobbyState | undefined;
  game: GameStatePublic | undefined;
  menuScreen: "menu" | "join";
  role: Role | undefined;
  tasks: string[];
  question: OpenQuestion | undefined;
  verifyUsed: boolean;
  /** Terminals this player (the Bluffer) has hacked and nobody has used yet. */
  myHacks: string[];
  hackReadyAt: number;
  gameOver: GameOver | undefined;
  /** Updated by the scene when the local player walks in/out of reach. */
  nearTerminal: string | undefined;
  setMenuScreen: (s: "menu" | "join") => void;
  clearError: () => void;
}

const freshGame = {
  role: undefined,
  tasks: [],
  question: undefined,
  verifyUsed: false,
  myHacks: [],
  hackReadyAt: 0,
  gameOver: undefined,
  nearTerminal: undefined,
};

export const useGame = create<GameStore>((set) => ({
  connected: socket.connected,
  myId: socket.id,
  error: undefined,
  lobby: undefined,
  game: undefined,
  menuScreen: "menu",
  ...freshGame,
  setMenuScreen: (menuScreen) => set({ menuScreen, error: undefined }),
  clearError: () => set({ error: undefined }),
}));

export function currentScreen(s: GameStore): Screen {
  if (s.game) return "playing";
  if (s.lobby) return "lobby";
  return s.menuScreen;
}

let errorTimer: ReturnType<typeof setTimeout> | undefined;

socket.on("connect", () => useGame.setState({ connected: true, myId: socket.id }));
socket.on("disconnect", () =>
  // The server forgets players who disconnect, so drop back to the menu.
  useGame.setState({ connected: false, lobby: undefined, game: undefined, ...freshGame }),
);
socket.on("lobby:state", (lobby) => useGame.setState({ lobby, game: undefined, error: undefined, ...freshGame }));
socket.on("game:state", (game) => useGame.setState({ game, lobby: undefined }));
socket.on("positions", applyPositions);
socket.on("error", (error) => {
  useGame.setState({ error });
  // In-game errors are short toasts; menu errors stay until the next action.
  if (useGame.getState().game) {
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => useGame.setState({ error: undefined }), 2500);
  }
});

socket.on("game:role", ({ role }) => useGame.setState({ role }));
socket.on("game:tasks", ({ terminalIds }) => useGame.setState({ tasks: terminalIds }));
socket.on("terminal:question", (q) =>
  useGame.setState({ question: { ...q, endsAt: performance.now() + q.msLeft, totalMs: q.msLeft } }),
);
socket.on("terminal:hint", ({ hint, msLeft }) => {
  const q = useGame.getState().question;
  if (q) useGame.setState({ question: { ...q, hint, endsAt: performance.now() + msLeft } });
});
socket.on("terminal:verifyResult", ({ botIsRight }) => {
  const q = useGame.getState().question;
  useGame.setState({ verifyUsed: true, question: q && { ...q, verified: botIsRight } });
});
socket.on("terminal:result", ({ outcome }) => {
  const q = useGame.getState().question;
  if (!q) return;
  const shown = { ...q, outcome };
  useGame.setState({ question: shown });
  // Show the result for a moment, then close the panel (unless a new one opened).
  setTimeout(() => {
    if (useGame.getState().question === shown) useGame.setState({ question: undefined });
  }, 1800);
});
socket.on("terminal:hacked", ({ terminalId, cooldownMs }) =>
  useGame.setState((s) => ({ myHacks: [...s.myHacks, terminalId], hackReadyAt: performance.now() + cooldownMs })),
);
socket.on("terminal:hackUsed", ({ terminalId }) =>
  useGame.setState((s) => ({ myHacks: s.myHacks.filter((t) => t !== terminalId) })),
);
socket.on("game:over", (gameOver) => useGame.setState({ gameOver, question: undefined }));
