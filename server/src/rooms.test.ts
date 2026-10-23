import { describe, expect, it } from "vitest";
import { RoomManager } from "./rooms";

function lobbyWith(n: number) {
  const rooms = new RoomManager();
  const created = rooms.create("p0", { name: "Host" });
  if (!created.ok) throw new Error("create failed");
  for (let i = 1; i < n; i++) rooms.join(`p${i}`, created.value.code, { name: `P${i}` });
  return { rooms, code: created.value.code };
}

describe("RoomManager", () => {
  it("creates 4-letter codes without I or O", () => {
    const rooms = new RoomManager();
    for (let i = 0; i < 50; i++) {
      const r = rooms.create(`h${i}`, { name: "Host" });
      expect(r.ok && r.value.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    }
  });

  it("requires a name", () => {
    const r = new RoomManager().create("p0", { name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NAME_REQUIRED");
  });

  it("joins case-insensitively and gives each player a different color", () => {
    const { rooms, code } = lobbyWith(1);
    const r = rooms.join("p1", code.toLowerCase(), { name: "Rina" });
    expect(r.ok).toBe(true);
    const colors = [...rooms.roomOf("p0")!.players.values()].map((p) => p.color);
    expect(new Set(colors).size).toBe(2);
  });

  it("rejects a wrong code", () => {
    const r = new RoomManager().join("p1", "ZZZZ", { name: "Rina" });
    expect(!r.ok && r.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("rejects a sixth player", () => {
    const { rooms, code } = lobbyWith(5);
    const r = rooms.join("p5", code, { name: "Extra" });
    expect(!r.ok && r.error.code).toBe("ROOM_FULL");
  });

  it("only lets the host start, and only with 4+ players", () => {
    const { rooms, code } = lobbyWith(3);
    const notHost = rooms.start("p1");
    expect(!notHost.ok && notHost.error.code).toBe("NOT_HOST");
    const tooFew = rooms.start("p0");
    expect(!tooFew.ok && tooFew.error.message).toBe("Need 1 more player.");
    rooms.join("p3", code, { name: "P3" });
    expect(rooms.start("p0").ok).toBe(true);
  });

  it("puts everyone on a different classroom seat at start", () => {
    const { rooms } = lobbyWith(4);
    rooms.start("p0");
    const spots = [...rooms.roomOf("p0")!.players.values()].map((p) => `${p.position.x},${p.position.z}`);
    expect(new Set(spots).size).toBe(4);
  });

  it("rejects joining a started game", () => {
    const { rooms, code } = lobbyWith(4);
    rooms.start("p0");
    const r = rooms.join("late", code, { name: "Late" });
    expect(!r.ok && r.error.code).toBe("ALREADY_STARTED");
  });

  it("hands host to the next player when the host leaves", () => {
    const { rooms } = lobbyWith(2);
    const room = rooms.leave("p0");
    expect(room?.hostId).toBe("p1");
  });

  it("deletes a room when the last player leaves", () => {
    const { rooms, code } = lobbyWith(1);
    expect(rooms.leave("p0")).toBeUndefined();
    const r = rooms.join("p1", code, { name: "Rina" });
    expect(!r.ok && r.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("ignores moves before the game starts and bad numbers", () => {
    const { rooms } = lobbyWith(4);
    expect(rooms.move("p0", { x: 1, z: 1, heading: 0 })).toBeUndefined();
    rooms.start("p0");
    expect(rooms.move("p0", { x: NaN, z: 1, heading: 0 })).toBeUndefined();
    expect(rooms.move("p0", { x: 3, z: 9, heading: 0 })?.players.get("p0")?.position.x).toBe(3);
  });

  it("keeps the chosen character and color, but never lets two players share a color", () => {
    const rooms = new RoomManager();
    const r = rooms.create("p0", { name: "Host", character: "male-c", color: "#e5566b" });
    if (!r.ok) throw new Error("create failed");
    rooms.join("p1", r.value.code, { name: "Rina", character: "female-b", color: "#e5566b" });
    rooms.join("p2", r.value.code, { name: "Odd", character: "dragon", color: "#123456" });
    const [host, rina, odd] = [...r.value.players.values()];
    expect(host).toMatchObject({ character: "male-c", color: "#e5566b" });
    expect(rina.character).toBe("female-b");
    expect(rina.color).not.toBe("#e5566b");
    expect(odd.character).toBe("female-a");
    expect(new Set([host.color, rina.color, odd.color]).size).toBe(3);
  });
});
