import type {
  AnswerOutcome,
  ArrangeCard,
  GameError,
  GameOver,
  GameStatePublic,
  LobbyState,
  Role,
  TerminalQuestion,
  Truth,
  VoteResult,
} from "@whtb/shared/types";
import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { create } from "zustand";
import { applyPositions, localPlayer } from "../game/positions";
import { socket } from "./socket";

/** Menu steps before a game: title → your student → mode → VS or Practice (→ join). */
export type MenuScreen = "title" | "avatar" | "mode" | "vs" | "practice" | "join";
export type Screen = MenuScreen | "lobby" | "playing";

/** A question open on this player's screen. Times are local (performance.now()). */
export interface OpenQuestion extends TerminalQuestion {
  endsAt: number;
  totalMs: number;
  hint?: string;
  verified?: boolean;
  /** Study-Bot's explanation, written by Claude (see terminal:botSays). */
  botLine?: string;
  outcome?: AnswerOutcome;
  /** The real answer and why, once the question is settled. */
  truth?: Truth;
}

/** The arrange step: put your question pieces in order (prd.md > Question Pieces). */
export interface OpenArrange {
  terminalId: string;
  cards: ArrangeCard[];
  endsAt: number;
  totalMs: number;
  /** Bumped each time the server says the order was wrong. */
  wrongCount: number;
}

interface GameStore {
  connected: boolean;
  myId: string | undefined;
  /** Shown on screen until replaced or cleared. */
  error: GameError | undefined;
  /** A short in-game message (e.g. "Picked up a piece"). */
  notice: string | undefined;
  lobby: LobbyState | undefined;
  game: GameStatePublic | undefined;
  menuScreen: MenuScreen;
  role: Role | undefined;
  /** Pieces you carry, with their text. */
  bag: ArrangeCard[];
  /** Hiding spots you've examined this game (they look "searched"). */
  searched: string[];
  arrange: OpenArrange | undefined;
  question: OpenQuestion | undefined;
  verifyUsed: boolean;
  /** Terminals this player (the Bluffer) has hacked and nobody has used yet. */
  myHacks: string[];
  hackReadyAt: number;
  /** Bluffer: when Expel is ready again (performance.now() time). */
  expelReadyAt: number;
  /** Bluffer: the classmate close enough to expel, if any. */
  nearVictim: string | undefined;
  gameOver: GameOver | undefined;
  /** Updated by the scene when the local player walks in/out of reach. */
  nearTerminal: string | undefined;
  nearButton: boolean;
  /** The hiding spot you're standing at, if any. */
  nearSpot: string | undefined;
  chat: { fromId: string; text: string }[];
  voteResult: VoteResult | undefined;
  /** Who this player voted for in the current meeting (null = skip). */
  myVote: string | null | undefined;
  /** When the current game appeared on screen (drives the intro animation). */
  introAt: number | undefined;
  /** When you reopened your role book during play (undefined = closed). */
  bookOpenedAt: number | undefined;
  /** The thing you're searching right now (a short pause before the result). */
  searching: { spotId: string; startedAt: number } | undefined;
  /** A piece you just found, highlighted in your bag for a moment. */
  newPieceId: string | undefined;
  setMenuScreen: (s: MenuScreen) => void;
  clearError: () => void;
}

const freshGame = {
  role: undefined,
  bag: [],
  searched: [],
  arrange: undefined,
  question: undefined,
  verifyUsed: false,
  myHacks: [],
  hackReadyAt: 0,
  expelReadyAt: 0,
  nearVictim: undefined,
  gameOver: undefined,
  nearTerminal: undefined,
  nearButton: false,
  nearSpot: undefined,
  notice: undefined,
  chat: [],
  voteResult: undefined,
  myVote: undefined,
  introAt: undefined,
  bookOpenedAt: undefined,
  searching: undefined,
  newPieceId: undefined,
};

export const useGame = create<GameStore>((set) => ({
  connected: socket.connected,
  myId: socket.id,
  error: undefined,
  lobby: undefined,
  game: undefined,
  menuScreen: "title",
  ...freshGame,
  setMenuScreen: (menuScreen) => set({ menuScreen, error: undefined }),
  clearError: () => set({ error: undefined }),
}));

export function currentScreen(s: GameStore): Screen {
  if (s.game) return "playing";
  if (s.lobby) return "lobby";
  return s.menuScreen;
}

export function amAlive(s: Pick<GameStore, "game" | "myId">): boolean {
  return s.game?.players.find((p) => p.id === s.myId)?.alive ?? true;
}

/** Leave the room and go back to the main menu. */
export function leaveRoom() {
  socket.emit("room:leave");
  useGame.setState({ lobby: undefined, game: undefined, menuScreen: "mode", error: undefined, ...freshGame });
  // Drop a share-link room code so the menu shows Create / Join again.
  if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
}

/** Walk away from the terminal panel without answering. */
export function closePanel() {
  socket.emit("terminal:close");
  useGame.setState({ arrange: undefined, question: undefined });
}

/** True while a terminal panel (arranging or answering) is open. */
export function panelOpen(s: Pick<GameStore, "arrange" | "question" | "bookOpenedAt" | "searching">): boolean {
  return Boolean(s.arrange || s.question || s.bookOpenedAt !== undefined || s.searching);
}

/** How long searching something takes before you learn what's there. */
export const SEARCH_MS = 1000;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

/** Examine a hiding spot: stand still for a moment while you search, then ask the server. */
export function startSearch(spotId: string) {
  if (useGame.getState().searching) return;
  useGame.setState({ searching: { spotId, startedAt: performance.now() } });
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    socket.emit("spot:examine", { spotId });
    // If no answer comes back (e.g. a meeting started), stop searching anyway.
    searchTimer = setTimeout(() => useGame.setState({ searching: undefined }), 2000);
  }, SEARCH_MS);
}

let newPieceTimer: ReturnType<typeof setTimeout> | undefined;

/** Read your role book again during play. */
export function openBook() {
  useGame.setState({ bookOpenedAt: performance.now() });
}

export function closeBook() {
  useGame.setState({ bookOpenedAt: undefined });
}

let errorTimer: ReturnType<typeof setTimeout> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(notice: string, ms = 2200) {
  useGame.setState({ notice });
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => useGame.setState({ notice: undefined }), ms);
}

socket.on("connect", () => useGame.setState({ connected: true, myId: socket.id }));
socket.on("disconnect", () =>
  // The server forgets players who disconnect, so drop back to the menu.
  useGame.setState({ connected: false, lobby: undefined, game: undefined, ...freshGame }),
);
socket.on("lobby:state", (lobby) => useGame.setState({ lobby, game: undefined, error: undefined, ...freshGame }));
socket.on("game:state", (game) => {
  const before = useGame.getState().game?.phase;
  // A brand-new game: play the school-bell intro (screens/GameIntro.tsx).
  if (!useGame.getState().game) useGame.setState({ introAt: performance.now() });
  if (game.phase === "meeting" && before !== "meeting") {
    // A meeting starts: terminals close and a fresh discussion begins.
    useGame.setState({ chat: [], myVote: undefined, voteResult: undefined, arrange: undefined, question: undefined, bookOpenedAt: undefined });
  }
  useGame.setState({ game, lobby: undefined });
});
socket.on("chat:message", (m) => useGame.setState((s) => ({ chat: [...s.chat, m] })));
socket.on("vote:result", (voteResult) => useGame.setState({ voteResult }));
socket.on("game:respawn", ({ seats }) => {
  const me = useGame.getState().myId;
  const seat = me ? seats[me] : undefined;
  if (seat) localPlayer.teleport?.(seat.x, seat.z);
});
socket.on("positions", applyPositions);
socket.on("error", (error) => {
  // A refused search (e.g. hands full) ends the search too.
  if (useGame.getState().searching) {
    clearTimeout(searchTimer);
    useGame.setState({ searching: undefined });
  }
  useGame.setState({ error });
  // In-game errors are short toasts; menu errors stay until the next action.
  if (useGame.getState().game) {
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => useGame.setState({ error: undefined }), 2500);
  }
});

socket.on("game:role", ({ role }) => useGame.setState({ role }));
socket.on("game:bag", ({ pieces }) => useGame.setState({ bag: pieces }));
socket.on("spot:result", ({ spotId, piece }) => {
  const where = HIDING_SPOTS.find((s) => s.id === spotId)?.label ?? "here";
  clearTimeout(searchTimer);
  useGame.setState((s) => ({
    searching: undefined,
    searched: s.searched.includes(spotId) ? s.searched : [...s.searched, spotId],
    newPieceId: piece?.id ?? s.newPieceId,
  }));
  showNotice(piece ? `Found “${piece.text}” ${where}! Added to your bag.` : "Nothing here.");
  if (piece) {
    clearTimeout(newPieceTimer);
    newPieceTimer = setTimeout(() => useGame.setState({ newPieceId: undefined }), 3000);
  }
});
socket.on("terminal:arrange", ({ terminalId, cards, msLeft }) =>
  useGame.setState({ arrange: { terminalId, cards, endsAt: performance.now() + msLeft, totalMs: msLeft, wrongCount: 0 } }),
);
socket.on("terminal:arrangeWrong", () =>
  useGame.setState((s) => ({ arrange: s.arrange && { ...s.arrange, wrongCount: s.arrange.wrongCount + 1 } })),
);
socket.on("terminal:question", (q) => {
  const arrange = useGame.getState().arrange;
  // Keep the same countdown bar length if we came from the arrange step.
  const totalMs = arrange?.totalMs ?? q.msLeft;
  useGame.setState({ arrange: undefined, question: { ...q, endsAt: performance.now() + q.msLeft, totalMs } });
});
socket.on("terminal:hint", ({ hint, msLeft }) => {
  const q = useGame.getState().question;
  if (q) useGame.setState({ question: { ...q, hint, endsAt: performance.now() + msLeft } });
});
socket.on("terminal:botSays", ({ terminalId, text }) => {
  const q = useGame.getState().question;
  if (q && q.terminalId === terminalId) useGame.setState({ question: { ...q, botTyping: false, botLine: text ?? undefined } });
});
socket.on("terminal:verifyResult", ({ botIsRight }) => {
  const q = useGame.getState().question;
  useGame.setState({ verifyUsed: true, question: q && { ...q, verified: botIsRight } });
});
socket.on("terminal:result", ({ outcome, truth }) => {
  const q = useGame.getState().question;
  if (!q) {
    // Time ran out while still arranging.
    useGame.setState({ arrange: undefined });
    showNotice("Time's up! Everyone keeps their pieces. Try again.");
    return;
  }
  const shown = { ...q, outcome, truth };
  useGame.setState({ question: shown });
  // Show the result for a moment (longer when there's a truth to read), then close
  // the panel (unless a new one opened).
  setTimeout(() => {
    if (useGame.getState().question === shown) useGame.setState({ question: undefined });
  }, truth ? 4500 : 1800);
});
socket.on("expel:cooldown", ({ msLeft }) => useGame.setState({ expelReadyAt: performance.now() + msLeft }));
socket.on("expel:witnessed", ({ blufferId, victimId }) => {
  const name = (id: string) => useGame.getState().game?.players.find((p) => p.id === id)?.name ?? "Someone";
  showNotice(`👀 You saw ${name(blufferId)} expel ${name(victimId)}!`, 6000);
});
socket.on("terminal:hacked", ({ terminalId, cooldownMs }) =>
  useGame.setState((s) => ({ myHacks: [...s.myHacks, terminalId], hackReadyAt: performance.now() + cooldownMs })),
);
socket.on("terminal:hackUsed", ({ terminalId }) =>
  useGame.setState((s) => ({ myHacks: s.myHacks.filter((t) => t !== terminalId) })),
);
socket.on("game:over", (gameOver) => useGame.setState({ gameOver, question: undefined, arrange: undefined, bookOpenedAt: undefined }));
