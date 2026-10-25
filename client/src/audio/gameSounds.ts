import { socket } from "../net/socket";
import { currentScreen, useGame } from "../net/store";
import { isMuted, setMuted, setMusic, sfx, unlockAudio } from "./sound";

/**
 * Plays the game's sounds and music in step with what happens (App calls this once).
 * Strikes, right answers, meetings, and expels are heard by everyone, so they come
 * from the shared game state; search results and your own wrong answers come from
 * the server's replies to you.
 */
export function attachGameSounds(): () => void {
  // Try to start sound right away: browsers that allow it (a site you visit often, or the
  // autoplay setting) play the music at once; the rest wait for the first tap or key press.
  unlockAudio();
  const unlock = () => unlockAudio();
  // A soft click for every button; M mutes and unmutes.
  const onClick = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("button")) sfx.click();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyM" && !(e.target instanceof HTMLInputElement) && !e.repeat) setMuted(!isMuted());
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey);

  const onSpot = ({ piece }: { piece?: unknown }) => (piece ? sfx.piece() : sfx.nothing());
  const onResult = ({ outcome }: { outcome: string }) => {
    if (outcome === "wrong") sfx.wrong();
  };
  const onVote = () => sfx.reveal();
  const onOver = ({ winner }: { winner: string }) => {
    const role = useGame.getState().role;
    if ((role === "bluffer") === (winner === "bluffer")) sfx.win();
    else sfx.lose();
  };
  socket.on("spot:result", onSpot);
  socket.on("terminal:result", onResult);
  socket.on("vote:result", onVote);
  socket.on("game:over", onOver);

  const expelled = (players: { out?: string }[]) => players.filter((p) => p.out === "expelled").length;
  const unsubscribe = useGame.subscribe((s, prev) => {
    const g = s.game;
    const pg = prev.game;
    if (s.searching && !prev.searching) sfx.rustle();
    if (g && pg) {
      if (g.strikes > pg.strikes) sfx.strike();
      if (g.progress > pg.progress) sfx.correct();
      if (g.phase === "meeting" && pg.phase !== "meeting") sfx.bell();
      if (expelled(g.players) > expelled(pg.players)) sfx.expel();
    }
    if (s.myHacks.length > prev.myHacks.length) sfx.hack();
    // Music: bright in the menus, curious in class, quiet in meetings, silent at Game Over.
    if (s.gameOver) setMusic("off");
    else if (currentScreen(s) !== "playing") setMusic("menu");
    else setMusic(g?.phase === "meeting" || g?.phase === "voteResult" ? "meeting" : "class");
  });
  setMusic("menu");

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey);
    socket.off("spot:result", onSpot);
    socket.off("terminal:result", onResult);
    socket.off("vote:result", onVote);
    socket.off("game:over", onOver);
    unsubscribe();
  };
}
