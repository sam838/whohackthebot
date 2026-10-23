import { MIN_PLAYERS } from "@whtb/shared/constants";
import type { LobbyState } from "@whtb/shared/types";
import { useRef, useState } from "react";
import { socket } from "../net/socket";
import { useGame } from "../net/store";

export function Lobby({ lobby }: { lobby: LobbyState }) {
  const myId = useGame((s) => s.myId);
  const error = useGame((s) => s.error);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const link = `${window.location.origin}/?room=${lobby.code}`;
  const isHost = lobby.hostId === myId;
  const missing = Math.max(0, MIN_PLAYERS - lobby.players.length);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      linkRef.current?.select();
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <p className="label">Room code</p>
        <p className="room-code">{lobby.code}</p>
        <div className="share">
          <input id="share-link" ref={linkRef} readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn small" onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="label">
          Players ({lobby.players.length}/5)
        </p>
        <ul className="players">
          {lobby.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              {p.name}
              {p.id === lobby.hostId && <span className="tag">host</span>}
              {p.id === myId && <span className="tag">you</span>}
            </li>
          ))}
        </ul>
        {isHost ? (
          <button className="btn primary" disabled={missing > 0} onClick={() => socket.emit("lobby:start")}>
            {missing > 0 ? `Need ${missing} more player${missing === 1 ? "" : "s"}` : "Start"}
          </button>
        ) : (
          <p className="waiting">Waiting for the host to start…</p>
        )}
        {error && <p className="error">{error.message}</p>}
      </div>
    </div>
  );
}
