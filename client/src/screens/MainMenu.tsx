import type { Avatar } from "@whtb/shared/avatars";
import { AvatarPicker } from "../avatar/AvatarPicker";
import { socket } from "../net/socket";
import { useGame } from "../net/store";

/** Room code from a share link like /?room=ABCD, if any. */
function linkedRoom(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("room");
  return code ? code.toUpperCase() : undefined;
}

export function MainMenu({ avatar, setAvatar }: { avatar: Avatar; setAvatar: (a: Avatar) => void }) {
  const connected = useGame((s) => s.connected);
  const error = useGame((s) => s.error);
  const setMenuScreen = useGame((s) => s.setMenuScreen);
  const roomFromLink = linkedRoom();
  const ready = connected && avatar.name.trim().length > 0;

  return (
    <div className="screen">
      <div className="card">
        <h1 className="title">
          Who Hacked
          <br />
          the Bot?
        </h1>
        <p className="tagline">Study-Bot is always confident. Someone in class made it lie.</p>
        <AvatarPicker avatar={avatar} onChange={setAvatar} />
        {roomFromLink ? (
          <button className="btn primary" disabled={!ready} onClick={() => socket.emit("lobby:join", { code: roomFromLink, ...avatar })}>
            Join {roomFromLink}
          </button>
        ) : (
          <>
            <button className="btn primary" disabled={!ready} onClick={() => socket.emit("lobby:create", avatar)}>
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
