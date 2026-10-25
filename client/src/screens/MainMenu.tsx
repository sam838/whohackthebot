import type { Avatar } from "@whtb/shared/avatars";
import type { Role } from "@whtb/shared/types";
import { QUICK_FACTS } from "@whtb/shared/quickFacts";
import { useEffect, useRef, useState } from "react";
import { AvatarPhoto } from "../avatar/AvatarPhoto";
import { AvatarPicker } from "../avatar/AvatarPicker";
import { AvatarPreview } from "../avatar/AvatarPreview";
import { socket } from "../net/socket";
import { useGame, type MenuScreen } from "../net/store";
import { MENU_LINES, MenuBackdrop } from "./MenuBackdrop";
import { BOT_EXIT_MS, sendBotDown, wallpaperCue } from "./TitleBackground";

// Game-style menus, one short step per screen so nothing needs scrolling:
// Title (press start) → Your student → Mode (VS / Practice) → VS or Practice.

const PRACTICE_ROLES: { role: Role | "random"; label: string; line: string }[] = [
  { role: "student", label: "Student", line: "Find pieces, don't trust a lie" },
  { role: "bluffer", label: "Bluffer", line: "Hack Study-Bot, blend in" },
  { role: "factChecker", label: "Fact-Checker", line: "Verify once, stay hidden" },
  { role: "random", label: "Random", line: "Surprise me" },
];

/** Room code from a share link like /?room=ABCD, if any. */
function linkedRoom(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("room");
  return code ? code.toUpperCase() : undefined;
}

interface MenuProps {
  avatar: Avatar;
  setAvatar: (a: Avatar) => void;
}

function Logo({ small }: { small?: boolean }) {
  return (
    <h1 className={`title ${small ? "small" : ""}`}>
      Who Hacked
      <br />
      the Bot?
    </h1>
  );
}

function Back({ to }: { to: MenuScreen }) {
  const go = useGame((s) => s.setMenuScreen);
  return (
    <button className="btn small back" onClick={() => go(to)}>
      ◀ Back
    </button>
  );
}

function TitleScreen({ avatar }: { avatar: Avatar }) {
  const go = useGame((s) => s.setMenuScreen);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  // Returning players with a saved name skip straight to choosing a mode.
  // The title zooms away first, then the next card pops in.
  const next = () => {
    // The title waits behind the loading screen: ignore presses until it has faded in
    // (wallpaperCue.introAt is when the fade began), so a click while loading can't skip it.
    if (!Number.isFinite(wallpaperCue.introAt) || performance.now() - wallpaperCue.introAt < 900) return;
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    // Study-Bot drops down while the title slides away; it comes back up on the menu.
    sendBotDown();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => go(linkedRoom() || !avatar.name.trim() ? "avatar" : "mode"), reduce ? 0 : BOT_EXIT_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`title-screen ${leaving ? "leaving" : ""}`} role="button" tabIndex={0} onClick={next} aria-label="Press anything to continue">
      <span className="title-content">
        <Logo />
        <span className="tagline">Never trust the bot blindly.</span>
        <span className="press-start">PRESS ANYTHING TO CONTINUE</span>
      </span>
    </div>
  );
}

function AvatarStep({ avatar, setAvatar }: MenuProps) {
  const go = useGame((s) => s.setMenuScreen);
  const connected = useGame((s) => s.connected);
  const error = useGame((s) => s.error);
  const room = linkedRoom();
  const ready = avatar.name.trim().length > 0;

  return (
    <div className="card">
      <h2 className="heading">Your student</h2>
      <AvatarPicker avatar={avatar} onChange={setAvatar} />
      {room ? (
        <button className="btn primary" disabled={!ready || !connected} onClick={() => socket.emit("lobby:join", { code: room, ...avatar })}>
          Join {room}
        </button>
      ) : (
        <button className="btn primary" disabled={!ready} onClick={() => go("mode")}>
          {ready ? "Next ▶" : "Type your name"}
        </button>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

function ModeSelect({ avatar }: { avatar: Avatar }) {
  const go = useGame((s) => s.setMenuScreen);
  return (
    <div className="card">
      <Logo small />
      <button className="me-chip" onClick={() => go("avatar")} aria-label="Edit your student">
        <AvatarPreview color={avatar.color} character={avatar.character} />
        <span>
          <b>{avatar.name}</b>
          <small>Edit ✎</small>
        </span>
      </button>
      <button className="mode vs" onClick={() => go("vs")}>
        <b>VS</b>
        <small>Play with friends · 4–5 players</small>
      </button>
      <button className="mode practice" onClick={() => go("practice")}>
        <b>Practice</b>
        <small>Play alone against 3 bots</small>
      </button>
      <button className="btn howto-btn" onClick={() => go("howto")}>
        ❓ How to play
      </button>
    </div>
  );
}

/** The four things you do, each with a real picture from the game. */
const HOWTO_STEPS = [
  { img: "/howto/examine.jpg", title: "Find question pieces.", text: "They hide in desks, shelves, posters and more. A glowing ring means you can Examine it." },
  { img: "/howto/terminal.jpg", title: "Meet at a Study-Bot terminal.", text: "3 pieces make one quiz question. Pieces from everyone standing there count." },
  { img: "/howto/lie.jpg", title: "Trust Study-Bot, or double-check?", text: "It always sounds sure. If someone hacked it, trusting its answer gives the class a strike." },
  { img: "/howto/meeting.jpg", title: "Call a meeting.", text: "Chat, then vote out who you think hacked it. In Practice, the bots read the chat." },
];

const HOWTO_ROLES: Role[] = ["student", "factChecker", "bluffer"];

/** The rules on one big card: the steps with pictures, and a tab per role (like a mini role book). */
function HowToPlay({ avatar }: { avatar: Avatar }) {
  const [role, setRole] = useState<Role>("student");
  const facts = QUICK_FACTS[role];
  return (
    <div className="card howto">
      <h2 className="heading">How to play</h2>
      <div className="howto-body">
        <ol className="howto-steps">
          {HOWTO_STEPS.map((step, i) => (
            <li key={step.title}>
              <img src={step.img} alt="" width={480} height={300} />
              <p>
                <span className="howto-num">{i + 1}</span>
                <b>{step.title}</b> {step.text}
              </p>
            </li>
          ))}
        </ol>
        <section className="howto-side">
          <p className="howto-label">Roles · tap one</p>
          <div className="howto-tabs" role="tablist" aria-label="Roles">
            {HOWTO_ROLES.map((r) => (
              <button key={r} role="tab" aria-selected={r === role} className={`howto-tab role-${r} ${r === role ? "on" : ""}`} onClick={() => setRole(r)}>
                {QUICK_FACTS[r].title}
              </button>
            ))}
          </div>
          <div className={`howto-role role-${role}`} role="tabpanel">
            <div className="howto-role-photo">
              <AvatarPhoto character={avatar.character} role={role} />
            </div>
            <div className="howto-role-text">
              <p>{facts.facts}</p>
              <p>
                <b>How you win:</b> {facts.win}
              </p>
              <p>
                <b>At a terminal:</b> {facts.terminal}
              </p>
            </div>
          </div>
        </section>
      </div>
      <Back to="mode" />
    </div>
  );
}

function VsMenu({ avatar }: { avatar: Avatar }) {
  const go = useGame((s) => s.setMenuScreen);
  const connected = useGame((s) => s.connected);
  const error = useGame((s) => s.error);
  return (
    <div className="card">
      <h2 className="heading">VS</h2>
      <p className="menu-note">One friend creates a lobby and shares the code or link. Everyone else joins.</p>
      <button className="btn primary" disabled={!connected} onClick={() => socket.emit("lobby:create", avatar)}>
        Create Lobby
      </button>
      <button className="btn" disabled={!connected} onClick={() => go("join")}>
        Join Friend
      </button>
      <Back to="mode" />
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

function PracticeMenu({ avatar }: { avatar: Avatar }) {
  const connected = useGame((s) => s.connected);
  const error = useGame((s) => s.error);
  return (
    <div className="card">
      <h2 className="heading">Practice</h2>
      <p className="menu-note">You and 3 bots. Pick your role:</p>
      <div className="role-grid">
        {PRACTICE_ROLES.map((r) => (
          <button
            key={r.role}
            className={`btn role-btn role-${r.role}`}
            disabled={!connected}
            onClick={() => socket.emit("practice:start", { ...avatar, role: r.role })}
          >
            <b>{r.label}</b>
            <small>{r.line}</small>
          </button>
        ))}
      </div>
      <Back to="mode" />
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

/** The menu step for the current screen (the Join screen lives in Join.tsx). */
export function MainMenu({ avatar, setAvatar }: MenuProps) {
  const screen = useGame((s) => s.menuScreen);
  if (screen === "title") return <TitleScreen avatar={avatar} />;
  const lines = MENU_LINES[screen === "join" ? "join" : screen];
  return (
    <MenuBackdrop lines={lines}>
      {screen === "avatar" && <AvatarStep avatar={avatar} setAvatar={setAvatar} />}
      {screen === "mode" && <ModeSelect avatar={avatar} />}
      {screen === "vs" && <VsMenu avatar={avatar} />}
      {screen === "practice" && <PracticeMenu avatar={avatar} />}
      {screen === "howto" && <HowToPlay avatar={avatar} />}
    </MenuBackdrop>
  );
}
