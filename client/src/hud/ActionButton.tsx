import { useEffect, useState } from "react";
import { socket } from "../net/socket";
import { amAlive, panelOpen, startSearch, useGame } from "../net/store";

/**
 * Context buttons: Meeting (at the button), Use and Hack (at a terminal), Examine
 * (at a hiding spot), and for the Bluffer, Expel (next to a classmate). Hall
 * monitors (voted out or expelled) only watch.
 */
export function ActionButton() {
  const near = useGame((s) => s.nearTerminal);
  const nearButton = useGame((s) => s.nearButton);
  const nearSpot = useGame((s) => s.nearSpot);
  const nearVictim = useGame((s) => s.nearVictim);
  const searched = useGame((s) => (s.nearSpot ? s.searched.includes(s.nearSpot) : false));
  const alive = useGame(amAlive);
  const playing = useGame((s) => s.game?.phase === "playing");
  const callsLeft = useGame((s) => (s.myId ? (s.game?.meetingCallsLeft[s.myId] ?? 0) : 0));
  const role = useGame((s) => s.role);
  const hackReadyAt = useGame((s) => s.hackReadyAt);
  const expelReadyAt = useGame((s) => s.expelReadyAt);
  const busy = useGame(panelOpen);
  const [now, setNow] = useState(() => performance.now());

  // Re-render a few times a second only while a cooldown is counting down.
  useEffect(() => {
    if (Math.max(hackReadyAt, expelReadyAt) <= now) return;
    const t = setTimeout(() => setNow(performance.now()), 250);
    return () => clearTimeout(t);
  }, [hackReadyAt, expelReadyAt, now]);

  if (busy || !playing) return null;

  const examine = nearSpot && (
    <button className={`action examine ${searched ? "searched" : ""}`} onClick={() => startSearch(nearSpot)}>
      <span className="action-icon" aria-hidden>
        🔍
      </span>
      Examine
    </button>
  );
  // Hall monitors only watch.
  if (!alive) return null;

  const expelWait = Math.ceil((expelReadyAt - performance.now()) / 1000);
  const expel = role === "bluffer" && nearVictim && (
    <button
      className="action expel"
      disabled={expelWait > 0}
      onClick={() => socket.emit("expel", { targetId: nearVictim })}
    >
      {expelWait > 0 ? `Expel ${expelWait}s` : "Expel"}
    </button>
  );

  let main: React.ReactNode = null;
  if (nearButton) {
    main = (
      <button className="action meeting" disabled={callsLeft <= 0} onClick={() => socket.emit("meeting:call")}>
        {callsLeft > 0 ? "Meeting!" : "Used"}
      </button>
    );
  } else if (near) {
    const cooldown = Math.ceil((hackReadyAt - performance.now()) / 1000);
    main = (
      <>
        {role === "bluffer" && (
          <button className="action hack" disabled={cooldown > 0} onClick={() => socket.emit("terminal:hack", { terminalId: near })}>
            {cooldown > 0 ? `Hack ${cooldown}s` : "Hack"}
          </button>
        )}
        <button className="action use" onClick={() => socket.emit("terminal:open", { terminalId: near })}>
          Use
        </button>
      </>
    );
  } else if (examine) {
    main = examine;
  }

  if (!main && !expel) return null;
  return (
    <div className="actions">
      {expel}
      {main}
    </div>
  );
}
