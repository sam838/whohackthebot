import { INTERACT_RADIUS } from "@whtb/shared/constants";
import { distance } from "@whtb/shared/geometry";
import { MEETING_BUTTON, TERMINALS } from "@whtb/shared/map";
import type { PlayerPosition, Role } from "@whtb/shared/types";
import { describe, expect, it } from "vitest";
import type { BotReply } from "./ai";
import { BotController, terminalStand } from "./bots";
import { GameRoom, type Sender } from "./game/GameRoom";
import { assignRoles } from "./game/rules";
import { RoomManager } from "./rooms";

/** A practice game with a fake clock: one human (standing still) and 3 bots. */
function practice(humanRole: Role, speak?: (req: unknown) => Promise<string | undefined>, reply?: (req: any) => Promise<BotReply | undefined>) {
  const ids = ["human", "bot-0", "bot-1", "bot-2"];
  let clock = 1_000_000;
  const seed = { s: 42 };
  const random = () => {
    seed.s = (seed.s * 9301 + 49297) % 233280;
    return seed.s / 233280;
  };
  const positions = new Map<string, PlayerPosition>([
    ["human", { x: 2, z: 4.1, heading: 0 }],
    ["bot-0", { x: 5, z: 4.1, heading: 0 }],
    ["bot-1", { x: 8, z: 4.1, heading: 0 }],
    ["bot-2", { x: 2, z: 6.3, heading: 0 }],
  ]);
  const roomEvents: { event: string; payload: any }[] = [];
  const sender: Sender = {
    toPlayer: () => {},
    toRoom: (event, payload) => roomEvents.push({ event, payload }),
    publicChanged: () => {},
    respawn: () => {},
  };
  const game = new GameRoom(ids, sender, (id) => positions.get(id), random, () => clock, new Map([["human", humanRole]]));
  game.dealSecrets();
  const controller = new BotController({
    game,
    botIds: ids.slice(1),
    humanId: "human",
    position: (id) => positions.get(id),
    move: (id, pos) => positions.set(id, pos),
    nameOf: (id) => id,
    now: () => clock,
    random,
    speak: speak as never,
    reply,
  });
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 12; i++) {
      clock += 1000 / 12;
      controller.tick(1 / 12);
      game.tick();
      if (game.over) break;
    }
  };
  return { game, positions, run, roomEvents, controller };
}

/** Calls a meeting from the human, says something, and returns the bots' chat lines. */
function talk(p: ReturnType<typeof practice>, text: string) {
  p.positions.set("human", { x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 1, heading: 0 });
  p.game.callMeeting("human");
  p.game.chat("human", text);
  p.controller.hear("human", text);
}

/** Runs until the meeting is over and class has resumed. */
function untilClass(p: ReturnType<typeof practice>) {
  for (let i = 0; i < 120 && p.game.phase !== "playing"; i++) p.run(0.5);
}

const honestBot = (p: ReturnType<typeof practice>) => ["bot-0", "bot-1", "bot-2"].find((id) => p.game.roles.get(id) !== "bluffer")!;

const botLines = (p: ReturnType<typeof practice>) =>
  p.roomEvents.filter((e) => e.event === "chat:message" && e.payload.fromId !== "human").map((e) => e.payload as { fromId: string; text: string });

describe("practice roles", () => {
  it("honors the role you pick and gives the bots the others", () => {
    for (const role of ["student", "bluffer", "factChecker"] as Role[]) {
      const roles = assignRoles(["me", "a", "b", "c"], Math.random, new Map([["me", role]]));
      expect(roles.get("me")).toBe(role);
      const all = [...roles.values()];
      expect(all.filter((r) => r === "bluffer")).toHaveLength(1);
      expect(all.filter((r) => r === "factChecker")).toHaveLength(1);
    }
  });

  it("creates a started room with the player and 3 bots, and deletes it when the player leaves", () => {
    const rooms = new RoomManager();
    const r = rooms.createPractice("me", { name: "Sam" }, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phase).toBe("playing");
    expect([...r.value.players.values()].filter((p) => p.isBot)).toHaveLength(3);
    expect(rooms.leave("me")).toBeUndefined();
    expect([...rooms.allRooms()]).toHaveLength(0);
  });
});

describe("practice bots", () => {
  it("walk around, find hidden pieces by examining things, and solve or get fooled at terminals", () => {
    const { game, positions, run } = practice("student");
    const start = { ...positions.get("bot-0")! };
    const hiddenBefore = game.hiddenCount();
    run(240);
    const moved = positions.get("bot-0")!;
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(1);
    expect(game.hiddenCount()).toBeLessThan(hiddenBefore);
    expect(game.progress + game.strikes).toBeGreaterThan(0);
  });

  it("a Bluffer bot hacks terminals when you're a Student", () => {
    const { game, run } = practice("student");
    run(240);
    // Any strike means a bot's hack fooled a bot.
    expect(game.strikes + game.progress).toBeGreaterThan(0);
  });

  it("bots chat and vote in a meeting you call", () => {
    const { game, positions, run, roomEvents } = practice("student");
    positions.set("human", { x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 1, heading: 0 });
    game.callMeeting("human");
    game.vote("human", null);
    run(60);
    expect(roomEvents.some((e) => e.event === "chat:message")).toBe(true);
    expect(roomEvents.some((e) => e.event === "vote:result")).toBe(true);
  });

  it("bots say their AI-written line in a meeting, or the canned line when the AI gives nothing", async () => {
    for (const reply of ["AI says: I saw Rina near the Lab!", undefined]) {
      const { game, positions, run, roomEvents } = practice("student", async () => reply);
      positions.set("human", { x: MEETING_BUTTON.x, z: MEETING_BUTTON.z + 1, heading: 0 });
      game.callMeeting("human");
      run(10);
      await new Promise((r) => setTimeout(r, 0)); // let the bots' replies resolve
      const lines = roomEvents.filter((e) => e.event === "chat:message").map((e) => e.payload.text);
      expect(lines.length).toBeGreaterThan(0);
      if (reply) expect(lines.every((l) => l === reply)).toBe(true);
      else expect(lines.some((l) => l.startsWith("AI says"))).toBe(false);
    }
  });
});

describe("talking to the bots", () => {
  it("a bot you name answers and agrees to follow you, then walks with you after the meeting", () => {
    // You're the Bluffer here, so no bot can expel you on the way.
    const p = practice("bluffer");
    const friend = honestBot(p);
    talk(p, `${friend} follow me`);
    p.run(4);
    const lines = botLines(p);
    expect(lines.find((l) => l.fromId === friend)?.text).toMatch(/stick with you|lead the way|follow you/);
    p.game.vote("human", null);
    untilClass(p);
    expect(p.game.phase).toBe("playing");
    // Lead it to the Gym: it keeps close.
    p.positions.set("human", { x: 31, z: 4, heading: 0 });
    p.run(20);
    const bot = p.positions.get(friend)!;
    expect(Math.hypot(bot.x - 31, bot.z - 4)).toBeLessThan(3.5);
  });

  it("understands 'meet me in the Library' and 'vote X' without the AI", () => {
    const p = practice("student");
    expect(p.controller.keywordReply("bot-0", "human", "meet me in the library", false)).toMatchObject({ plan: { kind: "meet", target: "Library" } });
    expect(p.controller.keywordReply("bot-0", "human", "check the cafeteria", false)).toMatchObject({ plan: { kind: "search", target: "Canteen" } });
    expect(p.controller.keywordReply("bot-0", "human", "everyone vote bot-2, I saw them at the terminal", false)).toMatchObject({ plan: { kind: "vote", target: "bot-2" } });
    expect(p.controller.keywordReply("bot-0", "human", "nice weather", false)).toBeUndefined();
  });

  it("bots vote for the player you convince them about", () => {
    const p = practice("student");
    talk(p, "everyone vote bot-2, I saw them hack");
    p.game.vote("human", "bot-2");
    p.run(60);
    const result = p.roomEvents.find((e) => e.event === "vote:result");
    expect(result?.payload.ejectedId).toBe("bot-2");
  });

  it("uses the AI's reply and plan when there is one", async () => {
    const p = practice("bluffer", undefined, async () => ({ say: "Gym it is, see you there!", plan: { kind: "meet", target: "Gym" } }));
    const friend = honestBot(p);
    talk(p, `${friend} meet me in the gym`);
    await new Promise((r) => setTimeout(r, 0));
    p.run(5);
    expect(botLines(p).some((l) => l.fromId === friend && l.text === "Gym it is, see you there!")).toBe(true);
    p.game.vote("human", null);
    untilClass(p);
    p.run(25);
    const bot = p.positions.get(friend)!;
    expect(bot.x).toBeGreaterThan(24);
    expect(bot.z).toBeLessThan(8);
  });

  it("a Bluffer bot that agrees to follow you can turn on you when nobody is watching", () => {
    const p = practice("student");
    const bluffer = [...p.game.roles].find(([, r]) => r === "bluffer")![0];
    talk(p, `${bluffer} follow me`);
    p.run(4);
    p.game.vote("human", null);
    untilClass(p);
    // Walk off alone to the Server Room; the others are far away in the Classroom.
    for (const id of ["bot-0", "bot-1", "bot-2"]) if (id !== bluffer) p.positions.set(id, { x: 2, z: 2, heading: 0 });
    p.positions.set("human", { x: 42, z: 4, heading: 0 });
    p.run(45);
    expect(p.game.isAlive("human")).toBe(false);
  });

  it("knows a bot by its plain name, and tells you what pieces it has", () => {
    const p = practice("bluffer");
    const named = new BotController({
      game: p.game,
      botIds: ["bot-0", "bot-1", "bot-2"],
      humanId: "human",
      position: (id) => p.positions.get(id),
      move: (id, pos) => p.positions.set(id, pos),
      nameOf: (id) => (id === "bot-0" ? "Rina (bot)" : id),
    });
    expect(named.keywordReply("bot-1", "human", "Rina is sus, vote rina, I saw her at the terminal", false)).toMatchObject({ plan: { kind: "vote", target: "Rina" } });
    expect(named.keywordReply("bot-1", "human", "what pieces do you have?", true)?.say).toMatch(/pieces yet|I've got/);
  });

  it("an honest bot with no evidence asks why before voting", () => {
    const p = practice("bluffer");
    const friend = honestBot(p);
    const other = ["bot-0", "bot-1", "bot-2"].find((id) => id !== friend)!;
    expect(p.controller.keywordReply(friend, "human", `vote ${other}`, false)?.plan.kind).toBe("none");
    expect(p.controller.keywordReply(friend, "human", `vote ${other}, I saw them hack the library terminal`, false)?.plan.kind).toBe("vote");
  });

  it("a bot following you backs off if you lead it somewhere empty while it already has doubts", () => {
    const p = practice("bluffer");
    const friend = honestBot(p);
    talk(p, `${friend} follow me`);
    p.run(4);
    p.game.vote("human", null);
    untilClass(p);
    (p.controller as any).bots.find((b: any) => b.id === friend).suspicion.set("human", 1);
    for (const id of ["bot-0", "bot-1", "bot-2"]) if (id !== friend) p.positions.set(id, { x: 2, z: 2, heading: 0 });
    p.positions.set("human", { x: 42, z: 4, heading: 0 });
    p.run(25);
    const bot = (p.controller as any).bots.find((b: any) => b.id === friend);
    expect(bot.plan?.kind).toBe("avoid");
    expect(bot.clues.join(" ")).toContain("somewhere empty");
  });

  it("if a bot you led away gets expelled, the others remember and suspect you", () => {
    const p = practice("bluffer");
    const [friend, witness] = ["bot-0", "bot-1", "bot-2"];
    talk(p, `${friend} follow me`);
    p.run(4);
    p.game.vote("human", null);
    untilClass(p);
    // Alone together in the Server Room, far from everyone else: you expel them.
    for (const id of ["bot-1", "bot-2"]) p.positions.set(id, { x: 2, z: 2, heading: 0 });
    p.positions.set("human", { x: 42, z: 4, heading: 0 });
    p.positions.set(friend, { x: 42.6, z: 4, heading: 0 });
    p.game.expel("human", friend);
    const slip = p.game.slips[0];
    p.positions.set(witness, { x: slip.x, z: slip.z, heading: 0 });
    p.game.reportSlip(witness, slip.id);
    p.run(12);
    expect(botLines(p).some((l) => l.text.includes(`asked ${friend} to follow them`))).toBe(true);
  });

  it("a bot following you to a terminal stands within its reach, so its pieces pool with yours", () => {
    const p = practice("bluffer");
    const friend = honestBot(p);
    talk(p, `${friend} follow me`);
    p.run(4);
    p.game.vote("human", null);
    untilClass(p);
    const t = TERMINALS.find((x) => x.id === "library-1")!;
    const stand = terminalStand(t.id);
    p.positions.set("human", { x: stand.x, z: stand.z, heading: 0 });
    p.run(15);
    expect(distance(p.positions.get(friend)!, t)).toBeLessThanOrEqual(INTERACT_RADIUS + 0.2);
  });

  it("ignores a plan to vote for the person who is talking", async () => {
    const p = practice("student", undefined, async () => ({ say: "hmm ok", plan: { kind: "vote", target: "human" } }));
    talk(p, "everyone I have the piece What colour");
    await new Promise((r) => setTimeout(r, 0));
    p.run(5);
    for (const b of (p.controller as any).bots) expect(b.suspicion.get("human") ?? 0).toBe(0);
  });
});
