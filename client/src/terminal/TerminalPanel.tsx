import { useEffect, useRef, useState } from "react";
import { socket } from "../net/socket";
import { useGame } from "../net/store";
import { terminalLabel } from "../hud/labels";

const LETTERS = ["A", "B", "C", "D"];

const OUTCOME_TEXT = {
  correct: { title: "Correct!", line: "Task done.", tone: "good" },
  strike: { title: "Study-Bot lied!", line: "Strike for the class.", tone: "bad" },
  wrong: { title: "Wrong answer", line: "This task stays on your list. Try again later.", tone: "meh" },
  faked: { title: "Looking busy…", line: "Nobody saw anything.", tone: "meh" },
} as const;

function Countdown({ endsAt, totalMs, frozen }: { endsAt: number; totalMs: number; frozen: boolean }) {
  const fill = useRef<HTMLDivElement>(null);
  const [secs, setSecs] = useState(Math.ceil(totalMs / 1000));

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

/** The kernel: Study-Bot confidently recommends an answer. Trust it, or check? */
export function TerminalPanel() {
  const q = useGame((s) => s.question);
  const role = useGame((s) => s.role);
  const verifyUsed = useGame((s) => s.verifyUsed);
  const [picked, setPicked] = useState<number | undefined>();

  useEffect(() => setPicked(undefined), [q?.prompt, q?.terminalId]);

  if (!q) return null;
  const answered = picked !== undefined || q.outcome !== undefined;
  const result = q.outcome && OUTCOME_TEXT[q.outcome];

  function answer(i: number) {
    if (answered) return;
    setPicked(i);
    socket.emit("terminal:answer", { choiceIndex: i });
  }

  return (
    <div className="panel-backdrop">
      <div className="panel" role="dialog" aria-label="Study-Bot terminal">
        <div className="panel-top">
          <span className="panel-place">{terminalLabel(q.terminalId)}</span>
          <span className="panel-subject">{q.subject}</span>
        </div>
        <Countdown endsAt={q.endsAt} totalMs={q.totalMs} frozen={answered} />
        <p className="panel-prompt">{q.prompt}</p>

        <div className="bot">
          <div className="bot-avatar" aria-hidden>
            🤖
          </div>
          <div className="bot-bubble">
            <span className="bot-name">STUDY-BOT</span>
            <span>
              Easy one! The answer is <b>{LETTERS[q.botPick]}: {q.choices[q.botPick]}</b>.
            </span>
            <span className="bot-confidence">
              Confidence <meter min={0} max={100} value={q.confidence} /> {q.confidence}%
            </span>
            {q.verified !== undefined && (
              <span className={`stamp ${q.verified ? "true" : "false"}`}>{q.verified ? "TRUE" : "FALSE"}</span>
            )}
          </div>
        </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
