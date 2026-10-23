import { useState } from "react";
import { useGame } from "../net/store";
import { ROLE_NAMES, ROLE_REMINDERS, terminalLabel } from "./labels";

/** Your role (temporary until the role book) and your remaining terminals. */
export function TaskList() {
  const role = useGame((s) => s.role);
  const tasks = useGame((s) => s.tasks);
  const [open, setOpen] = useState(true);
  if (!role) return null;

  return (
    <div className={`tasklist role-${role}`}>
      <button className="tasklist-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>You: {ROLE_NAMES[role]}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="tasklist-body">
          <p className="reminder">{ROLE_REMINDERS[role]}</p>
          {role === "bluffer" && <p className="fake-note">Fake tasks, so you look busy:</p>}
          {tasks.length === 0 ? (
            <p className="done">All your tasks are done!</p>
          ) : (
            <ul>
              {tasks.map((t) => (
                <li key={t}>{terminalLabel(t)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
