import type { GameError, GameStatePublic, LobbyState } from "@whtb/shared/types";
import { create } from "zustand";
import { applyPositions } from "../game/positions";
import { socket } from "./socket";

export type Screen = "menu" | "join" | "lobby" | "playing";

interface GameStore {
  connected: boolean;
  myId: string | undefined;
  /** Shown on the menu/join/lobby screens until replaced or cleared. */
  error: GameError | undefined;
  lobby: LobbyState | undefined;
  game: GameStatePublic | undefined;
  /** Menu sub-screen picked by the player before they're in a room. */
  menuScreen: "menu" | "join";
  setMenuScreen: (s: "menu" | "join") => void;
  clearError: () => void;
}

export const useGame = create<GameStore>((set) => ({
  connected: socket.connected,
  myId: socket.id,
  error: undefined,
  lobby: undefined,
  game: undefined,
  menuScreen: "menu",
  setMenuScreen: (menuScreen) => set({ menuScreen, error: undefined }),
  clearError: () => set({ error: undefined }),
}));

export function currentScreen(s: GameStore): Screen {
  if (s.game) return "playing";
  if (s.lobby) return "lobby";
  return s.menuScreen;
}

socket.on("connect", () => useGame.setState({ connected: true, myId: socket.id }));
socket.on("disconnect", () =>
  // The server forgets players who disconnect, so drop back to the menu.
  useGame.setState({ connected: false, lobby: undefined, game: undefined }),
);
socket.on("lobby:state", (lobby) => useGame.setState({ lobby, game: undefined, error: undefined }));
socket.on("game:state", (game) => useGame.setState({ game, lobby: undefined }));
socket.on("positions", applyPositions);
socket.on("error", (error) => useGame.setState({ error }));
