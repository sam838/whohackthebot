import { useEffect, useState } from "react";
import { GameView } from "./game/GameView";
import { attachKeyboard } from "./game/input";
import { Joystick } from "./hud/Joystick";
import { currentScreen, useGame } from "./net/store";
import { Join } from "./screens/Join";
import { Lobby } from "./screens/Lobby";
import { MainMenu } from "./screens/MainMenu";

const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function ConnectionBanner() {
  const connected = useGame((s) => s.connected);
  if (connected) return null;
  return <div className="banner">Connecting to school… (this can take up to a minute)</div>;
}

export function App() {
  const screen = useGame(currentScreen);
  const lobby = useGame((s) => s.lobby);
  const game = useGame((s) => s.game);
  const myId = useGame((s) => s.myId);
  const [name, setName] = useState("");

  useEffect(() => attachKeyboard(), []);

  return (
    <>
      {screen === "menu" && <MainMenu name={name} setName={setName} />}
      {screen === "join" && <Join name={name} />}
      {screen === "lobby" && lobby && <Lobby lobby={lobby} />}
      {screen === "playing" && game && myId && (
        <>
          <GameView players={game.players} myId={myId} />
          <div className="hud">
            <div className="hud-hint">{isTouch ? "Drag the stick to walk" : "WASD or arrow keys to walk"}</div>
            {isTouch && <Joystick />}
          </div>
        </>
      )}
      <ConnectionBanner />
    </>
  );
}
