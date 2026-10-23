import { CHAT_MAX_LENGTH } from "@whtb/shared/constants";
import { useEffect, useRef, useState } from "react";
import { socket } from "../net/socket";
import { amAlive, useGame } from "../net/store";

function useSecondsLeft(msLeft: number | undefined): number {
  const [endsAt, setEndsAt] = useState(() => performance.now() + (msLeft ?? 0));
  const [, tick] = useState(0);
  useEffect(() => setEndsAt(performance.now() + (msLeft ?? 0)), [msLeft]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
}

/** Class meeting: argue in chat, then vote someone out or skip (prd.md > Meetings and Voting). */
export function Meeting() {
  const game = useGame((s) => s.game)!;
  const myId = useGame((s) => s.myId);
  const chat = useGame((s) => s.chat);
  const myVote = useGame((s) => s.myVote);
  const alive = useGame(amAlive);
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const secs = useSecondsLeft(game.phaseMsLeft);

  const nameOf = (id: string) => game.players.find((p) => p.id === id);
  const caller = game.meetingCallerId ? nameOf(game.meetingCallerId) : undefined;
  const voted = new Set(game.votedIds);
  const canVote = alive && myVote === undefined;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat.length]);

  function vote(targetId: string | null) {
    if (!canVote) return;
    useGame.setState({ myVote: targetId });
    socket.emit("vote:cast", { targetId });
  }

  return (
    <div className="panel-backdrop meeting-backdrop">
      <div className="panel meeting" role="dialog" aria-label="Class meeting">
        <div className="meeting-head">
          <h2 className="heading">Class meeting!</h2>
          <span className="countdown-num">{secs}s</span>
        </div>
        {caller && <p className="meeting-caller">Called by {caller.name}</p>}

        <div className="chat-log" ref={logRef} aria-live="polite">
          {chat.length === 0 ? (
            <p className="chat-empty">Who hacked Study-Bot? Share what you saw, where you were, and which pieces you found.</p>
          ) : (
            chat.map((m, i) => {
              const p = nameOf(m.fromId);
              return (
                <p key={i} className="chat-line">
                  <b style={{ color: p?.color }}>{p?.name ?? "?"}:</b> {m.text}
                </p>
              );
            })
          )}
        </div>
        {alive ? (
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              socket.emit("chat:send", { text });
              setText("");
            }}
          >
            <input
              id="chat-input"
              value={text}
              maxLength={CHAT_MAX_LENGTH}
              placeholder="I was in the Library when…"
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn small" type="submit">
              Send
            </button>
          </form>
        ) : (
          <p className="chat-empty">You were kicked out, so you can only watch.</p>
        )}

        <p className="label">Vote someone out of school</p>
        <div className="voters">
          {game.players
            .filter((p) => p.alive)
            .map((p) => (
              <button
                key={p.id}
                className={`voter ${myVote === p.id ? "picked" : ""}`}
                disabled={!canVote || p.id === myId}
                onClick={() => vote(p.id)}
              >
                <span className="dot" style={{ background: p.color }} />
                {p.name}
                {p.id === myId && <span className="tag">you</span>}
                {voted.has(p.id) && <span className="voted">voted ✓</span>}
              </button>
            ))}
          <button className={`voter skip ${myVote === null ? "picked" : ""}`} disabled={!canVote} onClick={() => vote(null)}>
            Skip vote
          </button>
        </div>
      </div>
    </div>
  );
}
