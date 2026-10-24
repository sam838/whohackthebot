import { ROLE_NAMES } from "../hud/labels";
import { leaveRoom, useGame } from "../net/store";

/** Who won, why, and every secret role revealed (prd.md > Win and Game Over). */
export function GameOver() {
  const over = useGame((s) => s.gameOver);
  const roster = useGame((s) => s.roster);
  const myId = useGame((s) => s.myId);
  const myRole = useGame((s) => s.role);
  if (!over) return null;

  const classWon = over.winner === "class";
  const iWon = myRole === "bluffer" ? !classWon : classWon;

  return (
    <div className="panel-backdrop">
      <div className={`panel game-over ${classWon ? "class-won" : "bluffer-won"}`}>
        <p className="label">{iWon ? "You win!" : "You lose"}</p>
        <h2 className="title">{classWon ? "Class wins!" : "Bluffer wins!"}</h2>
        <p className="reason">{over.reason}</p>
        <ul className="players">
          {Object.entries(over.roles).map(([id, role]) => {
            const p = roster[id] ?? { name: "Someone", color: "#9a93ad" };
            return (
              <li key={id} className={role === "bluffer" ? "is-bluffer" : ""}>
                <span className="dot" style={{ background: p.color }} />
                {p.name}
                {id === myId && <span className="tag">you</span>}
                {over.out[id] === "left" && <span className="tag left">left</span>}
                <span className={`role-tag role-${role}`}>{ROLE_NAMES[role]}</span>
              </li>
            );
          })}
        </ul>
        {over.myths.length > 0 && (
          <section className="myths" aria-label="Myths busted">
            <h3>Myths busted</h3>
            <ul>
              {over.myths.map((m) => (
                <li key={m.question}>
                  <span className="myth-q">{m.question}</span>
                  <span className="myth-row">
                    <s className="myth-lie">{m.myth}</s>
                    <span className="myth-truth">✓ {m.truth}</span>
                  </span>
                  <span className="myth-why">{m.why}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button className="btn primary" onClick={leaveRoom}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
