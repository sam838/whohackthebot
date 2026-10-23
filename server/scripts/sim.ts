// Simulates real players over Socket.IO against a fresh server on a random port.
// Run with: npm run sim

import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { createApp } from "../src/app";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

function once<T>(socket: Client, event: keyof ServerToClientEvents, match: (v: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), 3000);
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
  const { httpServer, io } = createApp();
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
    host.emit("lobby:create", { name: "Host" });
    const created = await once<{ code: string }>(host, "lobby:state");
    check(/^[A-HJ-NP-Z]{4}$/.test(created.code), `room code ${created.code}`);

    const wrong = once<{ code: string }>(a, "error");
    a.emit("lobby:join", { code: "ZZZZ", name: "A" });
    check((await wrong).code === "ROOM_NOT_FOUND", "wrong code is rejected");

    const tooEarly = once<{ code: string }>(host, "error");
    host.emit("lobby:start");
    check((await tooEarly).code === "NOT_ENOUGH_PLAYERS", "start blocked with 1 player");

    for (const [s, n] of [[a, "A"], [b, "B"], [c, "C"]] as const) s.emit("lobby:join", { code: created.code, name: n });
    const full = await once<{ players: unknown[] }>(host, "lobby:state", (s) => s.players.length === 4);
    check(full.players.length === 4, "all 4 players in the lobby");

    console.log("start");
    const players = [host, a, b, c];
    const roleMsgs = new Map<Client, string[]>(players.map((s) => [s, []]));
    const taskMsgs = new Map<Client, string[]>();
    const pieceMsgs = new Map<Client, Array<Record<string, unknown>>>(players.map((s) => [s, []]));
    for (const s of players) {
      s.on("game:role", ({ role }) => roleMsgs.get(s)!.push(role));
      s.on("game:tasks", ({ tasks }) => taskMsgs.set(s, tasks.map((t) => t.terminalId)));
      s.on("pieces:state", ({ pieces }) => pieceMsgs.set(s, pieces as unknown as Array<Record<string, unknown>>));
    }
    const started = Promise.all(players.map((s) => once<{ phase: string }>(s, "game:state")));
    host.emit("lobby:start");
    check((await started).every((s) => s.phase === "playing"), "all 4 receive game:state playing");
    await new Promise((r) => setTimeout(r, 200));

    console.log("secret roles");
    check([...roleMsgs.values()].every((list) => list.length === 1), "each client received exactly one role (its own)");
    const roles = [...roleMsgs.values()].map((list) => list[0]);
    check(roles.filter((r) => r === "bluffer").length === 1, "exactly one Bluffer");
    check(roles.filter((r) => r === "factChecker").length === 1, "exactly one Fact-Checker");
    const roleOf = (s: Client) => roleMsgs.get(s)![0];
    const bluffer = players.find((s) => roleOf(s) === "bluffer")!;
    const student = players.find((s) => roleOf(s) === "student")!;

    console.log("question pieces");
    check(pieceMsgs.get(bluffer)!.length === 0, "the Bluffer received no piece positions");
    const seenPieces = pieceMsgs.get(student)!;
    // 3 classmates × 3 tasks × 3 pieces.
    check(seenPieces.length === 27 && seenPieces.every((p) => !("text" in p)), "students see all 27 pieces, with no text");
    const target = taskMsgs.get(student)![0];
    const mine = seenPieces.filter((p) => String(p.id).startsWith(`${student.id}:${target}:`));
    check(mine.length === 3, "the student's first task has 3 pieces to find");
    for (const p of mine) {
      student.emit("move", { x: p.x as number, z: p.z as number, heading: 0 });
      await new Promise((r) => setTimeout(r, 120));
      const got = once<{ pieceId: string }>(student, "piece:collected");
      student.emit("piece:pickup", { pieceId: String(p.id) });
      await got;
    }
    check(true, "picked up all 3 pieces by walking onto them");

    console.log("Study-Bot lies");
    const { TERMINALS } = await import("@whtb/shared/map");
    const spot = TERMINALS.find((t) => t.id === target)!;
    const standAt = { x: spot.x, z: spot.z + 0.9, heading: 0 };
    bluffer.emit("move", standAt);
    student.emit("move", standAt);
    await new Promise((r) => setTimeout(r, 150));
    const hacked = once<{ terminalId: string }>(bluffer, "terminal:hacked");
    bluffer.emit("terminal:hack", { terminalId: target });
    check((await hacked).terminalId === target, "Bluffer hacked the student's terminal");

    const arrangeStep = once<{ cards: unknown[] }>(student, "terminal:arrange");
    student.emit("terminal:open", { terminalId: target });
    check((await arrangeStep).cards.length === 3, "terminal opens to the arrange step");
    const question = once<Record<string, unknown>>(student, "terminal:question");
    student.emit("terminal:botArrange");
    const q = await question;
    check(!("correctIndex" in q) && !("lieIndex" in q) && !("correct" in q), "question carries no correct answer");
    const { QUESTIONS } = await import("@whtb/shared/questions");
    check(QUESTIONS.some((x) => x.twistedPrompt === q.prompt), "hacked Study-Bot arranged a twisted question");
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
    late.emit("lobby:join", { code: created.code, name: "Late" });
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
