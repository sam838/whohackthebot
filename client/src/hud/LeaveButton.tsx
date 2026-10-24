import { useEffect, useState } from "react";
import { leaveRoom } from "../net/store";

/**
 * Leave the game mid-way. The first tap asks for a second one (for 3 seconds), so a
 * stray tap doesn't throw you out. Leaving counts like a disconnect: your pieces go
 * back where they were found and the class carries on.
 */
export function LeaveButton() {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 3000);
    return () => clearTimeout(t);
  }, [asking]);

  return (
    <button className={`leave-game ${asking ? "asking" : ""}`} onClick={() => (asking ? leaveRoom() : setAsking(true))}>
      {asking ? "Leave? Tap again" : "Leave game"}
    </button>
  );
}
