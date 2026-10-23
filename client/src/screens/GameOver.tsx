import { ROLE_NAMES } from "../hud/labels";
import { leaveRoom, useGame } from "../net/store";

/** Who won, why, and every secret role revealed (prd.md > Win and Game Over). */
export function GameOver() {
  const over = useGame((s) => s.gameOver);
  const players = useGame((s) => s.game?.players ?? []);
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
          {players.map((p) => {
            const role = over.roles[p.id];
            return (
              <li key={p.id} className={role === "bluffer" ? "is-bluffer" : ""}>
                <span className="dot" style={{ background: p.color }} />
                {p.name}
                {p.id === myId && <span className="tag">you</span>}
                <span className={`role-tag role-${role}`}>{role ? ROLE_NAMES[role] : "left"}</span>
              </li>
            );
          })}
        </ul>
        <button className="btn primary" onClick={leaveRoom}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
