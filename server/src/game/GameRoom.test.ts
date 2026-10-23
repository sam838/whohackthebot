import { TERMINALS } from "@whtb/shared/map";
import { PIECE_SPOTS } from "@whtb/shared/pieces";
import { QUESTIONS } from "@whtb/shared/questions";
import type { PieceInfo, Role } from "@whtb/shared/types";
import { describe, expect, it } from "vitest";
import { GameRoom, type Sender } from "./GameRoom";
import { assignRoles, checkWinner } from "./rules";

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
  const floor = (): PieceInfo[] => last(ids[0], "pieces:state").pieces;
  const bag = (id: string): string[] => last(id, "game:bag").pieces.map((p: { id: string }) => p.id);
  const walkTo = (id: string, terminalId: string) => {
    const t = TERMINALS.find((x) => x.id === terminalId)!;
    positions.set(id, { x: t.x, z: t.z + 0.9 });
  };
  const pieceIdsOf = (questionIndex: number) => game.pieceIdsOf(game.questions[questionIndex]);
  /** Walk onto a piece and pick it up. */
  const grab = (id: string, pieceId: string) => {
    const p = floor().find((f) => f.id === pieceId);
    if (!p) throw new Error(`piece ${pieceId} not on floor`);
    positions.set(id, { x: p.x, z: p.z });
    game.pickUp(id, pieceId);
  };
  /** One player grabs all 3 pieces of question i, walks to the terminal, opens and arranges it. */
  const solveSetup = (id: string, qi: number, terminalId = "library-1", how: "you" | "studybot" = "you") => {
    for (const pid of pieceIdsOf(qi)) grab(id, pid);
    walkTo(id, terminalId);
    game.openTerminal(id, terminalId);
    if (how === "you") game.arrange(id, pieceIdsOf(qi));
    else game.botArrange(id);
    return last(id, "terminal:question");
  };
  const advance = (ms: number) => {
    clock += ms;
  };
  return { game, sent, byRole, last, all, floor, bag, walkTo, pieceIdsOf, grab, solveSetup, advance, positions };
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

  it("picks winners in the right order", () => {
    const base = { strikes: 0, blufferAlive: true, aliveCount: 4, questionsRemaining: 5 };
    expect(checkWinner(base)).toBeUndefined();
    expect(checkWinner({ ...base, blufferAlive: false })?.winner).toBe("class");
    expect(checkWinner({ ...base, strikes: 3 })?.winner).toBe("bluffer");
    expect(checkWinner({ ...base, aliveCount: 2 })?.winner).toBe("bluffer");
    expect(checkWinner({ ...base, questionsRemaining: 0 })?.winner).toBe("class");
  });

  it("every question's pieces read as its prompt, and its lie differs from its answer", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const q of QUESTIONS) {
      expect(q.pieces).toHaveLength(3);
      expect(q.pieces.join(" ")).toBe(q.prompt);
      expect(q.twistedPrompt).not.toBe(q.prompt);
      expect(q.lieIndex).not.toBe(q.correctIndex);
    }
  });
});

describe("shared question pieces", () => {
  it("has 2 questions per classmate, each with 3 pieces in 3 different rooms, with no text on the floor", () => {
    for (const n of [4, 5]) {
      const { game, floor } = setup(n);
      expect(game.questions).toHaveLength((n - 1) * 2);
      expect(floor()).toHaveLength((n - 1) * 2 * 3);
      for (const p of floor()) {
        expect(Object.keys(p).sort()).toEqual(["id", "x", "z"]);
        expect(p.id).toMatch(/^piece-\d+$/); // opaque: no question id leaks
      }
      for (const q of game.questions) {
        const rooms = game.pieceIdsOf(q).map((id) => {
          const p = floor().find((f) => f.id === id)!;
          return PIECE_SPOTS.find((s) => s.x === p.x && s.z === p.z)!.room;
        });
        expect(new Set(rooms).size).toBe(3);
      }
    }
  });

  it("anyone can pick up any piece, only when standing on it, and learns its text", () => {
    const { game, byRole, floor, bag, grab, last, pieceIdsOf } = setup();
    const s = byRole("student")[0];
    expect(() => game.pickUp(s, pieceIdsOf(0)[0])).toThrow("Walk onto the piece");
    grab(s, pieceIdsOf(0)[0]);
    expect(bag(s)).toEqual([pieceIdsOf(0)[0]]);
    expect(last(s, "piece:collected").text).toBe(game.questions[0].pieces[0]);
    expect(floor().map((f) => f.id)).not.toContain(pieceIdsOf(0)[0]);
  });

  it("the Bluffer can hoard at most 2 pieces", () => {
    const { byRole, grab, bag, pieceIdsOf } = setup();
    const b = byRole("bluffer")[0];
    grab(b, pieceIdsOf(0)[0]);
    grab(b, pieceIdsOf(0)[1]);
    expect(() => grab(b, pieceIdsOf(0)[2])).toThrow("hands are full");
    expect(bag(b)).toHaveLength(2);
  });

  it("everyone standing at the same terminal pools their pieces, the Bluffer included", () => {
    const { game, byRole, grab, walkTo, last, pieceIdsOf } = setup();
    const [s1, s2] = byRole("student");
    const b = byRole("bluffer")[0];
    const [p0, p1, p2] = pieceIdsOf(0);
    grab(s1, p0);
    grab(s2, p1);
    walkTo(s1, "library-1");
    walkTo(s2, "library-1");
    expect(() => game.openTerminal(s1, "library-1")).toThrow("Need at least 3 pieces here (2 so far)");
    grab(b, p2);
    walkTo(b, "library-1");
    game.openTerminal(s1, "library-1");
    const cards = last(s1, "terminal:arrange").cards.map((c: { id: string }) => c.id).sort();
    expect(cards).toEqual([p0, p1, p2].sort());
  });

  it("a terminal refuses pieces held by classmates who are elsewhere", () => {
    const { game, byRole, grab, walkTo, pieceIdsOf } = setup();
    const [s1, s2] = byRole("student");
    grab(s1, pieceIdsOf(0)[0]);
    grab(s2, pieceIdsOf(0)[1]);
    grab(s2, pieceIdsOf(0)[2]);
    walkTo(s1, "library-1");
    walkTo(s2, "canteen-1");
    expect(() => game.openTerminal(s1, "library-1")).toThrow("(1 so far)");
  });

  it("an arrangement must be one question's 3 pieces in reading order", () => {
    const { game, byRole, grab, walkTo, last, all, pieceIdsOf } = setup();
    const s = byRole("student")[0];
    for (const id of [...pieceIdsOf(0), pieceIdsOf(1)[0]]) grab(s, id);
    walkTo(s, "library-1");
    game.openTerminal(s, "library-1");
    const [a, b, c] = pieceIdsOf(0);
    game.arrange(s, [c, b, a]);
    expect(last(s, "terminal:question")).toBeUndefined();
    game.arrange(s, [a, b, pieceIdsOf(1)[0]]);
    expect(last(s, "terminal:question")).toBeUndefined();
    expect(all(s, "terminal:arrangeWrong")).toHaveLength(2);
    game.arrange(s, [a, b, c]);
    const q = last(s, "terminal:question");
    expect(q.arrangedBy).toBe("you");
    expect(q.prompt).toBe(game.questions[0].prompt);
    expect(q.pieces).toEqual(game.questions[0].pieces);
  });

  it("Study-Bot needs a full question in the pool", () => {
    const { game, byRole, grab, walkTo, pieceIdsOf } = setup();
    const s = byRole("student")[0];
    grab(s, pieceIdsOf(0)[0]);
    grab(s, pieceIdsOf(0)[1]);
    grab(s, pieceIdsOf(1)[0]);
    walkTo(s, "library-1");
    game.openTerminal(s, "library-1");
    expect(() => game.botArrange(s)).toThrow("Not enough pieces");
  });

  it("a hacked Study-Bot arranges a twisted question whose answer is its lie, with the real pieces shown", () => {
    const { game, byRole, walkTo, solveSetup } = setup();
    const b = byRole("bluffer")[0];
    const s = byRole("student")[0];
    walkTo(b, "library-1");
    game.hack(b, "library-1");
    const q = solveSetup(s, 0, "library-1", "studybot");
    const source = game.questions[0];
    expect(q.prompt).toBe(source.twistedPrompt);
    expect(q.pieces).toEqual(source.pieces);
    expect(q.choices[q.botPick]).toBe(source.choices[source.lieIndex]);
  });

  it("a correct answer uses up the pieces; a wrong answer or a strike gives them back", () => {
    const { game, byRole, walkTo, bag, last, solveSetup, pieceIdsOf } = setup();
    const b = byRole("bluffer")[0];
    const s = byRole("student")[0];
    walkTo(b, "library-1");
    game.hack(b, "library-1");
    let q = solveSetup(s, 0);
    game.answer(s, q.botPick);
    expect(last(s, "terminal:result").outcome).toBe("strike");
    expect(game.strikes).toBe(1);
    expect(bag(s)).toHaveLength(3);

    game.openTerminal(s, "library-1");
    game.arrange(s, pieceIdsOf(0));
    q = last(s, "terminal:question");
    game.answer(s, (q.botPick + 1) % 4);
    expect(last(s, "terminal:result").outcome).toBe("wrong");
    expect(bag(s)).toHaveLength(3);

    game.openTerminal(s, "library-1");
    game.arrange(s, pieceIdsOf(0));
    game.answer(s, last(s, "terminal:question").botPick);
    expect(last(s, "terminal:result").outcome).toBe("correct");
    expect(bag(s)).toHaveLength(0);
    expect(game.progress).toBe(1);
  });

  it("a leaver's pieces go back to where they were found", () => {
    const { game, byRole, grab, floor, pieceIdsOf } = setup();
    const s = byRole("student")[0];
    const before = floor().find((f) => f.id === pieceIdsOf(0)[0])!;
    grab(s, pieceIdsOf(0)[0]);
    game.removePlayer(s);
    expect(floor().find((f) => f.id === pieceIdsOf(0)[0])).toEqual(before);
  });

  it("leaving a terminal costs nothing: no strike, no progress, pieces kept", () => {
    const { game, byRole, walkTo, bag, last, solveSetup, pieceIdsOf } = setup();
    const b = byRole("bluffer")[0];
    const s = byRole("student")[0];
    walkTo(b, "library-1");
    game.hack(b, "library-1");
    solveSetup(s, 0);
    game.close(s);
    expect(game.strikes).toBe(0);
    expect(game.progress).toBe(0);
    expect(bag(s)).toHaveLength(3);
    expect(last(s, "terminal:result")).toBeUndefined();
    // And the terminal can be opened again afterwards.
    game.openTerminal(s, "library-1");
    game.arrange(s, pieceIdsOf(0));
    expect(last(s, "terminal:question").arrangedBy).toBe("you");
  });

  it("the Bluffer needs a pool of 3 like anyone, and gets no question without one", () => {
    const { game, byRole, walkTo, last } = setup();
    const b = byRole("bluffer")[0];
    walkTo(b, "canteen-2");
    expect(() => game.openTerminal(b, "canteen-2")).toThrow("Need at least 3 pieces");
    expect(last(b, "terminal:question")).toBeUndefined();
  });

  it("the Bluffer never causes a strike, never uses up their own hack, and a correct answer still helps the class", () => {
    const { game, byRole, walkTo, grab, last, pieceIdsOf, advance } = setup();
    const b = byRole("bluffer")[0];
    const s = byRole("student")[0];
    // The Bluffer carries 2 pieces; a student brings the third.
    grab(b, pieceIdsOf(0)[0]);
    grab(b, pieceIdsOf(0)[1]);
    grab(s, pieceIdsOf(0)[2]);
    walkTo(b, "library-1");
    walkTo(s, "library-1");
    game.hack(b, "library-1");
    game.openTerminal(b, "library-1");
    game.botArrange(b);
    const q = last(b, "terminal:question");
    expect(q.prompt).toBe(game.questions[0].prompt); // not twisted: the hack is still waiting
    game.answer(b, (q.botPick + 1) % 4);
    expect(game.strikes).toBe(0);

    // The hack is still there for the next classmate.
    game.openTerminal(s, "library-1");
    game.botArrange(s);
    expect(last(s, "terminal:question").prompt).toBe(game.questions[0].twistedPrompt);
    game.close(s);

    // A correct Bluffer answer counts for the class.
    advance(1);
    game.openTerminal(b, "library-1");
    game.arrange(b, pieceIdsOf(0));
    game.answer(b, last(b, "terminal:question").botPick);
    expect(last(b, "terminal:result").outcome).toBe("correct");
    expect(game.progress).toBe(1);
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
    const { byRole, solveSetup } = setup();
    const q = solveSetup(byRole("student")[0], 0);
    expect(Object.keys(q).sort()).toEqual(
      ["arrangedBy", "botPick", "choices", "confidence", "msLeft", "pieces", "prompt", "subject", "terminalId"],
    );
  });

  it("running out of time counts as wrong, even while still arranging", () => {
    const { game, byRole, grab, walkTo, last, advance, pieceIdsOf, bag } = setup();
    const s = byRole("student")[0];
    for (const id of pieceIdsOf(0)) grab(s, id);
    walkTo(s, "library-1");
    game.openTerminal(s, "library-1");
    advance(29_000);
    game.tick();
    expect(last(s, "terminal:result")).toBeUndefined();
    advance(2_000);
    game.tick();
    expect(last(s, "terminal:result").outcome).toBe("wrong");
    expect(bag(s)).toHaveLength(3);
  });

  it("double-check costs time and sends a hint", () => {
    const { game, byRole, last, solveSetup } = setup();
    const s = byRole("student")[0];
    solveSetup(s, 0);
    game.doubleCheck(s);
    const hint = last(s, "terminal:hint");
    expect(hint.hint.length).toBeGreaterThan(0);
    expect(hint.msLeft).toBe(22_000);
  });

  it("the Fact-Checker can verify once, and it tells the truth about a hacked answer", () => {
    const { game, byRole, walkTo, last, solveSetup } = setup();
    const fc = byRole("factChecker")[0];
    const b = byRole("bluffer")[0];
    walkTo(b, "library-1");
    game.hack(b, "library-1");
    solveSetup(fc, 0);
    game.verify(fc);
    expect(last(fc, "terminal:verifyResult").botIsRight).toBe(false);
    expect(() => game.verify(fc)).toThrow("already used");
    expect(() => game.verify(byRole("student")[0])).toThrow("Only the Fact-Checker");
  });

  it("hacking has a cooldown and needs the Bluffer to be close", () => {
    const { game, byRole, walkTo, advance } = setup();
    const b = byRole("bluffer")[0];
    expect(() => game.hack(b, "library-1")).toThrow("Walk closer");
    walkTo(b, "library-1");
    game.hack(b, "library-1");
    walkTo(b, "lab-1");
    expect(() => game.hack(b, "lab-1")).toThrow("Hack ready in 30s");
    advance(30_000);
    expect(() => game.hack(b, "lab-1")).not.toThrow();
  });

  it("the Bluffer wins at 3 strikes", () => {
    const { game, byRole, walkTo, last, solveSetup, advance, pieceIdsOf } = setup();
    const b = byRole("bluffer")[0];
    const s = byRole("student")[0];
    for (let i = 0; i < 3; i++) {
      walkTo(b, "library-1");
      game.hack(b, "library-1");
      if (i === 0) solveSetup(s, 0);
      else {
        walkTo(s, "library-1");
        game.openTerminal(s, "library-1");
        game.arrange(s, pieceIdsOf(0));
      }
      game.answer(s, last(s, "terminal:question").botPick);
      advance(30_000);
    }
    expect(game.gameOver()?.winner).toBe("bluffer");
  });

  it("the class wins when every question is solved", () => {
    const { game, byRole, last, solveSetup } = setup();
    const s = byRole("student")[0];
    game.questions.forEach((_, i) => {
      const q = solveSetup(s, i);
      game.answer(s, q.botPick);
      expect(last(s, "terminal:result").outcome).toBe("correct");
    });
    expect(game.progress).toBe(6);
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
