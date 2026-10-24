import { useEffect, useState } from "react";
import { socket } from "../net/socket";
import { amAlive, panelOpen, startSearch, useGame } from "../net/store";

/** Context buttons: Use (at a terminal) and, for the Bluffer, Hack with its cooldown; Meeting; Examine. */
export function ActionButton() {
  const near = useGame((s) => s.nearTerminal);
  const nearButton = useGame((s) => s.nearButton);
  const nearSpot = useGame((s) => s.nearSpot);
  const searched = useGame((s) => (s.nearSpot ? s.searched.includes(s.nearSpot) : false));
  const alive = useGame(amAlive);
  const playing = useGame((s) => s.game?.phase === "playing");
  const callsLeft = useGame((s) => (s.myId ? (s.game?.meetingCallsLeft[s.myId] ?? 0) : 0));
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

  if (busy || !alive || !playing) return null;
  if (nearButton) {
    return (
      <div className="actions">
        <button className="action meeting" disabled={callsLeft <= 0} onClick={() => socket.emit("meeting:call")}>
          {callsLeft > 0 ? "Meeting!" : "Used"}
        </button>
      </div>
    );
  }
  if (!near && nearSpot) {
    return (
      <div className="actions">
        <button className={`action examine ${searched ? "searched" : ""}`} onClick={() => startSearch(nearSpot)}>
          <span className="action-icon" aria-hidden>
            🔍
          </span>
          Examine
        </button>
      </div>
    );
  }
  if (!near) return null;
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
