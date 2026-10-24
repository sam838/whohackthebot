import { useEffect, useState } from "react";
import { useGame } from "../net/store";

/** How long the school doors stay on screen before they're gone (ms). */
const INTRO_TOTAL_MS = 2900;

/**
 * Game-start intro: two yellow school doors cover the screen with the logo and
 * a school bell, then slide open while the camera swoops down to your character
 * (see FollowCamera). Plays for VS games and Practice alike.
 */
export function GameIntro() {
  const introAt = useGame((s) => s.introAt);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (introAt === undefined) return;
    setDone(false);
    const t = setTimeout(() => setDone(true), INTRO_TOTAL_MS);
    return () => clearTimeout(t);
  }, [introAt]);

  if (introAt === undefined || done) return null;

  return (
    <div className="intro" aria-live="polite">
      <div className="door left">
        <span className="door-window" />
      </div>
      <div className="door right">
        <span className="door-window" />
      </div>
      <div className="intro-text">
        <span className="bell" aria-hidden>
          🔔
        </span>
        <b>Ding dong!</b>
        <span>Class 7A is starting…</span>
      </div>
    </div>
  );
}
