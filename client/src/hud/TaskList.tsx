import { BLUFFER_MAX_PIECES } from "@whtb/shared/constants";
import { useState } from "react";
import { useGame } from "../net/store";
import { ROLE_NAMES, ROLE_REMINDERS } from "./labels";

/** Your role (temporary until the role book) and the pieces in your bag. */
export function TaskList() {
  const role = useGame((s) => s.role);
  const bag = useGame((s) => s.bag);
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
          <p className="bag-title">
            Your bag ({bag.length}
            {isBluffer ? `/${BLUFFER_MAX_PIECES}` : ""})
          </p>
          {bag.length === 0 ? (
            <p className="empty-bag">Walk over paper scraps to pick them up.</p>
          ) : (
            <ul className="bag">
              {bag.map((p) => (
                <li key={p.id}>“{p.text}”</li>
              ))}
            </ul>
          )}
          {bag.length > 0 && <p className="team-tip">Meet classmates at a terminal to pool pieces.</p>}
        </div>
      )}
    </div>
  );
}
