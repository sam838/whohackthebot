import { TERMINALS } from "@whtb/shared/map";
import type { Role } from "@whtb/shared/types";
import { describe, expect, it } from "vitest";
import { ActionError, GameRoom, type Sender } from "./GameRoom";
import { assignRoles, assignTasks, checkWinner } from "./rules";

interface Sent {
  to: string;
  event: string;
  payload: any;
}

function setup(n = 4) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const sent: Sent[] = [];
  let clock = 1_000_000;
  const positions = new Map(ids.map((id) => [id, { x: 0, z: 0 }]));
  const sender: Sender = {
    toPlayer: (to, event, payload) => sent.push({ to, event, payload }),
    publicChanged: () => sent.push({ to: "room", event: "public", payload: null }),
  };
  const game = new GameRoom(ids, sender, (id) => positions.get(id), Math.random, () => clock);
  game.dealSecrets();
  const byRole = (role: Role) => [...game.roles].filter(([, r]) => r === role).map(([id]) => id);
  const tasksOf = (id: string): string[] =>
    sent.filter((s) => s.to === id && s.event === "game:tasks").at(-1)!.payload.terminalIds;
  const walkTo = (id: string, terminalId: string) => {
    const t = TERMINALS.find((x) => x.id === terminalId)!;
    positions.set(id, { x: t.x, z: t.z + 0.9 });
  };
  const last = (id: string, event: string) => sent.filter((s) => s.to === id && s.event === event).at(-1)?.payload;
  const advance = (ms: number) => {
    clock += ms;
  };
  return { game, sent, byRole, tasksOf, walkTo, last, advance };
}

describe("rules", () => {
  it("assigns exactly one Bluffer and one Fact-Checker for 4 and 5 players", () => {
    for (const n of [4, 5]) {
      for (let i = 0; i < 20; i++) {
        const roles = [...assignRoles(Array.from({ length: n }, (_, k) => `p${k}`), Math.random).values()];
        expect(roles.filter((r) => r === "bluffer")).toHaveLength(1);
        expect(roles.filter((r) => r === "factChecker")).toHaveLength(1);
        expect(roles.filter((r) => r === "student")).toHaveLength(n - 2);
      }
    }
  });

  it("gives each player 3 different real terminals", () => {
    const ids = TERMINALS.map((t) => t.id);
    for (const list of assignTasks(["a", "b", "c", "d"], ids, Math.random).values()) {
      expect(new Set(list).size).toBe(3);
      list.forEach((t) => expect(ids).toContain(t));
    }
  });

  it("picks winners in the right order", () => {
    const base = { strikes: 0, blufferAlive: true, aliveCount: 4, tasksRemaining: 5 };
    expect(checkWinner(base)).toBeUndefined();
    expect(checkWinner({ ...base, blufferAlive: false })?.winner).toBe("class");
    expect(checkWinner({ ...base, strikes: 3 })?.winner).toBe("bluffer");
    expect(checkWinner({ ...base, aliveCount: 2 })?.winner).toBe("bluffer");
    expect(checkWinner({ ...base, tasksRemaining: 0 })?.winner).toBe("class");
  });
});

describe("GameRoom", () => {
  it("tells each player only their own role", () => {
    const { sent } = setup();
    const roleMsgs = sent.filter((s) => s.event === "game:role");
    expect(roleMsgs).toHaveLength(4);
    expect(new Set(roleMsgs.map((m) => m.to)).size).toBe(4);
  });

  it("never sends the correct answer or the lie index with a question", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const student = byRole("student")[0];
    const t = tasksOf(student)[0];
    walkTo(student, t);
    game.openTerminal(student, t);
    const q = last(student, "terminal:question");
    expect(Object.keys(q).sort()).toEqual(["botPick", "choices", "confidence", "msLeft", "prompt", "subject", "terminalId"]);
  });

  it("rejects opening from too far away or without a task there", () => {
    const { game, byRole, tasksOf } = setup();
    const student = byRole("student")[0];
    expect(() => game.openTerminal(student, tasksOf(student)[0])).toThrow(ActionError);
  });

  it("a correct answer completes the task and adds progress", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(s, t);
    game.openTerminal(s, t);
    const q = last(s, "terminal:question");
    game.answer(s, q.botPick); // not hacked, so Study-Bot is right
    expect(last(s, "terminal:result").outcome).toBe("correct");
    expect(game.progress).toBe(1);
    expect(tasksOf(s)).not.toContain(t);
  });

  it("a hacked terminal recommends the lie, trusting it is a strike, and the hack is used up", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const bluffer = byRole("bluffer")[0];
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(bluffer, t);
    game.hack(bluffer, t);
    walkTo(s, t);
    game.openTerminal(s, t);
    const q = last(s, "terminal:question");
    game.answer(s, q.botPick);
    expect(last(s, "terminal:result").outcome).toBe("strike");
    expect(game.strikes).toBe(1);
    expect(tasksOf(s)).toContain(t);

    game.openTerminal(s, t);
    game.answer(s, last(s, "terminal:question").botPick);
    expect(last(s, "terminal:result").outcome).toBe("correct");
  });

  it("a wrong answer keeps the task without a strike", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(s, t);
    game.openTerminal(s, t);
    const q = last(s, "terminal:question");
    game.answer(s, (q.botPick + 1) % 4);
    expect(last(s, "terminal:result").outcome).toBe("wrong");
    expect(game.strikes).toBe(0);
    expect(tasksOf(s)).toContain(t);
  });

  it("running out of time counts as wrong", () => {
    const { game, byRole, tasksOf, walkTo, last, advance } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(s, t);
    game.openTerminal(s, t);
    advance(19_000);
    game.tick();
    expect(last(s, "terminal:result")).toBeUndefined();
    advance(2_000);
    game.tick();
    expect(last(s, "terminal:result").outcome).toBe("wrong");
  });

  it("double-check costs time and sends a hint", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(s, t);
    game.openTerminal(s, t);
    game.doubleCheck(s);
    const hint = last(s, "terminal:hint");
    expect(hint.hint.length).toBeGreaterThan(0);
    expect(hint.msLeft).toBe(12_000);
  });

  it("the Fact-Checker can verify once, and it tells the truth about a hacked answer", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    const fc = byRole("factChecker")[0];
    const bluffer = byRole("bluffer")[0];
    const t = tasksOf(fc)[0];
    walkTo(bluffer, t);
    game.hack(bluffer, t);
    walkTo(fc, t);
    game.openTerminal(fc, t);
    game.verify(fc);
    expect(last(fc, "terminal:verifyResult").botIsRight).toBe(false);
    expect(() => game.verify(fc)).toThrow("already used");
    const student = byRole("student")[0];
    expect(() => game.verify(student)).toThrow("Only the Fact-Checker");
  });

  it("hacking has a cooldown and needs the Bluffer to be close", () => {
    const { game, byRole, walkTo, advance } = setup();
    const bluffer = byRole("bluffer")[0];
    expect(() => game.hack(bluffer, "library-1")).toThrow("Walk closer");
    walkTo(bluffer, "library-1");
    game.hack(bluffer, "library-1");
    walkTo(bluffer, "lab-1");
    expect(() => game.hack(bluffer, "lab-1")).toThrow("Hack ready in 30s");
    advance(30_000);
    expect(() => game.hack(bluffer, "lab-1")).not.toThrow();
  });

  it("the Bluffer wins at 3 strikes", () => {
    const { game, byRole, tasksOf, walkTo, last, advance } = setup();
    const bluffer = byRole("bluffer")[0];
    const s = byRole("student")[0];
    for (let i = 0; i < 3; i++) {
      const t = tasksOf(s)[0];
      walkTo(bluffer, t);
      game.hack(bluffer, t);
      walkTo(s, t);
      game.openTerminal(s, t);
      game.answer(s, last(s, "terminal:question").botPick);
      advance(30_000);
    }
    expect(game.gameOver()?.winner).toBe("bluffer");
  });

  it("the class wins when every living classmate finishes their tasks", () => {
    const { game, byRole, tasksOf, walkTo, last } = setup();
    for (const id of [...byRole("student"), ...byRole("factChecker")]) {
      for (const t of [...tasksOf(id)]) {
        walkTo(id, t);
        game.openTerminal(id, t);
        game.answer(id, last(id, "terminal:question").botPick);
      }
    }
    expect(game.progress).toBe(9);
    expect(game.gameOver()?.winner).toBe("class");
  });

  it("the class wins if the Bluffer leaves; the Bluffer wins when only 2 are left", () => {
    const a = setup();
    a.game.removePlayer(a.byRole("bluffer")[0]);
    expect(a.game.gameOver()?.winner).toBe("class");

    const b = setup();
    const [s1, s2] = b.byRole("student");
    b.game.removePlayer(s1);
    expect(b.game.gameOver()).toBeUndefined();
    b.game.removePlayer(s2);
    expect(b.game.gameOver()?.winner).toBe("bluffer");
  });
});
