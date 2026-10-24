import { STRIKES_TO_LOSE } from "@whtb/shared/constants";
import { useGame } from "../net/store";
import { Minimap } from "./Minimap";

/** Strikes and class progress, always visible to everyone (prd.md > Moving Around the School). */
export function StrikeBar() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const pct = game.goal > 0 ? Math.round((game.progress / game.goal) * 100) : 0;

  return (
    <div className="statusbar">
      <div className="strikes" aria-label={`Strikes: ${game.strikes} of ${STRIKES_TO_LOSE}`}>
        <span className="status-label">Strikes</span>
        {Array.from({ length: STRIKES_TO_LOSE }, (_, i) => (
          <span key={i} className={`strike ${i < game.strikes ? "on" : ""}`}>
            ✕
          </span>
        ))}
      </div>
      <div className="progress" aria-label={`Class progress: ${game.progress} of ${game.goal}`}>
        <span className="status-label">Class</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-num">
          {game.progress}/{game.goal}
        </span>
      </div>
      <Minimap />
    </div>
  );
}
