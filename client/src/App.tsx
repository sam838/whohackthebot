import { useEffect } from "react";
import { GameView } from "./game/GameView";
import { attachKeyboard } from "./game/input";
import { Joystick } from "./hud/Joystick";

const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export function App() {
  useEffect(() => attachKeyboard(), []);

  return (
    <>
      <GameView />
      <div className="hud">
        <div className="hud-hint">{isTouch ? "Drag the stick to walk" : "WASD or arrow keys to walk"}</div>
        {isTouch && <Joystick />}
      </div>
    </>
  );
}
