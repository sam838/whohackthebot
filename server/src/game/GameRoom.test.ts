import { TERMINALS } from "@whtb/shared/map";
import { PIECE_SPOTS } from "@whtb/shared/pieces";
import { QUESTIONS } from "@whtb/shared/questions";
import type { PieceInfo, Role } from "@whtb/shared/types";
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
  const last = (id: string, event: string) => sent.filter((s) => s.to === id && s.event === event).at(-1)?.payload;
  const all = (id: string, event: string) => sent.filter((s) => s.to === id && s.event === event).map((s) => s.payload);
  const tasksOf = (id: string): string[] => last(id, "game:tasks").tasks.map((t: { terminalId: string }) => t.terminalId);
  const walkTo = (id: string, terminalId: string) => {
    const t = TERMINALS.find((x) => x.id === terminalId)!;
    positions.set(id, { x: t.x, z: t.z + 0.9 });
  };
  const pieceIds = (id: string, terminalId: string) => [0, 1, 2].map((k) => `${id}:${terminalId}:${k}`);
  /** Walk onto each of this task's pieces and pick it up. */
  const collect = (id: string, terminalId: string) => {
    const visible: PieceInfo[] = last(byRole("student")[0], "pieces:state")?.pieces ?? [];
    for (const pieceId of pieceIds(id, terminalId)) {
      const p = visible.find((v) => v.id === pieceId);
      if (!p) continue;
      positions.set(id, { x: p.x, z: p.z });
      game.pickUp(id, pieceId);
    }
  };
  /** Collect, walk to the terminal, open it, and arrange it yourself. Returns the question shown. */
  const ready = (id: string, terminalId: string, how: "you" | "studybot" = "you") => {
    collect(id, terminalId);
    walkTo(id, terminalId);
    game.openTerminal(id, terminalId);
    if (how === "you") game.arrange(id, pieceIds(id, terminalId));
    else game.botArrange(id);
    return last(id, "terminal:question");
  };
  const advance = (ms: number) => {
    clock += ms;
  };
  return { game, sent, byRole, tasksOf, walkTo, last, all, advance, collect, ready, pieceIds, positions };
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

  it("every question's pieces read as its prompt, and its lie differs from its answer", () => {
    for (const q of QUESTIONS) {
      expect(q.pieces).toHaveLength(3);
      expect(q.pieces.join(" ")).toBe(q.prompt);
      expect(q.twistedPrompt).not.toBe(q.prompt);
      expect(q.lieIndex).not.toBe(q.correctIndex);
    }
  });
});

describe("question pieces", () => {
  it("puts each task's 3 pieces in 3 different rooms, on free floor, and never sends their text", () => {
    const { last, byRole, pieceIds } = setup(5);
    const visible: PieceInfo[] = last(byRole("student")[0], "pieces:state").pieces;
    expect(visible).toHaveLength(4 * 3 * 3);
    for (const p of visible) expect(Object.keys(p).sort()).toEqual(["id", "ownerId", "x", "z"]);
    const s = byRole("student")[0];
    const t = last(s, "game:tasks").tasks[0].terminalId;
    const rooms = pieceIds(s, t).map((id) => {
      const p = visible.find((v) => v.id === id)!;
      return PIECE_SPOTS.find((spot) => spot.x === p.x && spot.z === p.z)!.room;
    });
    expect(new Set(rooms).size).toBe(3);
  });

  it("the Bluffer never receives piece positions", () => {
    const { all, byRole } = setup();
    expect(all(byRole("bluffer")[0], "pieces:state")).toHaveLength(0);
  });

  it("only the owner can pick up a piece, and only when standing on it", () => {
    const { game, byRole, last, positions, pieceIds } = setup();
    const [s1, s2] = byRole("student");
    const t = last(s1, "game:tasks").tasks[0].terminalId;
    const pieceId = pieceIds(s1, t)[0];
    const p = (last(s1, "pieces:state").pieces as PieceInfo[]).find((v) => v.id === pieceId)!;
    expect(() => game.pickUp(s1, pieceId)).toThrow("Walk onto the piece");
    positions.set(s2, { x: p.x, z: p.z });
    game.pickUp(s2, pieceId);
    expect(last(s2, "piece:collected")).toBeUndefined();
    positions.set(s1, { x: p.x, z: p.z });
    game.pickUp(s1, pieceId);
    expect(last(s1, "piece:collected").text.length).toBeGreaterThan(0);
    expect(last(s1, "game:tasks").tasks[0].found).toBe(1);
  });

  it("a terminal won't open your question until you hold all 3 pieces", () => {
    const { game, byRole, tasksOf, walkTo } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(s, t);
    expect(() => game.openTerminal(s, t)).toThrow("Find all the question pieces first (0/3)");
  });

  it("a wrong arrangement says try again; the right one reveals the real question", () => {
    const { game, byRole, tasksOf, walkTo, collect, last, pieceIds } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    collect(s, t);
    walkTo(s, t);
    game.openTerminal(s, t);
    expect(last(s, "terminal:arrange").cards).toHaveLength(3);
    game.arrange(s, [...pieceIds(s, t)].reverse());
    expect(last(s, "terminal:question")).toBeUndefined();
    game.arrange(s, pieceIds(s, t));
    const q = last(s, "terminal:question");
    expect(q.arrangedBy).toBe("you");
    expect(QUESTIONS.map((x) => x.prompt)).toContain(q.prompt);
  });

  it("a hacked Study-Bot arranges a twisted question whose answer is its lie", () => {
    const { game, byRole, tasksOf, walkTo, ready } = setup();
    const bluffer = byRole("bluffer")[0];
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(bluffer, t);
    game.hack(bluffer, t);
    const q = ready(s, t, "studybot");
    const source = QUESTIONS.find((x) => x.twistedPrompt === q.prompt)!;
    expect(source).toBeDefined();
    expect(q.choices[q.botPick]).toBe(source.choices[source.lieIndex]);
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
    const { byRole, tasksOf, ready } = setup();
    const s = byRole("student")[0];
    const q = ready(s, tasksOf(s)[0]);
    expect(Object.keys(q).sort()).toEqual(["arrangedBy", "botPick", "choices", "confidence", "msLeft", "prompt", "subject", "terminalId"]);
  });

  it("rejects opening from too far away", () => {
    const { game, byRole, tasksOf } = setup();
    const student = byRole("student")[0];
    expect(() => game.openTerminal(student, tasksOf(student)[0])).toThrow(ActionError);
  });

  it("a correct answer completes the task and adds progress", () => {
    const { game, byRole, tasksOf, last, ready } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    const q = ready(s, t);
    game.answer(s, q.botPick); // not hacked, so Study-Bot is right
    expect(last(s, "terminal:result").outcome).toBe("correct");
    expect(game.progress).toBe(1);
    expect(tasksOf(s)).not.toContain(t);
  });

  it("a hacked terminal recommends the lie, trusting it is a strike, and the hack is used up", () => {
    const { game, byRole, tasksOf, walkTo, last, ready, pieceIds } = setup();
    const bluffer = byRole("bluffer")[0];
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    walkTo(bluffer, t);
    game.hack(bluffer, t);
    const q = ready(s, t);
    game.answer(s, q.botPick);
    expect(last(s, "terminal:result").outcome).toBe("strike");
    expect(game.strikes).toBe(1);
    expect(tasksOf(s)).toContain(t);

    // Pieces are kept, so the retry goes straight to arranging.
    game.openTerminal(s, t);
    game.arrange(s, pieceIds(s, t));
    game.answer(s, last(s, "terminal:question").botPick);
    expect(last(s, "terminal:result").outcome).toBe("correct");
  });

  it("a wrong answer keeps the task without a strike", () => {
    const { game, byRole, tasksOf, last, ready } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    const q = ready(s, t);
    game.answer(s, (q.botPick + 1) % 4);
    expect(last(s, "terminal:result").outcome).toBe("wrong");
    expect(game.strikes).toBe(0);
    expect(tasksOf(s)).toContain(t);
  });

  it("running out of time counts as wrong, even while still arranging", () => {
    const { game, byRole, tasksOf, walkTo, collect, last, advance } = setup();
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    collect(s, t);
    walkTo(s, t);
    game.openTerminal(s, t);
    advance(29_000);
    game.tick();
    expect(last(s, "terminal:result")).toBeUndefined();
    advance(2_000);
    game.tick();
    expect(last(s, "terminal:result").outcome).toBe("wrong");
  });

  it("double-check costs time and sends a hint", () => {
    const { game, byRole, tasksOf, last, ready } = setup();
    const s = byRole("student")[0];
    ready(s, tasksOf(s)[0]);
    game.doubleCheck(s);
    const hint = last(s, "terminal:hint");
    expect(hint.hint.length).toBeGreaterThan(0);
    expect(hint.msLeft).toBe(22_000);
  });

  it("the Fact-Checker can verify once, and it tells the truth about a hacked answer", () => {
    const { game, byRole, tasksOf, walkTo, last, ready } = setup();
    const fc = byRole("factChecker")[0];
    const bluffer = byRole("bluffer")[0];
    const t = tasksOf(fc)[0];
    walkTo(bluffer, t);
    game.hack(bluffer, t);
    ready(fc, t);
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

  it("the Bluffer can fake a task at any terminal without pieces", () => {
    const { game, byRole, walkTo, last } = setup();
    const bluffer = byRole("bluffer")[0];
    walkTo(bluffer, "canteen-2");
    game.openTerminal(bluffer, "canteen-2");
    game.answer(bluffer, 0);
    expect(last(bluffer, "terminal:result").outcome).toBe("faked");
  });

  it("the Bluffer wins at 3 strikes", () => {
    const { game, byRole, tasksOf, walkTo, last, ready, advance, pieceIds } = setup();
    const bluffer = byRole("bluffer")[0];
    const s = byRole("student")[0];
    const t = tasksOf(s)[0];
    for (let i = 0; i < 3; i++) {
      walkTo(bluffer, t);
      game.hack(bluffer, t);
      if (i === 0) ready(s, t);
      else {
        walkTo(s, t);
        game.openTerminal(s, t);
        game.arrange(s, pieceIds(s, t));
      }
      game.answer(s, last(s, "terminal:question").botPick);
      advance(30_000);
    }
    expect(game.gameOver()?.winner).toBe("bluffer");
  });

  it("the class wins when every living classmate finishes their tasks", () => {
    const { game, byRole, tasksOf, ready } = setup();
    for (const id of [...byRole("student"), ...byRole("factChecker")]) {
      for (const t of [...tasksOf(id)]) {
        const q = ready(id, t);
        game.answer(id, q.botPick);
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
