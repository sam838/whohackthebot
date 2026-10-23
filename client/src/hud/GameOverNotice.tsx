import { useGame } from "../net/store";
import { ROLE_NAMES } from "./labels";

/** Temporary result card; slice 4 replaces it with the full Game Over screen. */
export function GameOverNotice() {
  const over = useGame((s) => s.gameOver);
  const players = useGame((s) => s.game?.players ?? []);
  if (!over) return null;

  return (
    <div className="panel-backdrop">
      <div className="panel">
        <h2 className="heading">{over.winner === "class" ? "Class wins!" : "Bluffer wins!"}</h2>
        <p>{over.reason}</p>
        <ul className="players">
          {players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              {p.name}
              <span className="tag">{over.roles[p.id] ? ROLE_NAMES[over.roles[p.id]] : "left"}</span>
            </li>
          ))}
        </ul>
        <button className="btn primary" onClick={() => window.location.assign("/")}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
