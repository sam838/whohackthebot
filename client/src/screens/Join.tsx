import type { Avatar } from "@whtb/shared/avatars";
import { useState } from "react";
import { socket } from "../net/socket";
import { useGame } from "../net/store";

export function Join({ avatar }: { avatar: Avatar }) {
  const [code, setCode] = useState("");
  const error = useGame((s) => s.error);
  const connected = useGame((s) => s.connected);
  const setMenuScreen = useGame((s) => s.setMenuScreen);

  return (
    <div className="screen">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          socket.emit("lobby:join", { code, ...avatar });
        }}
      >
        <h2 className="heading">Join a friend</h2>
        <label className="field">
          <span>Room code</span>
          <input
            id="room-code"
            className="code-input"
            value={code}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            autoFocus
          />
        </label>
        <button className="btn primary" type="submit" disabled={!connected || code.length !== 4}>
          Join
        </button>
        <button className="btn" type="button" onClick={() => setMenuScreen("menu")}>
          Back
        </button>
        {error && <p className="error">{error.message}</p>}
      </form>
    </div>
  );
}
