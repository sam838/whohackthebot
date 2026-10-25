import type { Avatar } from "@whtb/shared/avatars";
import { useCallback, useEffect, useState } from "react";
import { AvatarStage } from "./avatar/AvatarPreview";
import { loadAvatar, saveAvatar } from "./avatar/avatarStorage";
import { GameView } from "./game/GameView";
import { attachKeyboard } from "./game/input";
import { ActionButton } from "./hud/ActionButton";
import { SearchProgress } from "./hud/SearchProgress";
import { GameIntro } from "./screens/GameIntro";
import { LoadingScreen } from "./screens/LoadingScreen";
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
import { amAlive, currentScreen, panelOpen, startSearch, useGame } from "./net/store";
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

/** For hall monitors: why you're out, and what you can still do. */
function SpectatorBanner() {
  const alive = useGame(amAlive);
  const over = useGame((s) => Boolean(s.gameOver));
  const out = useGame((s) => s.game?.players.find((p) => p.id === s.myId)?.out);
  if (alive || over) return null;
  const why = out === "expelled" ? "You were expelled by the Bluffer!" : "You were voted out of class.";
  return (
    <div className="spectator">
      {why} You're a hall monitor now: walk the halls unseen and watch the class. You can't search, vote, chat, or answer.
    </div>
  );
}

function Toast() {
  const error = useGame((s) => s.error);
  const notice = useGame((s) => s.notice);
  const inGame = useGame((s) => Boolean(s.game));
  const text = error?.message ?? notice;
  if (!text || !inGame) return null;
  return <div className="toast">{text}</div>;
}

/** Desktop shortcut: E uses whatever you're standing at: the meeting button, a terminal, or something to examine. */
function useUseKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== "KeyE" && e.code !== "KeyQ") || e.repeat || e.target instanceof HTMLInputElement) return;
      const s = useGame.getState();
      if (panelOpen(s) || s.gameOver || s.game?.phase !== "playing") return;
      // Hall monitors only watch.
      if (!amAlive(s)) return;
      if (e.code === "KeyQ") {
        if (s.role === "bluffer" && s.nearVictim) socket.emit("expel", { targetId: s.nearVictim });
        return;
      }
      if (s.nearButton) socket.emit("meeting:call");
      else if (s.nearTerminal) socket.emit("terminal:open", { terminalId: s.nearTerminal });
      else if (s.nearSpot) startSearch(s.nearSpot);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Downloads every model and font first (screens/LoadingScreen.tsx), then fades into the game. */
export function App() {
  const [started, setStarted] = useState(false);
  const [splash, setSplash] = useState(true);
  const start = useCallback(() => setStarted(true), []);
  const hideSplash = useCallback(() => setSplash(false), []);
  return (
    <>
      {started && <Main />}
      {splash && <LoadingScreen onReady={start} onDone={hideSplash} />}
    </>
  );
}

function Main() {
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
      {/* One live 3D avatar for every menu, set up behind the loading screen (avatar/AvatarPreview.tsx). */}
      <AvatarStage />
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
            {!isTouch && <div className="keys-hint">WASD to walk · E to use or examine</div>}
            {isTouch && <Joystick />}
            <ActionButton />
            <SearchProgress />
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
