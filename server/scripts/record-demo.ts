// Records the demo video's raw footage: the real game, played by a script.
// It opens the game in Edge with ?demo (client/src/demo.ts), plays through the
// same inputs a person uses (keys, clicks, typing, the joystick), and saves every
// frame plus a log of what happened when, for cutting (scripts/cut-demo.ts).
// Needs a running server with the built client: npm run build && npm start.
// Usage: npm run demo:record -- <outDir> [url] [full|terminal|factchecker|bluffer|books]
//   full         menus, the three role books, a meeting with the bots, then play to the end
//   terminal     Practice games as a Student until Study-Bot answers at a terminal (ideally a lie)
//   factchecker  as the Fact-Checker: arrange pieces yourself and Verify Study-Bot's answer
//   bluffer      as the Bluffer: hack a terminal, then expel a classmate when Expel is ready
//   books        just the three role books, each held open long enough to read
//   title        the title screen's whole story loop (about 13 s), then the menu
//   roles        the Practice role picker, pointing at each role in turn
//   blufferwin   the Bluffer expels a classmate unseen, blames another in the meeting, and wins

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { distance } from "@whtb/shared/geometry";
import { MEETING_BUTTON, TERMINALS, roomAt, type Point } from "@whtb/shared/map";
import { findPath } from "@whtb/shared/nav";
import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { QUESTIONS } from "@whtb/shared/questions";
import { canSee } from "@whtb/shared/vision";
import { terminalStand } from "../src/bots";

const outDir = resolve(process.argv[2] ?? "demo-recording");
const url = (process.argv[3] ?? "http://localhost:4000/").replace(/\/?$/, "/") + "?demo";
const SCENES = ["full", "terminal", "factchecker", "bluffer", "books", "title", "roles", "blufferwin"] as const;
const scene = SCENES.find((x) => x === process.argv[4]) ?? "full";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const TAG = "edge-demo-recorder";
const WIDTH = 1600;
const HEIGHT = 900;
/** Stop recording after this long, whatever happens. */
const MAX_MS = (process.argv[4] === "factchecker" || process.argv[4] === "blufferwin" ? 25 : 11) * 60_000;

const framesDir = join(outDir, "frames");
const profile = join(outDir, TAG);
rmSync(framesDir, { recursive: true, force: true });
rmSync(join(outDir, "frames.log"), { force: true });
rmSync(join(outDir, "marks.log"), { force: true });
mkdirSync(framesDir, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Talking to the browser (Chrome DevTools Protocol) ---

const edge = spawn(EDGE, [
  // RECORD_HEADED=1 records in a visible window (a hidden one can stop drawing on some machines).
  ...(process.env.RECORD_HEADED ? ["--window-position=0,0", "--new-window"] : ["--headless=new"]),
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  "--no-first-run",
  "--ignore-gpu-blocklist",
  "--autoplay-policy=no-user-gesture-required",
  // Keep drawing even when Windows says the (hidden) window is covered, e.g. by a full-screen app.
  "--disable-features=CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  // Software drawing for the staged scene: the graphics card is busy with OBS/Clipchamp.
  ...(process.env.RECORD_SOFTWARE ? ["--disable-gpu", "--enable-unsafe-swiftshader"] : []),
  "about:blank",
]);

function stopEdge() {
  edge.kill();
  spawnSync("powershell", [
    "-NoProfile",
    "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${TAG}*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }`,
  ]);
}

let pageWs: string | undefined;
for (let i = 0; i < 60 && !pageWs; i++) {
  try {
    const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    pageWs = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // Not up yet.
  }
  if (!pageWs) await sleep(250);
}
if (!pageWs) {
  stopEdge();
  throw new Error("Edge didn't start");
}

const ws = new WebSocket(pageWs);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map<number, (v: any) => void>();
const listeners = new Map<string, ((p: any) => void)[]>();
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id !== undefined && pending.has(m.id)) {
    pending.get(m.id)!(m.result ?? { error: m.error });
    pending.delete(m.id);
  } else if (m.method) for (const fn of listeners.get(m.method) ?? []) fn(m.params);
};
// A request the browser never answers gives up after 15 s (the run carries on) instead of hanging.
const send = (method: string, params: object = {}) =>
  new Promise<any>((r) => {
    const id = ++nextId;
    pending.set(id, r);
    setTimeout(() => {
      if (pending.delete(id)) r({ error: "timeout" });
    }, 15_000);
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch {
      pending.delete(id);
      r({ error: "closed" });
    }
  });
// Keeps Node running while it waits on the browser.
setInterval(() => {}, 1000);
const on = (method: string, fn: (p: any) => void) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);

// --- Recording: every frame the page paints, with its time ---

const frames: { file: string; t: number }[] = [];
let lastFrameAt = Date.now();
on("Page.screencastFrame", (p) => {
  lastFrameAt = Date.now();
  const file = `${String(frames.length).padStart(6, "0")}.jpg`;
  writeFileSync(join(framesDir, file), Buffer.from(p.data, "base64"));
  frames.push({ file, t: p.metadata.timestamp });
  // Also logged as they arrive, so a crash never loses the footage.
  appendFileSync(join(outDir, "frames.log"), `${file} ${p.metadata.timestamp}\n`);
  void send("Page.screencastFrameAck", { sessionId: p.sessionId });
});

/** What happened when (seconds, same clock as the frames), for cutting the video. */
const marks: { t: number; what: string }[] = [];
function mark(what: string) {
  marks.push({ t: Date.now() / 1000, what });
  appendFileSync(join(outDir, "marks.log"), `${Date.now() / 1000} ${what}\n`);
  console.log(`[${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${what}`);
}

// --- Acting like a player ---

interface State {
  menuScreen: string;
  phase?: string;
  myId?: string;
  role?: string;
  alive: boolean;
  bag: { id: string; text: string }[];
  searched: string[];
  arrange: { cards: { id: string; text: string }[]; wrongCount: number } | null;
  question: { prompt: string; choices: string[]; botPick: number; botLine?: string; verified?: boolean; outcome?: unknown } | null;
  nearTerminal?: string;
  nearSpot?: string;
  nearButton: boolean;
  searching: boolean;
  strikes: number;
  progress: number;
  chat: number;
  myVote?: string | null;
  gameOver: boolean;
  meetingCalls: number;
  players: { id: string; name: string; alive: boolean }[];
  myHacks: string[];
  nearVictim?: string;
  expelReady: boolean;
  others: { id: string; x: number; z: number }[];
}

const evaluate = async <T>(expression: string): Promise<T> => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value as T;
const st = () => evaluate<State>("window.__demo?.state()");
const me = () => evaluate<Point | null>("window.__demo?.me()");
const steer = (x: number, z: number) => evaluate(`window.__demo?.steer(${x}, ${z})`);
const exists = (sel: string) => evaluate<boolean>(`!!document.querySelector(${JSON.stringify(sel)})`);
const click = (sel: string) =>
  evaluate<boolean>(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.click(); return true; })()`);

async function waitFor<T>(check: () => Promise<T>, timeoutMs: number, everyMs = 150): Promise<T | undefined> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await check();
    if (v) return v;
    await sleep(everyMs);
  }
  return undefined;
}

const KEYS: Record<string, [string, number]> = { KeyE: ["e", 69], KeyQ: ["q", 81], Enter: ["Enter", 13] };
async function press(code: keyof typeof KEYS) {
  const [key, vk] = KEYS[code];
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, key, windowsVirtualKeyCode: vk });
  await sleep(70);
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode: vk });
}

/** Types into the meeting chat letter by letter, like a person, then sends it. */
async function say(text: string) {
  if (!(await evaluate<boolean>(`(() => { const i = document.querySelector("#chat-input"); if (!i) return false; i.focus(); return true; })()`))) return;
  for (const ch of text) {
    await send("Input.insertText", { text: ch });
    await sleep(28 + Math.random() * 30);
  }
  await sleep(250);
  await click(".chat-form button[type=submit]");
  mark(`said: ${text}`);
}

const inClass = (s: State) => s.phase === "playing" && !s.gameOver && !s.arrange && !s.question;

/** Walks along the game's own paths with the joystick input. Stops early if class pauses (a meeting). */
async function walkTo(target: Point, timeoutMs = 25_000): Promise<boolean> {
  const start = Date.now();
  let p = await me();
  if (!p) return false;
  let path = findPath(p, target);
  let last = p;
  let lastMoveAt = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await st();
    if (!inClass(s)) break;
    p = await me();
    if (!p) break;
    while (path.length && distance(p, path[0]) < 0.3) path.shift();
    if (!path.length) {
      await steer(0, 0);
      return true;
    }
    if (distance(p, last) > 0.05) {
      last = p;
      lastMoveAt = Date.now();
    } else if (Date.now() - lastMoveAt > 900) {
      // Stuck on a corner: plan again from here.
      path = findPath(p, target);
      lastMoveAt = Date.now();
    }
    const next = path[0];
    const d = distance(p, next);
    await steer((next.x - p.x) / d, (next.z - p.z) / d);
    await sleep(35);
  }
  await steer(0, 0);
  return false;
}

/** The pieces of one question found among these cards, in reading order. */
function fullQuestion(cards: { id: string; text: string }[]) {
  for (const q of QUESTIONS) {
    const ids = q.pieces.map((text) => cards.find((c) => c.text === text)?.id);
    if (ids.every(Boolean)) return { q, ids: ids as string[] };
  }
  return undefined;
}

/** Examines the nearest hiding spot not searched yet. */
async function searchNearest(prefer?: (spot: Point) => boolean) {
  const s = await st();
  const p = await me();
  if (!p || !inClass(s)) return;
  const fresh = HIDING_SPOTS.filter((h) => !s.searched.includes(h.id));
  const pool = prefer && fresh.some(prefer) ? fresh.filter(prefer) : fresh;
  const spot = [...pool].sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (!spot) return;
  await walkTo(spot);
  // Step the last bit toward the object until the game says it's in reach.
  const near = await waitFor(async () => {
    const now = await st();
    if (now.nearSpot === spot.id || !inClass(now)) return true;
    const q = await me();
    if (q) {
      const d = distance(q, spot) || 1;
      await steer((spot.x - q.x) / d, (spot.z - q.z) / d);
    }
    return false;
  }, 1500, 60);
  await steer(0, 0);
  if (!near || (await st()).nearSpot !== spot.id) return;
  const before = (await st()).bag.length;
  await press("KeyE");
  await waitFor(async () => !(await st()).searching, 3000);
  const after = (await st()).bag.length;
  mark(after > before ? `found a piece at ${spot.id}` : `searched ${spot.id}`);
  await sleep(after > before ? 900 : 250);
}

/** Uses a terminal: Study-Bot arranges the pieces, you trust its answer. Returns the outcome if a question was answered. */
async function useTerminal(terminalId: string): Promise<string | false> {
  await walkTo(terminalStand(terminalId));
  if (!(await waitFor(async () => (await st()).nearTerminal === terminalId, 1500))) return false;
  await press("KeyE");
  const opened = await waitFor(async () => {
    const s = await st();
    return Boolean(s.arrange || s.question);
  }, 3000);
  if (!opened) return false;
  const s = await st();
  if (s.arrange && !fullQuestion(s.arrange.cards)) {
    mark("terminal: not enough pieces yet");
    await sleep(2200);
    await click(".panel-leave");
    return false;
  }
  if (s.arrange) {
    mark("terminal: pieces pooled, Study-Bot offers to arrange");
    await sleep(2500);
    await click(".bot-arrange");
  }
  const q = await waitFor(async () => (await st()).question, 5000);
  if (!q) {
    await click(".panel-leave");
    return false;
  }
  mark(`terminal: question "${q.prompt}"`);
  // Wait for Study-Bot's (Claude's) explanation, then give the viewer time to read it.
  await waitFor(async () => (await st()).question?.botLine, 8000);
  mark("terminal: Study-Bot explains its answer");
  await sleep(3500);
  await click(".choice.bot-pick");
  mark("terminal: trusted Study-Bot");
  const outcome = await waitFor(async () => (await st()).question?.outcome, 5000);
  mark(`terminal: outcome ${String(outcome)}`);
  await sleep(6500);
  await click(".panel-leave");
  return String(outcome ?? "unknown");
}

const nearestTerminal = (p: Point | null) => (p ? [...TERMINALS].sort((a, b) => distance(p, a) - distance(p, b))[0] : TERMINALS[0]);
const clickText = (sel: string, text: string) =>
  evaluate<boolean>(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => b.textContent.trim().includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`,
  );

/** The Fact-Checker at a terminal: arranges the pieces themselves, Verifies Study-Bot's answer, and picks the real one if it lied. */
async function verifyAtTerminal(terminalId: string): Promise<{ verified: boolean; outcome: string } | false> {
  await walkTo(terminalStand(terminalId));
  if (!(await waitFor(async () => (await st()).nearTerminal === terminalId, 1500))) return false;
  await press("KeyE");
  if (!(await waitFor(async () => Boolean((await st()).arrange || (await st()).question), 3000))) return false;
  const s = await st();
  const full = s.arrange ? fullQuestion(s.arrange.cards) : undefined;
  if (s.arrange && !full) {
    mark("fact-checker: not enough pieces yet");
    await sleep(2200);
    await click(".panel-leave");
    return false;
  }
  if (full) {
    mark("fact-checker: arranges the pieces themselves");
    await sleep(1800);
    for (const text of full.q.pieces) {
      await clickText(".card-piece", text);
      await sleep(800);
    }
    await sleep(600);
    await clickText(".panel .btn.primary", "Check order");
  }
  const q = await waitFor(async () => (await st()).question, 5000);
  if (!q) {
    await click(".panel-leave");
    return false;
  }
  mark(`fact-checker: question "${q.prompt}"`);
  await waitFor(async () => (await st()).question?.botLine, 8000);
  await sleep(3000);
  await click(".verify");
  const v = await waitFor(async () => {
    const verified = (await st()).question?.verified;
    return verified === undefined ? undefined : { verified };
  }, 4000);
  mark(`fact-checker: Verify says ${v?.verified ? "TRUE" : "FALSE"}`);
  await sleep(3000);
  if (v && !v.verified) {
    const base = QUESTIONS.find((x) => x.prompt === q.prompt || x.twistedPrompt === q.prompt);
    if (base) await clickText(".choice", base.choices[base.correctIndex]);
    mark("fact-checker: picks the real answer instead");
  } else {
    await click(".choice.bot-pick");
    mark("fact-checker: goes with the verified answer");
  }
  const outcome = await waitFor(async () => (await st()).question?.outcome, 5000);
  mark(`fact-checker: outcome ${String(outcome)}`);
  await sleep(6500);
  await click(".panel-leave");
  return { verified: Boolean(v?.verified), outcome: String(outcome) };
}

/** Practice games as the Fact-Checker until Verify catches Study-Bot lying (or a few tries). */
async function factCheckerScene() {
  for (let gameNo = 1; gameNo <= 7; gameNo++) {
    mark(`fact-checker scene: game ${gameNo}`);
    await roleBook("factChecker", true, true);
    await sleep(4500);
    const gameStart = Date.now();
    let result: { verified: boolean; outcome: string } | false = false;
    let askedForPieces = false;
    while (!result && Date.now() - gameStart < 7 * 60_000 && Date.now() - startedAt < MAX_MS) {
      const s = await st();
      if (s.gameOver || !s.alive) break;
      if (s.phase === "meeting") {
        await meeting([]);
        continue;
      }
      if (!inClass(s)) {
        await sleep(300);
        continue;
      }
      // With a piece in hand, call a meeting and ask everyone to bring their pieces to the Library terminal
      // (the bots agree and wait there with their pieces, so a full question is likely).
      if (s.bag.length >= 1 && !askedForPieces && s.meetingCalls > 0) {
        askedForPieces = true;
        mark("fact-checker: calling a meeting to gather pieces");
        await walkTo({ x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 0.9 });
        await waitFor(async () => (await st()).nearButton, 1500);
        await press("KeyE");
        if (await waitFor(async () => (await st()).phase === "meeting", 3000)) {
          await meeting(["What pieces do you all have?", "Everyone meet me at the Library terminal after this, bring your pieces!"]);
          if ((await st()).phase === "playing") {
            // Wait in the hallway outside the Library until two classmates stand at its terminal: with
            // witnesses there, the Bluffer won't expel you (it only strikes when nobody is watching).
            await walkTo({ x: 18, z: 9 });
            const lib = TERMINALS.find((x) => x.id === "library-1")!;
            await waitFor(async () => {
              const now = await st();
              if (!inClass(now)) return true;
              const alive = now.others.filter((o) => now.players.find((p) => p.id === o.id)?.alive);
              return alive.filter((o) => distance(o, lib) <= 2.5).length >= 2;
            }, 40_000, 300);
            mark("fact-checker: classmates are at the Library terminal");
            await walkTo(terminalStand("library-1"));
            await sleep(1500);
            result = await verifyAtTerminal("library-1");
          }
        }
        continue;
      }
      if (s.bag.length >= 1) {
        const t = nearestTerminal(await me());
        await walkTo(terminalStand(t.id));
        // Open it once a classmate has walked up with their pieces (bots come to help), not before.
        await waitFor(async () => {
          const now = await st();
          if (!inClass(now)) return true;
          return now.others.some((o) => now.players.find((p) => p.id === o.id)?.alive && distance(o, t) <= 2);
        }, 20_000, 300);
        await sleep(1200);
        result = await verifyAtTerminal(t.id);
        if (!result) for (let i = 0; i < 2; i++) await searchNearest();
      } else {
        await searchNearest();
      }
    }
    mark(`fact-checker scene: game ${gameNo} ${result ? `verified ${result.verified}, ${result.outcome}` : "no verify"}`);
    if ((result && !result.verified) || (result && gameNo >= 4)) return;
    await leaveGame();
  }
}

/** The Bluffer: hacks the nearest terminal, then expels the classmate furthest from everyone else. */
async function blufferScene() {
  for (let gameNo = 1; gameNo <= 3; gameNo++) {
    mark(`bluffer scene: game ${gameNo}`);
    await roleBook("bluffer", true, true);
    await sleep(4500);
    mark("bluffer: sees everyone, even through walls");
    const t = nearestTerminal(await me());
    await walkTo(terminalStand(t.id));
    await waitFor(async () => (await st()).nearTerminal === t.id, 1500);
    await sleep(800);
    if (await click(".action.hack")) mark(`bluffer: hacked ${t.id}`);
    await sleep(3000);
    let expelled = false;
    const huntStart = Date.now();
    while (!expelled && Date.now() - huntStart < 150_000) {
      const s = await st();
      if (s.gameOver || !s.alive) break;
      if (s.phase === "meeting") {
        await meeting([]);
        continue;
      }
      if (!inClass(s)) {
        await sleep(300);
        continue;
      }
      const alive = s.others.filter((o) => s.players.find((p) => p.id === o.id)?.alive);
      if (!alive.length) break;
      const lonely = alive
        .map((o) => ({ o, gap: Math.min(99, ...alive.filter((x) => x !== o).map((x) => distance(x, o))) }))
        .sort((a, b) => b.gap - a.gap)[0].o;
      await walkTo(lonely, 1200);
      const now = await st();
      if (now.nearVictim && now.expelReady && inClass(now)) {
        const name = now.players.find((p) => p.id === now.nearVictim)?.name;
        await press("KeyQ");
        await sleep(400);
        if (!(await st()).players.find((p) => p.id === now.nearVictim)?.alive) {
          mark(`bluffer: expelled ${name}`);
          expelled = true;
        }
      }
    }
    if (expelled) {
      await sleep(4500);
      const m = await waitFor(async () => (await st()).phase === "meeting", 30_000);
      if (m) await meeting(["Wait, what? I was in the Gym the whole time, it wasn't me!"]);
      await sleep(3000);
      return;
    }
    await leaveGame();
  }
}

const plainName = (name: string) => name.replace(/\s*\(bot\)$/, "");

/**
 * The Bluffer wins by lying: expel a classmate nobody else can see, then in the meeting blame
 * another classmate and vote for them. If the class votes out that innocent player, only two
 * are left and the Bluffer wins.
 */
async function blufferWinScene() {
  for (let gameNo = 1; gameNo <= 4; gameNo++) {
    mark(`bluffer win: game ${gameNo}`);
    await roleBook("bluffer", true, true);
    await sleep(4500);
    let victim: { id: string; name: string; room: string } | undefined;
    const huntStart = Date.now();
    while (!victim && Date.now() - huntStart < 150_000) {
      const s = await st();
      if (s.gameOver || !s.alive) break;
      if (s.phase === "meeting") {
        await meeting([]);
        continue;
      }
      if (!inClass(s)) {
        await sleep(300);
        continue;
      }
      const alive = s.others.filter((o) => s.players.find((p) => p.id === o.id)?.alive);
      // A classmate nobody else can see right now.
      const alone = alive.filter((c) => !alive.some((o) => o !== c && canSee(o, c)));
      const p = await me();
      const target = p ? [...alone].sort((a, b) => distance(p, a) - distance(p, b))[0] : undefined;
      if (!target) {
        await sleep(400);
        continue;
      }
      await walkTo(target, 1200);
      const now = await st();
      const t = now.others.find((o) => o.id === target.id);
      const stillAlone = t && !now.others.some((o) => o.id !== t.id && now.players.find((q) => q.id === o.id)?.alive && canSee(o, t));
      if (now.nearVictim === target.id && now.expelReady && stillAlone && inClass(now)) {
        await press("KeyQ");
        await sleep(400);
        const after = await st();
        if (!after.players.find((q) => q.id === target.id)?.alive) {
          const name = plainName(after.players.find((q) => q.id === target.id)?.name ?? "someone");
          victim = { id: target.id, name, room: roomAt(t!)?.name ?? "the hallway" };
          mark(`bluffer win: expelled ${name} unseen`);
        }
      }
    }
    if (victim) {
      await sleep(3000);
      // Someone finds the slip; if not, call the meeting yourself.
      if (!(await waitFor(async () => (await st()).phase === "meeting", 35_000))) {
        mark("bluffer win: calling the meeting");
        await walkTo({ x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 0.9 });
        await waitFor(async () => (await st()).nearButton, 1500);
        await press("KeyE");
        await waitFor(async () => (await st()).phase === "meeting", 3000);
      }
      const s = await st();
      if (s.phase === "meeting") {
        mark("meeting: start");
        const scapegoat = s.players.find((q) => q.alive && q.id !== s.myId);
        await sleep(3000);
        if (scapegoat) {
          const name = plainName(scapegoat.name);
          await say(`I saw ${name} expel ${victim.name} near the ${victim.room}! Vote ${name}!`);
          await sleep(4000);
          await clickText(".voter", name);
          mark(`bluffer win: voted ${name}`);
        }
        const over = await waitFor(async () => (await st()).gameOver, 100_000);
        if (over) {
          mark("bluffer win: game over");
          await sleep(9000);
          return;
        }
      }
    }
    mark(`bluffer win: game ${gameNo} did not end in a win`);
    await leaveGame();
  }
}

/** Back to the menu from anywhere in a game. */
async function leaveGame() {
  if ((await st()).gameOver) {
    await evaluate(`[...document.querySelectorAll(".game-over .btn")].find((b) => b.textContent.includes("Back to menu"))?.click()`);
  } else {
    await click(".leave-game");
    await sleep(300);
    await click(".leave-game");
  }
  await waitFor(async () => (await st()).menuScreen === "mode" && !(await st()).phase, 6000);
  await sleep(800);
}

/** Practice games as a Student until Study-Bot has answered at a terminal, ideally with a lie (a strike). */
async function terminalScene() {
  for (let gameNo = 1; gameNo <= 6; gameNo++) {
    mark(`terminal scene: game ${gameNo}`);
    await roleBook("student", true, true);
    await sleep(4500); // the school doors open
    const gameStart = Date.now();
    const answers: string[] = [];
    while (Date.now() - gameStart < 5 * 60_000 && Date.now() - startedAt < MAX_MS) {
      const s = await st();
      if (s.gameOver || !s.alive) break;
      if (answers.includes("strike") || answers.length >= 3) break;
      if (s.phase === "meeting") {
        await meeting([]);
        continue;
      }
      if (!inClass(s)) {
        await sleep(300);
        continue;
      }
      if (s.bag.length >= 1) {
        // Wait at the nearest terminal for classmates to bring their pieces.
        const p = await me();
        const t = p ? [...TERMINALS].sort((a, b) => distance(p, a) - distance(p, b))[0] : TERMINALS[0];
        await walkTo(terminalStand(t.id));
        await sleep(4000);
        const outcome = await useTerminal(t.id);
        if (outcome) answers.push(outcome);
        else for (let i = 0; i < 2; i++) await searchNearest();
      } else {
        await searchNearest();
      }
    }
    mark(`terminal scene: game ${gameNo} answers ${answers.join(",") || "none"}`);
    if (answers.includes("strike") || (answers.length > 0 && gameNo >= 3)) return;
    await leaveGame();
  }
}

async function roleBook(role: string, keepPlaying: boolean, skipTyping = false, holdMs = 1500) {
  await waitFor(() => exists(".mode.practice"), 8000);
  await click(".mode.practice");
  await waitFor(() => exists(`.role-btn.role-${role}`), 4000);
  await sleep(900);
  mark(`role book: ${role} (start)`);
  await click(`.role-btn.role-${role}`);
  // The book opens by itself and types its text; wait for its button.
  if (skipTyping) {
    await waitFor(() => exists(".book-skip"), 8000);
    await click(".book-skip");
  }
  await waitFor(() => exists(".book .btn.primary"), 25_000);
  await sleep(holdMs);
  mark(`role book: ${role} (end)`);
  await click(".book .btn.primary");
  await waitFor(async () => (await st()).phase === "playing", 20_000);
  if (keepPlaying) return;
  await sleep(1500);
  await click(".leave-game");
  await sleep(300);
  await click(".leave-game");
  await waitFor(async () => (await st()).menuScreen === "mode" && !(await st()).phase, 5000);
  await sleep(800);
}

/** A meeting: say what's in the script, then skip the vote once the bots have had their say. */
async function meeting(lines: string[]) {
  mark("meeting: start");
  await sleep(3000);
  for (const line of lines) {
    await say(line);
    await sleep(7000);
  }
  await waitFor(async () => (await st()).phase !== "meeting", 25_000);
  const s = await st();
  if (s.phase === "meeting" && s.myVote === undefined) {
    await click(".voter.skip");
    mark("meeting: voted skip");
  }
  await waitFor(async () => (await st()).phase === "playing" || (await st()).gameOver, 60_000);
  mark("meeting: over");
}

// --- The run ---

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
// A returning player: saved name and avatar.
await send("Page.navigate", { url });
await sleep(1500);
await evaluate(`localStorage.setItem("whtb.avatar", JSON.stringify({ name: "Valiance", character: "male-b", color: "#f2c14e" }))`);

const startedAt = Date.now();
const SCREENCAST = { format: "jpeg", quality: 72, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 };
await send("Page.startScreencast", SCREENCAST);
// The game always animates (the menu wallpaper, the school), so a pause in frames means the
// browser's screen feed stalled now and then: restart it.
let restarting = false;
const watchdog = setInterval(async () => {
  if (restarting || Date.now() - lastFrameAt < 1500) return;
  restarting = true;
  await send("Page.stopScreencast");
  await send("Page.startScreencast", SCREENCAST);
  lastFrameAt = Date.now();
  restarting = false;
}, 500);
mark("loading");
await send("Page.reload");

try {
  await waitFor(async () => (await exists(".title-screen")) && !(await exists(".loading-screen")), 20_000);
  mark("title");
  // The title acts out the game in a loop (about 13 s); the title scene keeps all of it.
  await sleep(scene === "title" ? 16_000 : 6000);
  await press("Enter");
  mark("menu");
  await sleep(4000);

  if (scene !== "full") {
    if (scene === "terminal") await terminalScene();
    if (scene === "factchecker") await factCheckerScene();
    if (scene === "bluffer") await blufferScene();
    if (scene === "blufferwin") await blufferWinScene();
    if (scene === "title") await sleep(1000);
    if (scene === "roles") {
      await click(".mode.practice");
      await waitFor(() => exists(".role-btn.role-student"), 4000);
      mark("roles: picker shown");
      await sleep(2000);
      // Highlight each role in turn with the keyboard focus ring (simulated mouse moves stall the
      // headless browser's recording; keys don't), like a person reading them.
      for (const role of ["student", "factChecker", "bluffer"]) {
        await evaluate(`document.querySelector(".role-btn.role-${role}")?.focus()`);
        mark(`roles: ${role}`);
        await sleep(2600);
      }
      await evaluate(`document.activeElement?.blur()`);
      mark("roles: done");
      await sleep(1500);
    }
    if (scene === "books") {
      for (const role of ["student", "factChecker", "bluffer"]) await roleBook(role, false, false, 4000);
    }
    throw new Error("done");
  }

  // The three role books (the student's game continues into the main demo).
  await roleBook("factChecker", false);
  await roleBook("bluffer", false);
  await roleBook("student", true);
  mark("class starts");
  await sleep(4500); // the school doors open

  // Search for pieces.
  for (let i = 0; i < 14 && (await st()).bag.length < 2; i++) {
    if ((await st()).phase !== "playing") break;
    await searchNearest();
  }

  // Call a meeting and talk to the bots.
  if ((await st()).phase === "playing") {
    mark("walking to the meeting button");
    await walkTo({ x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 0.9 });
    await waitFor(async () => (await st()).nearButton, 1500);
    await press("KeyE");
    await waitFor(async () => (await st()).phase === "meeting", 3000);
  }
  if ((await st()).phase === "meeting") {
    await meeting(["What pieces do you all have?", "Everyone meet me at the Library terminal after this, bring your pieces!"]);
  }

  // Meet at the Library terminal; the bots bring their pieces.
  let answered = false;
  if ((await st()).phase === "playing") {
    mark("walking to the Library terminal");
    await walkTo(terminalStand("library-1"));
    await sleep(6000);
    for (let tries = 0; tries < 4 && !answered && (await st()).phase === "playing"; tries++) {
      answered = Boolean(await useTerminal("library-1"));
      if (!answered) {
        for (let i = 0; i < 3; i++) await searchNearest();
        await walkTo(terminalStand("library-1"));
        await sleep(3000);
      }
    }
  }

  // Keep playing until the game ends: search, answer full questions, talk in meetings.
  let spokeInMeeting = -1;
  let meetings = 0;
  while (Date.now() - startedAt < MAX_MS) {
    const s = await st();
    if (s.gameOver) break;
    if (s.phase === "meeting") {
      meetings++;
      if (spokeInMeeting !== meetings) {
        spokeInMeeting = meetings;
        const line = s.strikes > 0 ? "Study-Bot just lied to us! Who was near the terminal before that?" : "Did anyone see who was near the terminal?";
        await meeting([line]);
      }
      continue;
    }
    if (!s.alive) {
      await sleep(1000);
      continue;
    }
    if (s.phase === "playing" && inClass(s)) {
      if (fullQuestion(s.bag)) {
        const p = await me();
        const t = p ? [...TERMINALS].sort((a, b) => distance(p, a) - distance(p, b))[0] : TERMINALS[0];
        await useTerminal(t.id);
      } else {
        await searchNearest();
      }
      continue;
    }
    await sleep(500);
  }
  const end = await st();
  mark(end.gameOver ? "game over" : "time limit");
  await sleep(8000);
} catch (err) {
  if ((err as Error).message !== "done") mark(`error: ${(err as Error).message}`);
  else mark("scene finished");
  await sleep(1500);
} finally {
  clearInterval(watchdog);
  await send("Page.stopScreencast");
  await sleep(500);
  writeFileSync(join(outDir, "frames.json"), JSON.stringify(frames));
  writeFileSync(join(outDir, "marks.json"), JSON.stringify(marks, null, 1));
  console.log(`${frames.length} frames over ${((Date.now() - startedAt) / 1000).toFixed(0)} s → ${outDir}`);
  ws.close();
  stopEdge();
  await sleep(800);
  rmSync(profile, { recursive: true, force: true });
  process.exit(0);
}
