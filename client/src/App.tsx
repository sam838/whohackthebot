import { useEffect, useState } from "react";
import { GameView } from "./game/GameView";
import { attachKeyboard } from "./game/input";
import { ActionButton } from "./hud/ActionButton";
import { GameOverNotice } from "./hud/GameOverNotice";
import { Joystick } from "./hud/Joystick";
import { StrikeBar } from "./hud/StrikeBar";
import { TaskList } from "./hud/TaskList";
import { socket } from "./net/socket";
import { currentScreen, useGame } from "./net/store";
import { Join } from "./screens/Join";
import { Lobby } from "./screens/Lobby";
import { MainMenu } from "./screens/MainMenu";
import { TerminalPanel } from "./terminal/TerminalPanel";

const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function ConnectionBanner() {
  const connected = useGame((s) => s.connected);
  if (connected) return null;
  return <div className="banner">Connecting to school… (this can take up to a minute)</div>;
}

function Toast() {
  const error = useGame((s) => s.error);
  const inGame = useGame((s) => Boolean(s.game));
  if (!error || !inGame) return null;
  return <div className="toast">{error.message}</div>;
}

/** Desktop shortcut: E uses the terminal you are standing at (handy for the 4-window demo). */
function useUseKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || e.repeat) return;
      const { nearTerminal, question, gameOver } = useGame.getState();
      if (nearTerminal && !question && !gameOver) socket.emit("terminal:open", { terminalId: nearTerminal });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function App() {
  const screen = useGame(currentScreen);
  const lobby = useGame((s) => s.lobby);
  const game = useGame((s) => s.game);
  const myId = useGame((s) => s.myId);
  const [name, setName] = useState("");

  useEffect(() => attachKeyboard(), []);
  useUseKey();

  return (
    <>
      {screen === "menu" && <MainMenu name={name} setName={setName} />}
      {screen === "join" && <Join name={name} />}
      {screen === "lobby" && lobby && <Lobby lobby={lobby} />}
      {screen === "playing" && game && myId && (
        <>
          <GameView players={game.players} myId={myId} />
          <div className="hud">
            <StrikeBar />
            <TaskList />
            {!isTouch && <div className="keys-hint">WASD to walk · E to use</div>}
            {isTouch && <Joystick />}
            <ActionButton />
          </div>
          <TerminalPanel />
          <GameOverNotice />
          <Toast />
        </>
      )}
      <ConnectionBanner />
    </>
  );
}
