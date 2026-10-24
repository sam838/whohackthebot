// Simulates real players over Socket.IO against a fresh server on a random port.
// Run with: npm run sim

import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { AiService } from "../src/ai";
import { createApp } from "../src/app";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

function once<T>(socket: Client, event: keyof ServerToClientEvents, match: (v: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), 10000);
    const handler = (v: T) => {
      if (!match(v)) return;
      clearTimeout(timer);
      socket.off(event, handler as never);
      resolve(v);
    };
    socket.on(event, handler as never);
  });
}

function check(ok: boolean, label: string) {
  if (!ok) throw new Error(`FAIL: ${label}`);
  console.log(`  ok  ${label}`);
}

async function main() {
  // Never call the real API from the simulation, even if a key is set on this machine.
  // The role reveal only ends early when everyone is ready, which every game here does.
  const { httpServer, io } = createApp({ ai: new AiService({}), revealMs: 8000 });
  await new Promise<void>((r) => httpServer.listen(0, r));
  const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  const clients: Client[] = [];
  const open = async () => {
    const c: Client = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(c);
    await new Promise<void>((r) => c.on("connect", () => r()));
    return c;
  };

  try {
    console.log("lobby");
    const [host, a, b, c] = await Promise.all([open(), open(), open(), open()]);
    host.emit("lobby:create", { name: "Host", character: "male-c", color: "#5b8def" });
    const created = await once<{ code: string }>(host, "lobby:state");
    check(/^[A-HJ-NP-Z]{4}$/.test(created.code), `room code ${created.code}`);

    const wrong = once<{ code: string }>(a, "error");
    a.emit("lobby:join", { code: "ZZZZ", name: "A", character: "female-a", color: "#f2c14e" });
    check((await wrong).code === "ROOM_NOT_FOUND", "wrong code is rejected");

    const tooEarly = once<{ code: string }>(host, "error");
    host.emit("lobby:start");
    check((await tooEarly).code === "NOT_ENOUGH_PLAYERS", "start blocked with 1 player");

    for (const [s, n] of [[a, "A"], [b, "B"], [c, "C"]] as const) s.emit("lobby:join", { code: created.code, name: n, character: "female-b", color: "#f2c14e" });
    const full = await once<{ players: { character: string; color: string }[] }>(host, "lobby:state", (s) => s.players.length === 4);
    check(full.players.length === 4, "all 4 players in the lobby");
    check(full.players[0].character === "male-c" && full.players[1].character === "female-b", "chosen characters reach everyone");
    check(new Set(full.players.map((p) => p.color)).size === 4, "everyone has a different color even when they asked for the same one");

    console.log("start");
    const players = [host, a, b, c];
    const roleMsgs = new Map<Client, string[]>(players.map((s) => [s, []]));
    for (const s of players) s.on("game:role", ({ role }) => roleMsgs.get(s)!.push(role));
    const started = Promise.all(players.map((s) => once<{ phase: string }>(s, "game:state")));
    host.emit("lobby:start");
    check((await started).every((s) => s.phase === "reveal"), "all 4 open their role books first (phase reveal)");
    host.emit("reveal:ready");
    a.emit("reveal:ready");
    b.emit("reveal:ready");
    const halfReady = await once<{ phase: string; readyIds: string[] }>(c, "game:state", (g) => g.readyIds.length === 3);
    check(halfReady.phase === "reveal", "class waits while someone is still reading");
    const playing = Promise.all(players.map((s) => once<{ phase: string }>(s, "game:state", (g) => g.phase === "playing")));
    c.emit("reveal:ready");
    await playing;
    check(true, "class starts as soon as all 4 are ready");
    await new Promise((r) => setTimeout(r, 200));

    console.log("secret roles");
    check([...roleMsgs.values()].every((list) => list.length === 1), "each client received exactly one role (its own)");
    const roles = [...roleMsgs.values()].map((list) => list[0]);
    check(roles.filter((r) => r === "bluffer").length === 1, "exactly one Bluffer");
    check(roles.filter((r) => r === "factChecker").length === 1, "exactly one Fact-Checker");
    const roleOf = (s: Client) => roleMsgs.get(s)![0];
    const bluffer = players.find((s) => roleOf(s) === "bluffer")!;
    const [student, helper] = players.filter((s) => roleOf(s) !== "bluffer");

    console.log("hidden question pieces");
    const { HIDING_SPOTS } = await import("@whtb/shared/pieces");
    /** Walk up to a hiding spot and examine it; resolves to the piece found, if any. */
    const examine = async (who: Client, spot: (typeof HIDING_SPOTS)[number]) => {
      who.emit("move", { x: spot.x, z: spot.z, heading: 0 });
      await new Promise((r) => setTimeout(r, 60));
      const result = once<{ spotId: string; piece?: { id: string; text: string } }>(who, "spot:result");
      who.emit("spot:examine", { spotId: spot.id });
      return (await result).piece;
    };
    // The helper searches until they find one piece; the student searches everything else.
    let next = 0;
    let helperFound: { id: string; text: string } | undefined;
    while (!helperFound) helperFound = await examine(helper, HIDING_SPOTS[next++]);
    let studentFound = 0;
    let empty = 0;
    for (const spot of HIDING_SPOTS.slice(next)) {
      if (await examine(student, spot)) studentFound++;
      else empty++;
    }
    // 3 classmates × QUESTIONS_PER_CLASSMATE questions × 3 pieces, hidden among more spots than that.
    const { QUESTIONS_PER_CLASSMATE } = await import("@whtb/shared/constants");
    const totalPieces = 3 * QUESTIONS_PER_CLASSMATE * 3;
    check(studentFound + 1 === totalPieces, `examining every hiding spot finds all ${totalPieces} pieces`);
    check(empty > 0, "some hiding spots are empty (\"Nothing here\")");
    check(typeof helperFound.text === "string" && helperFound.text.length > 0, "finding a piece reveals its text to the finder");

    console.log("teamwork at a terminal");
    const { TERMINALS } = await import("@whtb/shared/map");
    const target = TERMINALS[0].id;
    const standAt = { x: TERMINALS[0].x, z: TERMINALS[0].z + 0.9, heading: 0 };
    for (const s of [bluffer, student, helper]) s.emit("move", standAt);
    await new Promise((r) => setTimeout(r, 150));
    const hacked = once<{ terminalId: string }>(bluffer, "terminal:hacked");
    bluffer.emit("terminal:hack", { terminalId: target });
    check((await hacked).terminalId === target, "Bluffer hacked the terminal");

    const arrangeStep = once<{ cards: unknown[] }>(student, "terminal:arrange");
    student.emit("terminal:open", { terminalId: target });
    check((await arrangeStep).cards.length === totalPieces, `the pool includes the helper's piece (${totalPieces - 1} + 1)`);
    const question = once<Record<string, unknown>>(student, "terminal:question");
    student.emit("terminal:botArrange");
    const q = await question;
    check(!("correctIndex" in q) && !("lieIndex" in q) && !("correct" in q), "question carries no correct answer");
    const { QUESTIONS } = await import("@whtb/shared/questions");
    const source = QUESTIONS.find((x) => x.twistedPrompt === q.prompt);
    check(Boolean(source), "hacked Study-Bot arranged a twisted question");
    check(JSON.stringify(q.pieces) === JSON.stringify(source!.pieces), "the real pieces are shown under it");
    const strikeSeen = Promise.all(
      players.map((s) => once<{ strikes: number }>(s, "game:state", (g) => g.strikes === 1)),
    );
    const result = once<{ outcome: string }>(student, "terminal:result");
    student.emit("terminal:answer", { choiceIndex: q.botPick as number });
    check((await result).outcome === "strike", "trusting the hacked answer is a strike");
    await strikeSeen;
    check(true, "all 4 see Strikes: 1");

    const late = await open();
    const lateErr = once<{ code: string }>(late, "error");
    late.emit("lobby:join", { code: created.code, name: "Late", character: "male-a", color: "#f2c14e" });
    check((await lateErr).code === "ALREADY_STARTED", "5th player can't join a started game");

    console.log("movement");
    const seen = once<Record<string, { x: number; z: number }>>(b, "positions", (p) => p[a.id!]?.x === 6 && p[a.id!]?.z === 9);
    a.emit("move", { x: 6, z: 9, heading: 0 });
    const pos = await seen;
    check(pos[a.id!].x === 6, "A's move reaches B in positions");

    console.log("leaving");
    const after = once<{ players: unknown[] }>(b, "game:state", (s) => s.players.length === 3);
    a.disconnect();
    check((await after).players.length === 3, "a disconnect is shown to the others");

    console.log("full games: meetings and voting");
    const { MEETING_BUTTON } = await import("@whtb/shared/map");
    const atButton = { x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 1, heading: 0 };

    /** A fresh 4-player game; returns the clients and their roles. */
    const newGame = async () => {
      const ps = await Promise.all([open(), open(), open(), open()]);
      const roleOfP = new Map<Client, string>();
      ps.forEach((s) => s.on("game:role", ({ role }) => roleOfP.set(s, role)));
      ps[0].emit("lobby:create", { name: "H", character: "male-a", color: "#f2c14e" });
      const { code } = await once<{ code: string }>(ps[0], "lobby:state");
      ps.slice(1).forEach((s, i) => s.emit("lobby:join", { code, name: `P${i}`, character: "female-c", color: "#f2c14e" }));
      await once(ps[0], "lobby:state", (st: { players: unknown[] }) => st.players.length === 4);
      const go = Promise.all(ps.map((s) => once(s, "game:state", (g: { phase: string }) => g.phase === "playing")));
      ps[0].emit("lobby:start");
      await once(ps[0], "game:role");
      ps.forEach((s) => s.emit("reveal:ready"));
      await go;
      await new Promise((r) => setTimeout(r, 150));
      return { ps, roleOfP };
    };
    /** Someone calls a meeting and everyone alive votes for `target`. */
    const meetingVotingFor = async (ps: Client[], caller: Client, target: Client, voters: Client[]) => {
      caller.emit("move", atButton);
      await new Promise((r) => setTimeout(r, 150));
      const meeting = Promise.all(ps.map((s) => once<{ phase: string }>(s, "game:state", (g) => g.phase === "meeting")));
      caller.emit("meeting:call");
      await meeting;
      const chatSeen = once<{ text: string }>(target, "chat:message");
      caller.emit("chat:send", { text: "I saw you near the hacked terminal!" });
      await chatSeen;
      const result = once<{ ejectedId: string | null; wasBluffer: boolean }>(ps[0], "vote:result");
      voters.forEach((v) => v.emit("vote:cast", { targetId: v === target ? null : target.id! }));
      return result;
    };

    {
      const { ps, roleOfP } = await newGame();
      const bl = ps.find((s) => roleOfP.get(s) === "bluffer")!;
      const caller = ps.find((s) => s !== bl)!;
      const overSeen = once<{ winner: string; roles: Record<string, string> }>(ps[1], "game:over");
      const result = await meetingVotingFor(ps, caller, bl, ps);
      check(result.ejectedId === bl.id && result.wasBluffer, "class votes out the Bluffer: result says they WERE the Bluffer");
      const over = await overSeen;
      check(over.winner === "class" && Object.keys(over.roles).length === 4, "game over: class wins, every role revealed");
      ps.forEach((s) => s.disconnect());
    }

    {
      const { ps, roleOfP } = await newGame();
      const bl = ps.find((s) => roleOfP.get(s) === "bluffer")!;
      const innocents = ps.filter((s) => s !== bl);
      let alive = [...ps];
      const r1 = await meetingVotingFor(ps, innocents[0], innocents[1], alive);
      check(r1.ejectedId === innocents[1].id && !r1.wasBluffer, "an innocent is voted out: result says NOT the Bluffer");
      alive = alive.filter((s) => s !== innocents[1]);
      await once(ps[0], "game:respawn");
      check(true, "play resumes and everyone goes back to their seats");
      const overSeen = once<{ winner: string }>(ps[0], "game:over");
      await meetingVotingFor(ps, innocents[2], innocents[0], alive);
      check((await overSeen).winner === "bluffer", "Bluffer wins when only they and one classmate remain");
      ps.forEach((s) => s.disconnect());
    }

    console.log("practice mode");
    {
      const solo = await open();
      const roleSeen = once<{ role: string }>(solo, "game:role");
      const started = once<{ phase: string; players: { name: string }[] }>(solo, "game:state");
      solo.emit("practice:start", { name: "Solo", character: "male-a", color: "#f2c14e", role: "bluffer" });
      const st = await started;
      check(st.phase === "reveal" && st.players.length === 4, "practice opens the role book with 4 players");
      const playing = once<{ phase: string }>(solo, "game:state", (g) => g.phase === "playing");
      solo.emit("reveal:ready");
      await playing;
      check(true, "class starts when the player is ready (bots don't need to be)");
      check(st.players.filter((p) => p.name.endsWith("(bot)")).length === 3, "3 of them are bots");
      check((await roleSeen).role === "bluffer", "the player gets the role they picked");
      const first = await once<Record<string, { x: number; z: number }>>(solo, "positions");
      const moved = await once<Record<string, { x: number; z: number }>>(solo, "positions", (p) =>
        Object.keys(p).some((id) => id.startsWith("bot-") && first[id] && Math.hypot(p[id].x - first[id].x, p[id].z - first[id].z) > 0.5),
      );
      check(Boolean(moved), "bots walk around the school");
      solo.emit("room:leave");
      await new Promise((r) => setTimeout(r, 200));
      const again = once<{ code: string }>(solo, "error");
      solo.emit("lobby:join", { code: "ZZZZ", name: "x", character: "male-a", color: "#f2c14e" });
      check((await again).code === "ROOM_NOT_FOUND", "leaving practice ends it");
      solo.disconnect();
    }

    console.log("\nAll simulation checks passed.");
  } finally {
    clients.forEach((s) => s.disconnect());
    io.close();
    httpServer.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
