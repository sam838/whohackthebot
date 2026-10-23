import { useEffect, useState } from "react";
import { socket } from "../net/socket";
import { panelOpen, useGame } from "../net/store";

/** Context buttons: Use (at a terminal) and, for the Bluffer, Hack with its cooldown. */
export function ActionButton() {
  const near = useGame((s) => s.nearTerminal);
  const role = useGame((s) => s.role);
  const hackReadyAt = useGame((s) => s.hackReadyAt);
  const busy = useGame(panelOpen);
  const [now, setNow] = useState(() => performance.now());

  // Re-render once a second only while the hack is cooling down.
  useEffect(() => {
    if (hackReadyAt <= now) return;
    const t = setTimeout(() => setNow(performance.now()), 250);
    return () => clearTimeout(t);
  }, [hackReadyAt, now]);

  if (!near || busy) return null;
  const cooldown = Math.ceil((hackReadyAt - performance.now()) / 1000);

  return (
    <div className="actions">
      {role === "bluffer" && (
        <button
          className="action hack"
          disabled={cooldown > 0}
          onClick={() => socket.emit("terminal:hack", { terminalId: near })}
        >
          {cooldown > 0 ? `Hack ${cooldown}s` : "Hack"}
        </button>
      )}
      <button className="action use" onClick={() => socket.emit("terminal:open", { terminalId: near })}>
        Use
      </button>
    </div>
  );
}
