import type { ArrangeCard } from "@whtb/shared/types";
import { useEffect, useRef, useState } from "react";
import { terminalLabel } from "../hud/labels";
import { socket } from "../net/socket";
import { closePanel, useGame, type OpenArrange, type OpenQuestion } from "../net/store";

const LETTERS = ["A", "B", "C", "D"];

const OUTCOME_TEXT = {
  correct: { title: "Correct!", line: "Task done.", tone: "good" },
  strike: { title: "Study-Bot lied!", line: "Strike for the class.", tone: "bad" },
  wrong: { title: "Wrong answer", line: "The pieces go back to whoever brought them. Try again later.", tone: "meh" },
} as const;

function Countdown({ endsAt, totalMs, frozen }: { endsAt: number; totalMs: number; frozen: boolean }) {
  const fill = useRef<HTMLDivElement>(null);
  const [secs, setSecs] = useState(Math.ceil((endsAt - performance.now()) / 1000));

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const loop = () => {
      const left = Math.max(0, endsAt - performance.now());
      if (fill.current) fill.current.style.width = `${(left / totalMs) * 100}%`;
      setSecs(Math.ceil(left / 1000));
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, totalMs, frozen]);

  return (
    <div className="countdown">
      <div className="countdown-track">
        <div ref={fill} className={`countdown-fill ${secs <= 5 ? "low" : ""}`} />
      </div>
      <span className="countdown-num">{secs}s</span>
    </div>
  );
}

function BotSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="bot">
      <div className="bot-avatar" aria-hidden>
        🤖
      </div>
      <div className="bot-bubble">
        <span className="bot-name">STUDY-BOT</span>
        {children}
      </div>
    </div>
  );
}

/** Step 1: put your question pieces in order, or let Study-Bot do it. */
function ArrangeStep({ a }: { a: OpenArrange }) {
  const [order, setOrder] = useState<ArrangeCard[]>([]);
  const [sent, setSent] = useState(false);

  // A wrong order comes back from the server: clear the slots and try again.
  useEffect(() => {
    setOrder([]);
    setSent(false);
  }, [a.wrongCount, a.terminalId]);

  const remaining = a.cards.filter((c) => !order.includes(c));
  const full = order.length === 3;

  return (
    <>
      <p className="panel-prompt">Pick 3 pieces and put them in order</p>
      <p className="pool-note">Pool: pieces from everyone standing here ({a.cards.length})</p>
      <div className="slots">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            className={`slot ${order[i] ? "filled" : ""}`}
            disabled={!order[i] || sent}
            onClick={() => setOrder(order.filter((_, k) => k !== i))}
          >
            {order[i]?.text ?? `${i + 1}`}
          </button>
        ))}
      </div>
      {a.wrongCount > 0 && order.length === 0 && <p className="arrange-wrong">That doesn't read right. Try another order.</p>}
      <div className="cards">
        {remaining.map((c) => (
          <button key={c.id} className="card-piece" disabled={sent || full} onClick={() => setOrder([...order, c])}>
            {c.text}
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={!full || sent}
        onClick={() => {
          setSent(true);
          socket.emit("terminal:arrange", { order: order.map((c) => c.id) });
        }}
      >
        Check order
      </button>
      <BotSays>
        <span>Too slow! Want me to arrange it? I never get these wrong.</span>
        <button className="btn small bot-arrange" disabled={sent} onClick={() => socket.emit("terminal:botArrange")}>
          Let Study-Bot arrange it
        </button>
      </BotSays>
    </>
  );
}

/** Step 2: the question, Study-Bot's confident pick, and your answer. */
function AnswerStep({ q }: { q: OpenQuestion }) {
  const role = useGame((s) => s.role);
  const verifyUsed = useGame((s) => s.verifyUsed);
  const [picked, setPicked] = useState<number | undefined>();

  useEffect(() => setPicked(undefined), [q.prompt, q.terminalId]);

  const answered = picked !== undefined || q.outcome !== undefined;
  const result = q.outcome && OUTCOME_TEXT[q.outcome];
  const pieces = q.pieces;

  function answer(i: number) {
    if (answered) return;
    setPicked(i);
    socket.emit("terminal:answer", { choiceIndex: i });
  }

  return (
    <>
      {q.arrangedBy === "studybot" && <p className="arranged-by">Arranged by Study-Bot</p>}
      <p className="panel-prompt">{q.prompt}</p>
      {pieces.length > 0 && (
        <p className="your-pieces">
          Your pieces:{" "}
          {pieces.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </p>
      )}

      <BotSays>
        <span>
          Easy one! The answer is <b>{LETTERS[q.botPick]}: {q.choices[q.botPick]}</b>.
        </span>
        {q.botLine && <span className="bot-line">{q.botLine}</span>}
        {q.botTyping && !q.botLine && (
          <span className="bot-typing" aria-label="Study-Bot is typing">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="bot-confidence">
          Confidence <meter min={0} max={100} value={q.confidence} /> {q.confidence}%
        </span>
        {q.verified !== undefined && <span className={`stamp ${q.verified ? "true" : "false"}`}>{q.verified ? "TRUE" : "FALSE"}</span>}
      </BotSays>

      {q.hint && <p className="hint">🔎 {q.hint}</p>}

      <div className="choices">
        {q.choices.map((c, i) => (
          <button
            key={i}
            className={`choice ${picked === i ? "picked" : ""} ${i === q.botPick ? "bot-pick" : ""}`}
            disabled={answered}
            onClick={() => answer(i)}
          >
            <span className="choice-letter">{LETTERS[i]}</span>
            {c}
          </button>
        ))}
      </div>

      {!answered && (
        <div className="panel-tools">
          <button className="btn small" disabled={Boolean(q.hint)} onClick={() => socket.emit("terminal:doubleCheck")}>
            Double-check (−8s)
          </button>
          {role === "factChecker" && !verifyUsed && (
            <button className="btn small verify" onClick={() => socket.emit("terminal:verify")}>
              Verify (once)
            </button>
          )}
        </div>
      )}

      {result && (
        <div className={`result ${result.tone}`}>
          <b>{result.title}</b>
          <span>{result.line}</span>
          {q.truth && (
            <span className="truth">
              {q.outcome === "strike" ? "The real answer: " : "✓ "}
              <b>{q.truth.answer}</b>. {q.truth.why}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** The kernel: Study-Bot always sounds sure. Arrange it yourself, or trust the shortcut? */
export function TerminalPanel() {
  const arrange = useGame((s) => s.arrange);
  const q = useGame((s) => s.question);
  const open = arrange ?? q;
  const frozen = Boolean(q && q.outcome !== undefined);

  // Esc leaves the terminal on desktop.
  useEffect(() => {
    if (!open || frozen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, frozen]);

  if (!open) return null;

  return (
    <div className="panel-backdrop">
      <div className="panel" role="dialog" aria-label="Study-Bot terminal">
        <div className="panel-top">
          <span className="panel-place">{terminalLabel(open.terminalId)}</span>
          {q && <span className="panel-subject">{q.subject}</span>}
          {!frozen && (
            <button className="panel-leave" onClick={closePanel} aria-label="Leave terminal">
              Leave ✕
            </button>
          )}
        </div>
        <Countdown endsAt={open.endsAt} totalMs={open.totalMs} frozen={frozen} />
        {arrange ? <ArrangeStep a={arrange} /> : q && <AnswerStep q={q} />}
      </div>
    </div>
  );
}
