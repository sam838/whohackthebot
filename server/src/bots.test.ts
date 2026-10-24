import { MEETING_BUTTON } from "@whtb/shared/map";
import type { PlayerPosition, Role } from "@whtb/shared/types";
import { describe, expect, it } from "vitest";
import { BotController } from "./bots";
import { GameRoom, type Sender } from "./game/GameRoom";
import { assignRoles } from "./game/rules";
import { RoomManager } from "./rooms";

/** A practice game with a fake clock: one human (standing still) and 3 bots. */
function practice(humanRole: Role) {
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
  });
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 12; i++) {
      clock += 1000 / 12;
      controller.tick(1 / 12);
      game.tick();
      if (game.over) break;
    }
  };
  return { game, positions, run, roomEvents };
}

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
  it("walk around, pick up pieces, and solve or get fooled at terminals", () => {
    const { game, positions, run } = practice("student");
    const start = { ...positions.get("bot-0")! };
    const floorBefore = game.floorPieces().length;
    run(240);
    const moved = positions.get("bot-0")!;
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(1);
    expect(game.floorPieces().length).toBeLessThan(floorBefore);
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
    run(30);
    expect(roomEvents.some((e) => e.event === "chat:message")).toBe(true);
    expect(roomEvents.some((e) => e.event === "vote:result")).toBe(true);
  });
});
