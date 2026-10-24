import { BLUFFER_MAX_PIECES } from "@whtb/shared/constants";
import { useState } from "react";
import { openBook, panelOpen, useGame } from "../net/store";
import { ROLE_NAMES, ROLE_REMINDERS } from "./labels";

/** A reminder of your role (the role book shows it in full at the start) and the pieces in your bag. */
export function TaskList() {
  const role = useGame((s) => s.role);
  const bag = useGame((s) => s.bag);
  const newPieceId = useGame((s) => s.newPieceId);
  const canOpenBook = useGame((s) => s.game?.phase === "playing" && !panelOpen(s));
  const [open, setOpen] = useState(true);
  if (!role) return null;
  const isBluffer = role === "bluffer";

  return (
    <div className={`tasklist role-${role}`}>
      <button className="tasklist-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>You: {ROLE_NAMES[role]}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="tasklist-body">
          <p className="reminder">{ROLE_REMINDERS[role]}</p>
          <button className="btn small open-book" onClick={openBook} disabled={!canOpenBook}>
            📖 Open your book
          </button>
          <p className="bag-title">
            Your bag ({bag.length}
            {isBluffer ? `/${BLUFFER_MAX_PIECES}` : ""})
          </p>
          {bag.length === 0 ? (
            <p className="empty-bag">Walk up to desks, shelves, posters and more: a glowing ring means you can Examine it for hidden pieces.</p>
          ) : (
            <ul className="bag">
              {bag.map((p) => (
                <li key={p.id} className={p.id === newPieceId ? "new" : undefined}>
                  “{p.text}”{p.id === newPieceId && <span className="new-tag">NEW</span>}
                </li>
              ))}
            </ul>
          )}
          {bag.length > 0 && <p className="team-tip">Meet classmates at a terminal to pool pieces.</p>}
        </div>
      )}
    </div>
  );
}
