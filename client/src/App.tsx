import type { Avatar } from "@whtb/shared/avatars";
import { useEffect, useState } from "react";
import { loadAvatar, saveAvatar } from "./avatar/avatarStorage";
import { GameView } from "./game/GameView";
import { attachKeyboard } from "./game/input";
import { ActionButton } from "./hud/ActionButton";
import { GameIntro } from "./screens/GameIntro";
import { RoleReveal } from "./screens/RoleReveal";
import { MENU_LINES } from "./screens/MenuBackdrop";
import { TitleBackground } from "./screens/TitleBackground";
import { GameOver } from "./screens/GameOver";
import { Meeting } from "./screens/Meeting";
import { VoteResultScreen } from "./screens/VoteResult";
import { Joystick } from "./hud/Joystick";
import { StrikeBar } from "./hud/StrikeBar";
import { TaskList } from "./hud/TaskList";
import { socket } from "./net/socket";
import { amAlive, currentScreen, panelOpen, useGame } from "./net/store";
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

function SpectatorBanner() {
  const alive = useGame(amAlive);
  const over = useGame((s) => Boolean(s.gameOver));
  if (alive || over) return null;
  return <div className="spectator">You were kicked out of school. Watching the class…</div>;
}

function Toast() {
  const error = useGame((s) => s.error);
  const notice = useGame((s) => s.notice);
  const inGame = useGame((s) => Boolean(s.game));
  const text = error?.message ?? notice;
  if (!text || !inGame) return null;
  return <div className="toast">{text}</div>;
}

/** Desktop shortcut: E uses the terminal you are standing at (handy for the 4-window demo). */
function useUseKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || e.repeat || e.target instanceof HTMLInputElement) return;
      const s = useGame.getState();
      if (panelOpen(s) || s.gameOver || s.game?.phase !== "playing" || !amAlive(s)) return;
      if (s.nearButton) socket.emit("meeting:call");
      else if (s.nearTerminal) socket.emit("terminal:open", { terminalId: s.nearTerminal });
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
  const [avatar, setAvatarState] = useState<Avatar>(loadAvatar);
  const setAvatar = (a: Avatar) => {
    setAvatarState(a);
    saveAvatar(a);
  };

  useEffect(() => attachKeyboard(), []);
  useUseKey();

  const onMenus = screen !== "playing";
  const lines = screen === "title" || screen === "playing" ? undefined : MENU_LINES[screen];

  return (
    <>
      {/* One wallpaper behind the title and every menu, so it never restarts between screens. */}
      {onMenus && (
        <div className="menu-wallpaper">
          <TitleBackground line1={lines?.[0]} line2={lines?.[1]} botOnNarrow={screen === "title"} story={screen === "title"} />
        </div>
      )}
      {(screen === "title" || screen === "avatar" || screen === "mode" || screen === "vs" || screen === "practice") && (
        <MainMenu avatar={avatar} setAvatar={setAvatar} />
      )}
      {screen === "join" && <Join avatar={avatar} />}
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
          <SpectatorBanner />
          <TerminalPanel />
          {game.phase === "meeting" && <Meeting />}
          {game.phase === "voteResult" && <VoteResultScreen />}
          <GameOver />
          <Toast />
          <RoleReveal />
          <GameIntro />
        </>
      )}
      <ConnectionBanner />
    </>
  );
}
