import { NAME_MAX_LENGTH } from "@whtb/shared/constants";
import { socket } from "../net/socket";
import { useGame } from "../net/store";

/** Room code from a share link like /?room=ABCD, if any. */
function linkedRoom(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("room");
  return code ? code.toUpperCase() : undefined;
}

export function NameField({ name, setName }: { name: string; setName: (n: string) => void }) {
  return (
    <label className="field">
      <span>Your name</span>
      <input
        id="player-name"
        value={name}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="off"
        placeholder="e.g. Rina"
        onChange={(e) => setName(e.target.value)}
      />
    </label>
  );
}

export function MainMenu({ name, setName }: { name: string; setName: (n: string) => void }) {
  const connected = useGame((s) => s.connected);
  const error = useGame((s) => s.error);
  const setMenuScreen = useGame((s) => s.setMenuScreen);
  const roomFromLink = linkedRoom();
  const ready = connected && name.trim().length > 0;

  return (
    <div className="screen">
      <div className="card">
        <h1 className="title">
          Who Hacked
          <br />
          the Bot?
        </h1>
        <p className="tagline">Study-Bot is always confident. Someone in class made it lie.</p>
        <NameField name={name} setName={setName} />
        {roomFromLink ? (
          <button className="btn primary" disabled={!ready} onClick={() => socket.emit("lobby:join", { code: roomFromLink, name })}>
            Join {roomFromLink}
          </button>
        ) : (
          <>
            <button className="btn primary" disabled={!ready} onClick={() => socket.emit("lobby:create", { name })}>
              Create Lobby
            </button>
            <button className="btn" disabled={!ready} onClick={() => setMenuScreen("join")}>
              Join Friend
            </button>
          </>
        )}
        {error && <p className="error">{error.message}</p>}
      </div>
    </div>
  );
}
