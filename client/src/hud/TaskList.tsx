import { useState } from "react";
import { useGame } from "../net/store";
import { ROLE_NAMES, ROLE_REMINDERS, terminalLabel } from "./labels";

/** Your role (temporary until the role book) and your tasks with piece counts. */
export function TaskList() {
  const role = useGame((s) => s.role);
  const tasks = useGame((s) => s.tasks);
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
          {isBluffer && <p className="fake-note">You can't see question pieces. Fake these tasks so you look busy:</p>}
          {tasks.length === 0 ? (
            <p className="done">All your tasks are done!</p>
          ) : (
            <ul>
              {tasks.map((t) => {
                const ready = t.found === t.total;
                return (
                  <li key={t.terminalId} className={ready ? "ready" : ""}>
                    {terminalLabel(t.terminalId)}
                    {!isBluffer && (
                      <span className="pieces-count">{ready ? " → go!" : ` · pieces ${t.found}/${t.total}`}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
