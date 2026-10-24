import { EXPEL_COOLDOWN_SECONDS, EXPEL_GRACE_SECONDS, HACK_COOLDOWN_SECONDS, QUESTIONS_PER_CLASSMATE } from "@whtb/shared/constants";
import { TERMINALS } from "@whtb/shared/map";
import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { QUESTIONS } from "@whtb/shared/questions";
import type { Role } from "@whtb/shared/types";
import { describe, expect, it } from "vitest";
import { GameRoom, type Sender } from "./GameRoom";
import { assignRoles, checkWinner, tallyVotes } from "./rules";

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
  const respawned: string[][] = [];
  const sender: Sender = {
    toPlayer: (to, event, payload) => sent.push({ to, event, payload }),
    toRoom: (event, payload) => sent.push({ to: "room", event, payload }),
    publicChanged: () => sent.push({ to: "room", event: "public", payload: null }),
    respawn: (playerIds) => respawned.push(playerIds),
  };
  const game = new GameRoom(ids, sender, (id) => positions.get(id), Math.random, () => clock);
  game.dealSecrets();

  const byRole = (role: Role) => [...game.roles].filter(([, r]) => r === role).map(([id]) => id);
  const last = (id: string, event: string) => sent.filter((s) => s.to === id && s.event === event).at(-1)?.payload;
  const all = (id: string, event: string) => sent.filter((s) => s.to === id && s.event === event).map((s) => s.payload);
  const bag = (id: string): string[] => last(id, "game:bag").pieces.map((p: { id: string }) => p.id);
  const walkTo = (id: string, terminalId: string) => {
    const t = TERMINALS.find((x) => x.id === terminalId)!;
    positions.set(id, { x: t.x, z: t.z + 0.9 });
  };
  const pieceIdsOf = (questionIndex: number) => game.pieceIdsOf(game.questions[questionIndex]);
  const spotOf = (pieceId: string) => HIDING_SPOTS.find((s) => s.id === game.spotOfForTests(pieceId))!;
  /** Walk up to where a piece hides and examine it. */
  const grab = (id: string, pieceId: string) => {
    const spot = spotOf(pieceId);
    positions.set(id, { x: spot.x, z: spot.z });
    game.examine(id, spot.id);
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
  const roomLast = (event: string) => sent.filter((x) => x.to === "room" && x.event === event).at(-1)?.payload;
  const toButton = (id: string) => positions.set(id, { x: 10.4, z: 5.6 });
  return { game, sent, byRole, last, all, spotOf, bag, walkTo, pieceIdsOf, grab, solveSetup, advance, positions, roomLast, toButton, respawned, ids };
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
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.pieces).toHaveLength(3);
      expect(q.pieces.every((p) => p.trim().length > 0)).toBe(true);
      expect(q.pieces.join(" ")).toBe(q.prompt);
      expect(q.twistedPrompt).not.toBe(q.prompt);
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      for (const i of [q.correctIndex, q.lieIndex]) expect(Number.isInteger(i) && i >= 0 && i < 4).toBe(true);
      expect(q.lieIndex).not.toBe(q.correctIndex);
      expect(q.hint.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("shared question pieces", () => {
  it("has QUESTIONS_PER_CLASSMATE questions per classmate, each with 3 pieces hidden in 3 different rooms, one per spot, and nothing sent about where", () => {
    // Placement is random, so check many games.
    for (const n of [4, 4, 5, 5].flatMap((x) => Array<number>(20).fill(x))) {
      const { game, sent, spotOf } = setup(n);
      expect(game.questions).toHaveLength((n - 1) * QUESTIONS_PER_CLASSMATE);
      expect(game.hiddenCount()).toBe((n - 1) * QUESTIONS_PER_CLASSMATE * 3);
      const spots = game.questions.flatMap((q) => game.pieceIdsOf(q).map(spotOf));
      expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
      for (const q of game.questions) {
        expect(new Set(game.pieceIdsOf(q).map((id) => spotOf(id).room)).size).toBe(3);
        for (const id of game.pieceIdsOf(q)) expect(id).toMatch(/^piece-\d+$/); // opaque: no question id leaks
      }
      // At the start, players hear only their role and their (empty) bag.
      expect(new Set(sent.map((m) => m.event))).toEqual(new Set(["game:role", "game:bag"]));
    }
  });

  it("examining finds the piece hidden there, only when standing close, or says nothing's there", () => {
    const { game, byRole, bag, grab, last, pieceIdsOf, positions, spotOf } = setup();
    const s = byRole("student")[0];
    const spot = spotOf(pieceIdsOf(0)[0]);
    positions.set(s, { x: spot.x + 3, z: spot.z });
    expect(() => game.examine(s, spot.id)).toThrow("Walk up to it");
    grab(s, pieceIdsOf(0)[0]);
    expect(bag(s)).toEqual([pieceIdsOf(0)[0]]);
    expect(last(s, "spot:result")).toEqual({ spotId: spot.id, piece: { id: pieceIdsOf(0)[0], text: game.questions[0].pieces[0] } });
    // Searching the same spot again: it's empty now.
    game.examine(s, spot.id);
    expect(last(s, "spot:result")).toEqual({ spotId: spot.id, piece: undefined });
    // A spot that never had a piece.
    const used = new Set(game.questions.flatMap((q) => game.pieceIdsOf(q).map((id) => spotOf(id).id)));
    const empty = HIDING_SPOTS.find((h) => !used.has(h.id))!;
    positions.set(s, { x: empty.x, z: empty.z });
    game.examine(s, empty.id);
    expect(last(s, "spot:result").piece).toBeUndefined();
    expect(game.hiddenCount()).toBe(game.questions.length * 3 - 1);
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
    // After a strike the player learns the real answer and why.
    expect(last(s, "terminal:result").truth).toEqual({ answer: game.questions[0].choices[game.questions[0].correctIndex], why: game.questions[0].hint });
    expect(game.strikes).toBe(1);
    expect(bag(s)).toHaveLength(3);

    game.openTerminal(s, "library-1");
    game.arrange(s, pieceIdsOf(0));
    q = last(s, "terminal:question");
    game.answer(s, (q.botPick + 1) % 4);
    expect(last(s, "terminal:result").outcome).toBe("wrong");
    expect(last(s, "terminal:result").truth).toBeUndefined(); // no free answer for the retry
    expect(bag(s)).toHaveLength(3);

    game.openTerminal(s, "library-1");
    game.arrange(s, pieceIdsOf(0));
    game.answer(s, last(s, "terminal:question").botPick);
    expect(last(s, "terminal:result").outcome).toBe("correct");
    expect(last(s, "terminal:result").truth?.why).toBe(game.questions[0].hint);
    expect(bag(s)).toHaveLength(0);
    expect(game.progress).toBe(1);
  });

  it("a leaver's pieces go back to where they were found", () => {
    const { game, byRole, grab, spotOf, pieceIdsOf, positions, last } = setup();
    const [s, other] = byRole("student");
    const spot = spotOf(pieceIdsOf(0)[0]);
    grab(s, pieceIdsOf(0)[0]);
    game.removePlayer(s);
    // It's hidden in the same place again, for the next person to find.
    positions.set(other, { x: spot.x, z: spot.z });
    game.examine(other, spot.id);
    expect(last(other, "spot:result").piece?.id).toBe(pieceIdsOf(0)[0]);
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
    expect(() => game.hack(b, "lab-1")).toThrow(`Hack ready in ${HACK_COOLDOWN_SECONDS}s`);
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
    expect(game.progress).toBe(game.questions.length);
    expect(game.gameOver()?.winner).toBe("class");
    // "Myths busted": every question this game, the myth next to the truth.
    const myths = game.gameOver()!.myths;
    expect(myths).toHaveLength(game.questions.length);
    expect(myths.every((m) => m.solved && m.myth !== m.truth && m.why.length > 0)).toBe(true);
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

describe("vote tally", () => {
  const v = (entries: [string, string | null][]) => tallyVotes(new Map(entries));
  it("kicks out the player with the most votes", () => {
    expect(v([["a", "c"], ["b", "c"], ["c", "a"], ["d", null]]).ejectedId).toBe("c");
  });
  it("a tie ejects nobody", () => {
    expect(v([["a", "c"], ["b", "c"], ["c", "a"], ["d", "a"]]).ejectedId).toBeNull();
  });
  it("skip at least as strong as the leader ejects nobody", () => {
    expect(v([["a", "c"], ["b", null], ["c", null], ["d", "c"]]).ejectedId).toBeNull();
    expect(v([["a", null], ["b", null]]).ejectedId).toBeNull();
  });
  it("counts every vote", () => {
    expect(v([["a", "c"], ["b", "c"], ["c", null]]).counts).toEqual({ c: 2, skip: 1 });
  });
});

describe("meetings", () => {
  it("must be called at the classroom button, once per player, and closes open terminals", () => {
    const { game, byRole, toButton, solveSetup, last } = setup();
    const [s1, s2] = byRole("student");
    expect(() => game.callMeeting(s1)).toThrow("meeting button");
    solveSetup(s2, 0);
    toButton(s1);
    game.callMeeting(s1);
    expect(game.phase).toBe("meeting");
    expect(game.meetingCallerId).toBe(s1);
    expect(game.meetingCallsLeft()[s1]).toBe(0);
    // s2's open question is gone; answering now does nothing.
    game.answer(s2, last(s2, "terminal:question").botPick);
    expect(game.progress).toBe(0);
  });

  it("blocks terminals and pieces during a meeting", () => {
    const { game, byRole, toButton, walkTo } = setup();
    const s = byRole("student")[0];
    toButton(s);
    game.callMeeting(s);
    walkTo(s, "library-1");
    expect(() => game.openTerminal(s, "library-1")).toThrow("Not during a meeting");
  });

  it("chat only works in meetings, for living players, and is trimmed to 140 characters", () => {
    const { game, byRole, toButton, roomLast } = setup();
    const s = byRole("student")[0];
    expect(() => game.chat(s, "hi")).toThrow("Chat opens during meetings");
    toButton(s);
    game.callMeeting(s);
    game.chat(s, "x".repeat(200));
    expect(roomLast("chat:message")).toEqual({ fromId: s, text: "x".repeat(140) });
  });

  it("voting out the Bluffer shows the result, then the class wins", () => {
    const { game, byRole, toButton, roomLast, advance, ids } = setup();
    const b = byRole("bluffer")[0];
    toButton(ids[0]);
    game.callMeeting(ids[0]);
    for (const id of ids) game.vote(id, id === b ? ids.find((x) => x !== b)! : b);
    expect(game.phase).toBe("voteResult");
    expect(roomLast("vote:result")).toMatchObject({ ejectedId: b, wasBluffer: true });
    expect(game.over).toBe(false); // the result is on screen first
    advance(6_000);
    game.tick();
    expect(game.gameOver()?.winner).toBe("class");
    expect(game.gameOver()?.reason).toContain("kicked out of school");
  });

  it("voting out an innocent continues the game and sends everyone back to class", () => {
    const { game, byRole, toButton, roomLast, advance, respawned, ids } = setup();
    const [s1] = byRole("student");
    toButton(ids[0]);
    game.callMeeting(ids[0]);
    for (const id of ids) game.vote(id, id === s1 ? null : s1);
    expect(roomLast("vote:result")).toMatchObject({ ejectedId: s1, wasBluffer: false });
    expect(game.isAlive(s1)).toBe(false);
    advance(6_000);
    game.tick();
    expect(game.over).toBe(false);
    expect(game.phase).toBe("playing");
    expect(respawned.at(-1)).toHaveLength(3);
    expect(() => game.vote(s1, null)).toThrow();
  });

  it("a meeting ends when time runs out, and ejected players can't vote or chat", () => {
    const { game, byRole, toButton, roomLast, advance, ids } = setup();
    toButton(ids[0]);
    game.callMeeting(ids[0]);
    game.vote(ids[0], ids[1]);
    advance(90_000);
    game.tick();
    expect(roomLast("vote:result").ejectedId).toBe(ids[1]);
    expect(() => game.chat(ids[1], "hello")).toThrow();
    void byRole;
  });

  it("the Bluffer wins once only they and one classmate are left", () => {
    const { game, byRole, toButton, advance } = setup();
    const b = byRole("bluffer")[0];
    const innocents = [...byRole("student"), ...byRole("factChecker")];
    for (let round = 0; round < 2; round++) {
      const caller = innocents.find((id) => game.isAlive(id) && game.meetingCallsLeft()[id] > 0)!;
      toButton(caller);
      game.callMeeting(caller);
      const victim = innocents.find((id) => game.isAlive(id))!;
      for (const id of game.aliveIds()) game.vote(id, victim);
      advance(6_000);
      game.tick();
    }
    expect(game.gameOver()?.winner).toBe("bluffer");
    expect(game.isAlive(b)).toBe(true);
  });

  it("a disconnect during a meeting doesn't hold up the vote", () => {
    const { game, toButton, roomLast, ids } = setup();
    toButton(ids[0]);
    game.callMeeting(ids[0]);
    game.vote(ids[0], null);
    game.vote(ids[1], null);
    game.vote(ids[2], null);
    game.removePlayer(ids[3]);
    expect(roomLast("vote:result")?.ejectedId ?? null).toBeNull();
  });
});

describe("role reveal", () => {
  it("blocks pieces and terminals until class starts", () => {
    const { game, grab, ids, pieceIdsOf } = setup();
    game.beginReveal(20_000);
    expect(game.phase).toBe("reveal");
    expect(() => grab(ids[0], pieceIdsOf(0)[0])).toThrow("Class hasn't started yet.");
  });

  it("starts class as soon as everyone is ready, counting bots and leavers", () => {
    const { game, ids } = setup();
    game.beginReveal(20_000, [ids[3]]);
    game.markReady(ids[0]);
    game.markReady(ids[1]);
    expect(game.phase).toBe("reveal");
    expect(game.readyIds().sort()).toEqual([ids[0], ids[1], ids[3]].sort());
    game.removePlayer(ids[2]);
    expect(game.phase).toBe("playing");
    expect(game.readyIds()).toEqual([]);
  });

  it("starts class when time runs out, even if someone never closed their book", () => {
    const { game, advance, ids } = setup();
    game.beginReveal(20_000);
    game.markReady(ids[0]);
    advance(19_000);
    game.tick();
    expect(game.phase).toBe("reveal");
    expect(game.phaseMsLeft()).toBe(1_000);
    advance(1_000);
    game.tick();
    expect(game.phase).toBe("playing");
  });
});

describe("expel", () => {
  /** The Bluffer and a classmate alone in the gym; everyone else far away behind walls. */
  function alone(n = 4) {
    const t = setup(n);
    const b = t.byRole("bluffer")[0];
    const others = t.ids.filter((id) => id !== b);
    const [victim, ...rest] = others;
    t.positions.set(b, { x: 30, z: 4 });
    t.positions.set(victim, { x: 31, z: 4 });
    t.positions.set(rest[0], { x: 2, z: 4 }); // Class 7A
    t.positions.set(rest[1], { x: 42, z: 15 }); // Art Room
    for (const id of rest.slice(2)) t.positions.set(id, { x: 8, z: 15 }); // Science Lab
    return { ...t, b, victim, rest };
  }

  it("works only for the Bluffer, right next to a classmate, and tells anyone who saw it", () => {
    const { game, b, victim, rest, positions, last } = alone();
    expect(() => game.expel(rest[0], victim)).toThrow("Only the Bluffer");
    positions.set(victim, { x: 34, z: 4 });
    expect(() => game.expel(b, victim)).toThrow("Get right next to them");
    positions.set(victim, { x: 31, z: 4 });
    positions.set(rest[0], { x: 33, z: 6 }); // a witness walks into the gym
    game.expel(b, victim);
    // Like Among Us, it still works, but the witness knows exactly what they saw.
    expect(last(rest[0], "expel:witnessed")).toEqual({ blufferId: b, victimId: victim });
    expect(last(rest[1], "expel:witnessed")).toBeUndefined();
    expect(game.isAlive(victim)).toBe(false);
    expect(game.outOf(victim)).toBe("expelled");
    expect(game.slips).toEqual([{ id: expect.any(String), victimId: victim, x: 31, z: 4 }]);
  });

  it("has a cooldown, and stays locked for the first moments of class", () => {
    const { game, b, victim, rest, positions, advance } = alone(5);
    game.beginReveal(0);
    game.tick(); // class starts
    expect(() => game.expel(b, victim)).toThrow(`Expel ready in ${EXPEL_GRACE_SECONDS}s`);
    advance(EXPEL_GRACE_SECONDS * 1000);
    game.expel(b, victim);
    positions.set(rest[0], { x: 31, z: 4 }); // the next classmate wanders into the gym alone
    positions.set(rest[1], { x: 2, z: 6 });
    expect(() => game.expel(b, rest[0])).toThrow("Expel ready in");
  });

  it("finding the slip starts a meeting about it, and clears the slips", () => {
    const { game, b, victim, rest, positions, roomLast } = alone();
    game.expel(b, victim);
    const slip = game.slips[0];
    positions.set(rest[1], { x: slip.x + 3, z: slip.z });
    expect(() => game.reportSlip(rest[1], slip.id)).toThrow("Walk onto the slip");
    positions.set(rest[1], { x: slip.x, z: slip.z + 0.5 });
    game.reportSlip(rest[1], slip.id);
    expect(game.phase).toBe("meeting");
    expect(game.meetingReport).toEqual({ victimId: victim, finderId: rest[1], room: "Gym", x: slip.x, z: slip.z });
    expect(game.slips).toEqual([]);
    // Expelled players can't vote or chat.
    expect(() => game.vote(victim, null)).toThrow();
    expect(() => game.chat(victim, "it was them")).toThrow();
    expect(roomLast("public")).toBeNull();
  });

  it("hall monitors only watch: their pieces go back, and they can't search or use terminals", () => {
    const { game, b, victim, bag, grab, spotOf, pieceIdsOf, positions, walkTo } = alone();
    grab(victim, pieceIdsOf(0)[0]);
    positions.set(victim, { x: 31, z: 4 });
    game.expel(b, victim);
    expect(bag(victim)).toEqual([]);
    expect(game.hiddenCount()).toBe(game.questions.length * 3);
    const spot = spotOf(pieceIdsOf(0)[1]);
    positions.set(victim, { x: spot.x, z: spot.z });
    expect(() => game.examine(victim, spot.id)).toThrow();
    walkTo(victim, "library-1");
    expect(() => game.openTerminal(victim, "library-1")).toThrow();
  });

  it("allows players minus 3 expels (1 with 4 players, 2 with 5), so winning also takes a wrong vote", () => {
    for (const n of [4, 5]) {
      const { game, b, victim, rest, positions, advance } = alone(n);
      game.expel(b, victim);
      // The next classmate wanders into the gym alone; everyone else stays far away.
      advance(EXPEL_COOLDOWN_SECONDS * 1000);
      positions.set(rest[0], { x: 31, z: 4 });
      positions.set(rest[1], { x: 2, z: 4 });
      if (n === 4) {
        expect(() => game.expel(b, rest[0])).toThrow("used all your expels");
      } else {
        game.expel(b, rest[0]);
        advance(EXPEL_COOLDOWN_SECONDS * 1000);
        positions.set(rest[1], { x: 31, z: 4 });
        expect(() => game.expel(b, rest[1])).toThrow("used all your expels");
      }
    }
  });

  it("the Bluffer wins when only they and one classmate are left", () => {
    const { game, b, victim, rest } = alone();
    game.expel(b, victim);
    game.removePlayer(rest[0]); // e.g. voted out by mistake (here: leaves)
    expect(game.gameOver()?.winner).toBe("bluffer");
  });
});

describe("game over", () => {
  it("lists everyone, says when the Bluffer left, and marks who left", () => {
    const { game, byRole } = setup();
    const b = byRole("bluffer")[0];
    game.removePlayer(b);
    const over = game.gameOver()!;
    expect(over.winner).toBe("class");
    expect(over.reason).toBe("The Bluffer left the game.");
    expect(Object.keys(over.roles)).toHaveLength(4);
    expect(over.out[b]).toBe("left");
  });
});
