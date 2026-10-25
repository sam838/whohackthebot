import { QUICK_FACTS } from "@whtb/shared/quickFacts";
import { useEffect, useMemo, useRef, useState } from "react";
import { keyClick, unlockAudio } from "../audio/typing";
import { AvatarPhoto } from "../avatar/AvatarPhoto";
import { socket } from "../net/socket";
import { closeBook, useGame } from "../net/store";
import { useSecondsLeft } from "./Meeting";
import { hasSeenRole, markRoleSeen } from "./seenRoles";
import { typedCount, typingSchedule } from "./typewriter";
import { terminalPicture } from "./terminalPicture";

/** How long the cover takes to swing open before the facts start typing (ms). */
const COVER_FLIP_MS = 600;
/** The book opens itself: at the start, once it has landed as the school doors part; when reopened, almost at once (ms). */
const AUTO_OPEN_START_MS = 2700;
const AUTO_OPEN_REREAD_MS = 250;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The quick facts, then the win line, typed letter by letter with a key click. `skip` shows it all at once. */
function TypedFacts({ facts, win, startAt, skip, onDone }: { facts: string; win: string; startAt: number; skip: boolean; onDone: () => void }) {
  const full = `${facts}\n${win}`;
  const schedule = useMemo(() => typingSchedule(full), [full]);
  const [shown, setShown] = useState(() => (reduceMotion() ? full.length : 0));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (reduceMotion() || skip) {
      setShown(full.length);
      return void done.current();
    }
    let raf = 0;
    let last = 0;
    const loop = () => {
      const n = typedCount(schedule, performance.now() - startAt);
      if (n > last) {
        // One click per frame is plenty, and skip the silent gaps between words.
        if (full.slice(last, n).trim()) keyClick();
        last = n;
        setShown(n);
      }
      if (n < full.length) raf = requestAnimationFrame(loop);
      else done.current();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [schedule, full, startAt, skip]);

  const factsShown = full.slice(0, Math.min(shown, facts.length));
  const winShown = shown > facts.length + 1 ? full.slice(facts.length + 1, shown) : "";
  const typing = shown < full.length;
  return (
    <div className="book-facts">
      <p>
        {factsShown}
        {typing && !winShown && <span className="caret" aria-hidden />}
      </p>
      {winShown && (
        <p className="book-win">
          <b>How you win: </b>
          {winShown}
          {typing && <span className="caret" aria-hidden />}
        </p>
      )}
    </div>
  );
}

/**
 * Your school book (prd.md > Role Reveal): it opens by itself to show your photo,
 * your secret role, and its quick facts. The first time you get a role the facts type
 * out with a key click; roles you've read before (and rereads) show them at once.
 * At the start of a game (`reread` false) class starts when everyone has closed
 * theirs, or when time runs out; during play you can open it again from the role
 * panel and close it whenever you like.
 */
function RoleBook({ reread }: { reread: boolean }) {
  const game = useGame((s) => s.game)!;
  const role = useGame((s) => s.role)!;
  const myId = useGame((s) => s.myId);
  const [openedAt, setOpenedAt] = useState<number>();
  const [coverGone, setCoverGone] = useState(false);
  const [typed, setTyped] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [ready, setReady] = useState(false);
  // Typed out only the first time this device sees the role, and never on a reread.
  const [instant] = useState(() => reread || hasSeenRole(role));
  const secs = useSecondsLeft(game.phaseMsLeft);

  useEffect(() => {
    const t = setTimeout(
      () => {
        unlockAudio(); // allowed: the player already tapped Start, Join, or Practice
        setOpenedAt((at) => at ?? performance.now());
      },
      reduceMotion() ? 0 : reread ? AUTO_OPEN_REREAD_MS : AUTO_OPEN_START_MS,
    );
    return () => clearTimeout(t);
  }, [reread]);

  useEffect(() => {
    if (openedAt === undefined) return;
    const t = setTimeout(() => setCoverGone(true), reduceMotion() ? 0 : COVER_FLIP_MS);
    return () => clearTimeout(t);
  }, [openedAt]);

  // Esc closes a reread book on desktop.
  useEffect(() => {
    if (!reread) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBook();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reread]);

  const me = game.players.find((p) => p.id === myId);
  // The terminal picture is drawn once and reused (before any early return: hooks run in order).
  const terminalImg = useMemo(terminalPicture, []);
  if (!me) return null;
  const facts = QUICK_FACTS[role];
  const alive = game.players.filter((p) => p.alive).length;

  // Tapping the cover just opens it a moment sooner.
  const open = () => {
    unlockAudio();
    setOpenedAt((at) => at ?? performance.now());
  };
  const doneTyping = () => {
    setTyped(true);
    markRoleSeen(role);
  };
  const goToClass = () => {
    setReady(true);
    socket.emit("reveal:ready");
  };

  const cover = (
    <button className={`book-cover ${openedAt !== undefined ? "flipping" : ""}`} onClick={open} disabled={openedAt !== undefined}>
      <span className="cover-class">CLASS 7A</span>
      <span className="cover-title">Student Handbook</span>
      <span className="cover-name">{me.name}</span>
    </button>
  );

  return (
    <div className="reveal-backdrop" onClick={reread ? (e) => e.target === e.currentTarget && closeBook() : undefined}>
      {/* One book the whole time: closed, it is shifted so the cover sits centered; opening
          slides it into place while the cover swings left, so nothing jumps. */}
      <div className={`book-drop ${reread ? "reread" : ""}`}>
        <div className={`book role-${role} ${openedAt === undefined ? "closed" : "open"}`} role="dialog" aria-label="Your role book">
          <div className="book-page left">
            <div className="book-photo">
              <span className="tape" aria-hidden />
              <AvatarPhoto character={me.character} role={role} />
            </div>
            <div className="book-id">
              <p className="book-name">{me.name}</p>
              <p className="book-class">Class 7A</p>
            </div>
          </div>
          <div className="book-page right">
            <p className="book-label">Your secret role</p>
            <h2 className="book-role">{facts.title}</h2>
            {/* Text already read is in place under the cover; new text starts typing once it's open. */}
            {(coverGone || instant) && (
              <TypedFacts facts={facts.facts} win={facts.win} startAt={(openedAt ?? 0) + COVER_FLIP_MS} skip={skipped || instant} onDone={doneTyping} />
            )}
            {(typed || instant) && (
              <div className="book-terminal">
                {terminalImg && <img src={terminalImg} alt="A Study-Bot terminal" width={96} height={80} />}
                <p>
                  <b>Study-Bot terminal.</b> {facts.terminal}
                </p>
              </div>
            )}
            <div className="book-foot">
              {!typed && !instant && (
                <button className="btn small book-skip" onClick={() => setSkipped(true)}>
                  Skip: show it all
                </button>
              )}
              {reread
                ? typed && (
                    <button className="btn primary" onClick={closeBook}>
                      Close book
                    </button>
                  )
                : typed &&
                  !ready && (
                    <button className="btn primary" onClick={goToClass}>
                      Close book and go to class
                    </button>
                  )}
              {!reread && ready && (
                <p className="book-wait">
                  Waiting for classmates… ({game.readyIds.length}/{alive} ready)
                </p>
              )}
              {!reread && <p className="book-timer">Class starts in {secs}s</p>}
            </div>
          </div>
          {!coverGone && cover}
        </div>
      </div>
    </div>
  );
}

/** Shows the book at the start of a game, and again whenever you reopen it. */
export function RoleReveal() {
  const phase = useGame((s) => s.game?.phase);
  const role = useGame((s) => s.role);
  const bookOpenedAt = useGame((s) => s.bookOpenedAt);
  if (!phase || !role) return null;
  if (phase === "reveal") return <RoleBook key="reveal" reread={false} />;
  if (bookOpenedAt !== undefined) return <RoleBook key={bookOpenedAt} reread />;
  return null;
}
