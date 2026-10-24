// The referee for one game (spec.md > Game Server > game/GameRoom.ts).
// Holds the secret state and decides every outcome. It talks to players only
// through the Sender, so tests can record messages without sockets.

import {
  BLUFFER_MAX_PIECES,
  CHAT_MAX_LENGTH,
  DOUBLE_CHECK_COST_SECONDS,
  EXPEL_COOLDOWN_SECONDS,
  EXPEL_GRACE_SECONDS,
  EXPEL_RADIUS,
  HACK_COOLDOWN_SECONDS,
  INTERACT_RADIUS,
  MEETING_CALLS_PER_PLAYER,
  MEETING_SECONDS,
  QUESTION_SECONDS,
  QUESTIONS_PER_CLASSMATE,
  SLIP_REPORT_RADIUS,
  VOTE_RESULT_SECONDS,
} from "@whtb/shared/constants";
import type { ServerToClientEvents } from "@whtb/shared/events";
import { distance, nearMeetingButton } from "@whtb/shared/geometry";
import { TERMINALS, roomAt, type Point } from "@whtb/shared/map";
import { EXAMINE_RADIUS, HIDING_SPOTS, PIECE_ROOMS } from "@whtb/shared/pieces";
import { QUESTIONS, type Question } from "@whtb/shared/questions";
import type { AnswerOutcome, ArrangeCard, ErrorCode, GameOver, PublicPlayer, Role, Slip } from "@whtb/shared/types";
import { canSee } from "@whtb/shared/vision";
import { assignRoles, checkWinner, shuffle, tallyVotes, type Random, type WinResult } from "./rules";

/** Where the game is between start and game over. */
export type GamePhase = "reveal" | "playing" | "meeting" | "voteResult";

type Event = keyof ServerToClientEvents;
type Payload<E extends Event> = Parameters<ServerToClientEvents[E]>[0];

export interface Sender {
  toPlayer<E extends Event>(playerId: string, event: E, payload: Payload<E>): void;
  toRoom<E extends Event>(event: E, payload: Payload<E>): void;
  /** Called whenever public state (strikes, progress, alive, phase) changes. */
  publicChanged(): void;
  /** After a meeting: put living players back on their classroom seats. */
  respawn(playerIds: string[]): void;
}

/** A piece is hidden in its home spot, in someone's bag, or used up. */
interface Piece {
  id: string;
  question: Question;
  /** 0, 1, 2: reading order within its question. */
  index: number;
  text: string;
  /** The hiding spot (shared/pieces.ts) it hides in, and goes back to if its holder leaves. */
  home: string;
  holderId?: string;
  used: boolean;
}

interface OpenTerminal {
  stage: "arrange" | "answer";
  terminalId: string;
  /** Pool snapshot taken when Use was pressed (pieces of classmates standing here). */
  pool: string[];
  /** The 3 pieces the question was built from; empty for the Bluffer's fake question. */
  pieceIds: string[];
  question?: Question;
  choiceOrder: number[];
  botPick: number;
  correct: number;
  hacked: boolean;
  deadline: number;
  doubleChecked: boolean;
}

export class ActionError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class GameRoom {
  readonly roles: Map<string, Role>;
  readonly questions: Question[];
  private pieces = new Map<string, Piece>();
  private solved = new Set<string>();
  private alive: Set<string>;
  private open = new Map<string, OpenTerminal>();
  private hacked = new Set<string>();
  private hackReadyAt = 0;
  private verifyUsed = false;
  private meetingCalls = new Map<string, number>();
  private votes = new Map<string, string | null>();
  /** Who has closed their role book (role reveal only). */
  private ready = new Set<string>();
  private phaseEndsAt = 0;
  phase: GamePhase = "playing";
  meetingCallerId: string | undefined;
  /** Set when the meeting started from a reported expulsion slip. */
  meetingReport: { victimId: string; finderId: string; room: string; x: number; z: number } | undefined;
  /** Expulsion slips waiting to be found. */
  slips: Slip[] = [];
  /** Why each player is out of class (voted, expelled, or left). */
  private outReason = new Map<string, NonNullable<PublicPlayer["out"]>>();
  private expelReadyAt = 0;
  /** Who saw the latest expel (practice bots read this, like players read their message). */
  lastExpelWitnesses: string[] = [];
  /**
   * The Bluffer may expel at most (players - 3) classmates: 1 with 4 players, 2 with 5.
   * Winning by elimination then always also takes a wrong vote, so the class always
   * gets a meeting to catch them first.
   */
  private expelsLeft: number;
  private slipCount = 0;
  /** Terminals where a trusted lie caused a strike, in order (practice bots use this as a clue). */
  readonly strikeTerminals: string[] = [];
  strikes = 0;
  result: WinResult | undefined;

  constructor(
    playerIds: string[],
    private send: Sender,
    private positionOf: (playerId: string) => Point | undefined,
    private random: Random = Math.random,
    private now: () => number = Date.now,
    fixedRoles?: ReadonlyMap<string, Role>,
  ) {
    this.roles = assignRoles(playerIds, random, fixedRoles);
    this.expelsLeft = Math.max(0, playerIds.length - 3);
    this.alive = new Set(playerIds);
    playerIds.forEach((id) => this.meetingCalls.set(id, MEETING_CALLS_PER_PLAYER));
    const classmates = playerIds.length - 1;
    this.questions = shuffle(QUESTIONS, random).slice(0, classmates * QUESTIONS_PER_CLASSMATE);

    // Each question's 3 pieces start in three different rooms. Piece ids are
    // opaque so they never hint which question a piece belongs to.
    let freeSpots = shuffle(HIDING_SPOTS, random);
    const idNumbers = shuffle([...Array(this.questions.length * 3).keys()], random);
    for (const question of this.questions) {
      // The 3 rooms with the most free spots left (a little shuffled), so pieces spread
      // evenly and no room runs out even when the school is nearly full.
      const rooms = PIECE_ROOMS.map((r) => ({ r, free: freeSpots.filter((s) => s.room === r).length + random() * 1.5 }))
        .sort((a, b) => b.free - a.free)
        .slice(0, question.pieces.length)
        .map((o) => o.r);
      question.pieces.forEach((text, index) => {
        const spot = freeSpots.find((s) => s.room === rooms[index]) ?? freeSpots[0];
        freeSpots = freeSpots.filter((s) => s !== spot);
        const id = `piece-${idNumbers.pop()}`;
        this.pieces.set(id, { id, question, index, text, home: spot.id, used: false });
      });
    }
  }

  /** Tell each player, privately, their role. Where pieces hide stays secret. */
  dealSecrets(): void {
    for (const [id, role] of this.roles) {
      this.send.toPlayer(id, "game:role", { role });
      this.sendBag(id);
    }
  }

  get over(): boolean {
    return this.result !== undefined;
  }

  get progress(): number {
    return this.solved.size;
  }

  goal(): number {
    return this.questions.length;
  }

  isAlive(id: string): boolean {
    return this.alive.has(id);
  }

  outOf(id: string): PublicPlayer["out"] {
    return this.outReason.get(id);
  }

  aliveIds(): string[] {
    return [...this.alive];
  }

  votedIds(): string[] {
    return this.phase === "meeting" ? [...this.votes.keys()] : [];
  }

  readyIds(): string[] {
    return this.phase === "reveal" ? [...this.ready] : [];
  }

  meetingCallsLeft(): Record<string, number> {
    return Object.fromEntries(this.meetingCalls);
  }

  phaseMsLeft(): number | undefined {
    return this.phase === "playing" ? undefined : Math.max(0, this.phaseEndsAt - this.now());
  }

  private blufferId(): string {
    return [...this.roles].find(([, r]) => r === "bluffer")![0];
  }

  private bagOf(playerId: string): Piece[] {
    return [...this.pieces.values()].filter((p) => p.holderId === playerId && !p.used);
  }

  private card(p: Piece): ArrangeCard {
    return { id: p.id, text: p.text };
  }

  private sendBag(playerId: string): void {
    this.send.toPlayer(playerId, "game:bag", { pieces: this.bagOf(playerId).map((p) => this.card(p)) });
  }

  private requireLiving(playerId: string): Role {
    const role = this.roles.get(playerId);
    if (!role || !this.alive.has(playerId) || this.over) throw new ActionError("NOT_ALLOWED", "You can't do that right now.");
    return role;
  }

  /** Terminal and piece actions only happen while everyone is walking around. */
  private requirePlaying(playerId: string): Role {
    const role = this.requireLiving(playerId);
    if (this.phase === "reveal") throw new ActionError("NOT_ALLOWED", "Class hasn't started yet.");
    if (this.phase !== "playing") throw new ActionError("NOT_ALLOWED", "Not during a meeting.");
    return role;
  }

  private terminalNear(playerId: string, terminalId: string): boolean {
    const t = TERMINALS.find((x) => x.id === terminalId);
    const pos = this.positionOf(playerId);
    return Boolean(t && pos && distance(pos, t) <= INTERACT_RADIUS + 0.2);
  }

  private requireNear(playerId: string, terminalId: string): void {
    if (!this.terminalNear(playerId, terminalId)) throw new ActionError("TOO_FAR", "Walk closer to the terminal.");
  }

  /** Pieces in play right now at another open terminal can't be pooled twice. */
  private reserved(): Set<string> {
    return new Set([...this.open.values()].flatMap((o) => o.pool));
  }

  /** Search an object for a hidden piece: the player finds it, or "nothing here". */
  examine(playerId: string, spotId: string): void {
    const role = this.requirePlaying(playerId);
    const spot = HIDING_SPOTS.find((s) => s.id === spotId);
    const pos = this.positionOf(playerId);
    if (!spot || !pos || distance(pos, spot) > EXAMINE_RADIUS + 0.4) throw new ActionError("TOO_FAR", "Walk up to it to examine it.");
    const piece = [...this.pieces.values()].find((p) => p.home === spotId && !p.used && !p.holderId);
    if (piece && role === "bluffer" && this.bagOf(playerId).length >= BLUFFER_MAX_PIECES) {
      throw new ActionError("HANDS_FULL", `Your hands are full (${BLUFFER_MAX_PIECES} pieces).`);
    }
    if (piece) {
      piece.holderId = playerId;
      this.sendBag(playerId);
    }
    this.send.toPlayer(playerId, "spot:result", { spotId, piece: piece && this.card(piece) });
  }

  /**
   * Pieces held by everyone alive standing at this terminal. The Bluffer's pieces
   * pool like anyone's, so a "prove it at the terminal" test can't expose them.
   */
  private poolAt(terminalId: string): string[] {
    const reserved = this.reserved();
    return [...this.pieces.values()]
      .filter(
        (p) =>
          !p.used &&
          p.holderId !== undefined &&
          this.alive.has(p.holderId) &&
          this.terminalNear(p.holderId, terminalId) &&
          !reserved.has(p.id),
      )
      .map((p) => p.id);
  }

  openTerminal(playerId: string, terminalId: string): void {
    const role = this.requirePlaying(playerId);
    this.requireNear(playerId, terminalId);
    if (this.open.has(playerId)) return;

    const pool = this.poolAt(terminalId);
    if (pool.length < 3) {
      throw new ActionError("NO_TASK_HERE", `Need at least 3 pieces here (${pool.length} so far). Bring classmates with pieces!`);
    }
    // A hack is used up by the next classmate at that terminal, never by the Bluffer.
    const hacked = role !== "bluffer" && this.hacked.delete(terminalId);
    if (hacked) this.send.toPlayer(this.blufferId(), "terminal:hackUsed", { terminalId });
    const open = this.newOpen(terminalId, pool, hacked);
    this.open.set(playerId, open);
    const cards = shuffle(pool, this.random).map((id) => this.card(this.pieces.get(id)!));
    this.send.toPlayer(playerId, "terminal:arrange", { terminalId, cards, msLeft: open.deadline - this.now() });
  }

  private newOpen(terminalId: string, pool: string[], hacked: boolean): OpenTerminal {
    return {
      stage: "arrange",
      terminalId,
      pool,
      pieceIds: [],
      choiceOrder: [0, 1, 2, 3],
      botPick: 0,
      correct: 0,
      hacked,
      deadline: this.now() + QUESTION_SECONDS * 1000,
      doubleChecked: false,
    };
  }

  private setChoices(open: OpenTerminal, question: Question): void {
    // Shuffle the options so the right answer isn't always in the same spot.
    open.choiceOrder = shuffle([0, 1, 2, 3], this.random);
    open.correct = open.choiceOrder.indexOf(question.correctIndex);
    open.botPick = open.hacked ? open.choiceOrder.indexOf(question.lieIndex) : open.correct;
  }

  /** A question's 3 piece ids in reading order. */
  pieceIdsOf(question: Question): string[] {
    return [...this.pieces.values()]
      .filter((p) => p.question === question)
      .sort((a, b) => a.index - b.index)
      .map((p) => p.id);
  }

  /** The 3 pieces form one question, in reading order. */
  private questionFrom(ids: string[]): Question | undefined {
    if (ids.length !== 3) return undefined;
    const ps = ids.map((id) => this.pieces.get(id));
    if (ps.some((p) => !p)) return undefined;
    const q = ps[0]!.question;
    return ps.every((p, i) => p!.question === q && p!.index === i) ? q : undefined;
  }

  /** The player picked 3 pool pieces and put them in order. */
  arrange(playerId: string, order: string[]): void {
    this.requireLiving(playerId);
    const open = this.open.get(playerId);
    if (!open || open.stage !== "arrange") return;
    const inPool = Array.isArray(order) && order.every((id) => open.pool.includes(id));
    const question = inPool ? this.questionFrom(order) : undefined;
    if (!question) return void this.send.toPlayer(playerId, "terminal:arrangeWrong", undefined);
    open.question = question;
    open.pieceIds = [...order];
    this.setChoices(open, question);
    this.reveal(playerId, open, "you");
  }

  /** Study-Bot arranges a full question from the pool; if hacked, into a believable wrong one. */
  botArrange(playerId: string): void {
    this.requireLiving(playerId);
    const open = this.open.get(playerId);
    if (!open || open.stage !== "arrange") return;
    const full = this.questions.find((q) => this.pieceIdsOf(q).every((id) => open.pool.includes(id)));
    if (!full) throw new ActionError("NOT_ALLOWED", "Study-Bot: “Not enough pieces here for a full question yet.”");
    open.question = full;
    open.pieceIds = this.pieceIdsOf(full);
    this.setChoices(open, full);
    this.reveal(playerId, open, "studybot");
  }

  private reveal(playerId: string, open: OpenTerminal, arrangedBy: "you" | "studybot" | "none"): void {
    open.stage = "answer";
    const q = open.question!;
    this.send.toPlayer(playerId, "terminal:question", {
      terminalId: open.terminalId,
      subject: q.subject,
      prompt: arrangedBy === "studybot" && open.hacked ? q.twistedPrompt : q.prompt,
      arrangedBy,
      pieces: open.pieceIds.map((id) => this.pieces.get(id)!.text),
      choices: open.choiceOrder.map((i) => q.choices[i]),
      botPick: open.botPick,
      confidence: 92 + Math.floor(this.random() * 8),
      msLeft: open.deadline - this.now(),
    });
  }

  doubleCheck(playerId: string): void {
    this.requireLiving(playerId);
    const q = this.open.get(playerId);
    if (!q || q.stage !== "answer" || q.doubleChecked) return;
    q.doubleChecked = true;
    q.deadline = Math.max(this.now() + 1000, q.deadline - DOUBLE_CHECK_COST_SECONDS * 1000);
    this.send.toPlayer(playerId, "terminal:hint", { hint: q.question!.hint, msLeft: q.deadline - this.now() });
  }

  verify(playerId: string): void {
    const role = this.requireLiving(playerId);
    if (role !== "factChecker") throw new ActionError("NOT_ALLOWED", "Only the Fact-Checker can verify.");
    if (this.verifyUsed) throw new ActionError("NOT_ALLOWED", "You already used your one Verify.");
    const q = this.open.get(playerId);
    if (!q || q.stage !== "answer") throw new ActionError("NOT_ALLOWED", "Open a terminal question first.");
    this.verifyUsed = true;
    this.send.toPlayer(playerId, "terminal:verifyResult", { botIsRight: q.botPick === q.correct });
  }

  hack(playerId: string, terminalId: string): void {
    const role = this.requirePlaying(playerId);
    if (role !== "bluffer") throw new ActionError("NOT_ALLOWED", "Only the Bluffer can hack.");
    this.requireNear(playerId, terminalId);
    const waitMs = this.hackReadyAt - this.now();
    if (waitMs > 0) throw new ActionError("COOLDOWN", `Hack ready in ${Math.ceil(waitMs / 1000)}s.`);
    if (this.hacked.has(terminalId)) throw new ActionError("NOT_ALLOWED", "This terminal is already hacked.");
    this.hacked.add(terminalId);
    this.hackReadyAt = this.now() + HACK_COOLDOWN_SECONDS * 1000;
    this.send.toPlayer(playerId, "terminal:hacked", { terminalId, cooldownMs: HACK_COOLDOWN_SECONDS * 1000 });
  }

  answer(playerId: string, choiceIndex: number | null): void {
    const role = this.requireLiving(playerId);
    const q = this.open.get(playerId);
    if (!q) return;
    // Answers only count once the question is arranged; a timeout (null) ends either stage.
    if (q.stage !== "answer" && choiceIndex !== null) return;
    this.open.delete(playerId);

    // The Bluffer can blend in by answering (a correct answer still helps the
    // class), but can never cause a strike by trusting their own lie.
    let outcome: AnswerOutcome;
    if (q.stage === "answer" && choiceIndex === q.correct) outcome = "correct";
    else if (q.stage === "answer" && q.hacked && role !== "bluffer" && choiceIndex === q.botPick) outcome = "strike";
    else outcome = "wrong";

    if (outcome === "correct") {
      // Those 3 pieces are used up, whoever brought them.
      const holders = new Set<string>();
      for (const id of q.pieceIds) {
        const p = this.pieces.get(id)!;
        if (p.holderId) holders.add(p.holderId);
        p.used = true;
        p.holderId = undefined;
      }
      this.solved.add(q.question!.id);
      holders.forEach((h) => this.sendBag(h));
    } else if (outcome === "strike") {
      this.strikes++;
      this.strikeTerminals.push(q.terminalId);
    }
    // Anything but correct: the pieces simply stay in their owners' bags.
    // A settled question shows the truth; a plain wrong answer doesn't, since it can be retried.
    const question = q.question;
    const truth = question && outcome !== "wrong" ? { answer: question.choices[question.correctIndex], why: question.hint } : undefined;
    this.send.toPlayer(playerId, "terminal:result", { outcome, truth });
    this.send.publicChanged();
    this.checkWin();
  }

  // --- Read-only views for practice bots (server/src/bots.ts) ---

  /** How many pieces are still hidden (not where: bots have to search like everyone). */
  hiddenCount(): number {
    return [...this.pieces.values()].filter((p) => !p.used && !p.holderId).length;
  }

  /** Where a piece hides. For tests only; nothing in play may ask this. */
  spotOfForTests(pieceId: string): string | undefined {
    return this.pieces.get(pieceId)?.home;
  }

  bagIds(playerId: string): string[] {
    return this.bagOf(playerId).map((p) => p.id);
  }

  /** What the pieces in someone's bag say (practice bots can tell you in a meeting). */
  bagTexts(playerId: string): string[] {
    return this.bagOf(playerId).map((p) => p.text);
  }

  /** A class question whose 3 pieces are all among these ids, if any. */
  fullQuestionIn(ids: string[]): Question | undefined {
    return this.questions.find((q) => !this.solved.has(q.id) && this.pieceIdsOf(q).every((id) => ids.includes(id)));
  }

  hasOpenTerminal(playerId: string): boolean {
    return this.open.has(playerId);
  }

  /** Terminals the Bluffer has hacked that nobody has used yet (the Bluffer sees these too). */
  hackedTerminals(): string[] {
    return [...this.hacked];
  }

  /** Bluffer only (bots): whether Expel is off cooldown. */
  expelReady(): boolean {
    return this.expelsLeft > 0 && this.now() >= this.expelReadyAt;
  }

  /** How many more classmates the Bluffer may expel this game. */
  expelsRemaining(): number {
    return this.expelsLeft;
  }

  hackReady(): boolean {
    return this.now() >= this.hackReadyAt;
  }

  hasVoted(playerId: string): boolean {
    return this.votes.has(playerId);
  }

  /** A bot answers its open question: trusting Study-Bot's pick, or checking and picking right. */
  botAnswer(playerId: string, trust: boolean): void {
    const q = this.open.get(playerId);
    if (!q || q.stage !== "answer") return;
    this.answer(playerId, trust ? q.botPick : q.correct);
  }

  /** Leave the terminal without answering: no strike, no progress, pieces stay put. */
  close(playerId: string): void {
    this.open.delete(playerId);
  }

  // --- Meetings (prd.md > Meetings and Voting) ---

  callMeeting(playerId: string): void {
    this.requirePlaying(playerId);
    const pos = this.positionOf(playerId);
    if (!pos || !nearMeetingButton(pos)) throw new ActionError("TOO_FAR", "Walk to the meeting button in the classroom.");
    if ((this.meetingCalls.get(playerId) ?? 0) <= 0) throw new ActionError("NOT_ALLOWED", "You already used your meeting.");
    this.meetingCalls.set(playerId, this.meetingCalls.get(playerId)! - 1);
    this.startMeeting(playerId);
  }

  private startMeeting(callerId: string, report?: { victimId: string; finderId: string; room: string; x: number; z: number }): void {
    // Everyone stops what they're doing; open terminals close with nothing lost.
    this.open.clear();
    this.votes.clear();
    this.phase = "meeting";
    this.meetingCallerId = callerId;
    this.meetingReport = report;
    // Any slips still lying around are cleared away with the meeting.
    this.slips = [];
    this.phaseEndsAt = this.now() + MEETING_SECONDS * 1000;
    this.send.publicChanged();
  }

  // --- Expel: the Bluffer's elimination power ---

  /** Whether any classmate other than these two can see either of them. */
  /** Classmates (other than these two) who can see either of them right now. */
  witnessesOf(blufferId: string, targetId: string): string[] {
    const a = this.positionOf(blufferId);
    const b = this.positionOf(targetId);
    if (!a || !b) return [];
    return this.aliveIds().filter((id) => {
      if (id === blufferId || id === targetId) return false;
      const w = this.positionOf(id);
      return Boolean(w && (canSee(w, a) || canSee(w, b)));
    });
  }

  /**
   * Bluffer only: expel the classmate next to them. Like Among Us, it works even if
   * someone is watching; that's the Bluffer's gamble, and witnesses are told what they saw.
   */
  expel(playerId: string, targetId: string): void {
    const role = this.requirePlaying(playerId);
    if (role !== "bluffer") throw new ActionError("NOT_ALLOWED", "Only the Bluffer can expel.");
    if (targetId === playerId || !this.alive.has(targetId)) throw new ActionError("NOT_ALLOWED", "You can't expel them.");
    if (this.expelsLeft <= 0) throw new ActionError("NOT_ALLOWED", "You've used all your expels.");
    const wait = this.expelReadyAt - this.now();
    if (wait > 0) throw new ActionError("COOLDOWN", `Expel ready in ${Math.ceil(wait / 1000)}s.`);
    const me = this.positionOf(playerId);
    const them = this.positionOf(targetId);
    if (!me || !them || distance(me, them) > EXPEL_RADIUS + 0.3) throw new ActionError("TOO_FAR", "Get right next to them.");
    const witnesses = this.witnessesOf(playerId, targetId);

    // They become a hall monitor who can only watch; their pieces go back where they were found.
    this.expelsLeft--;
    this.eject(targetId);
    this.outReason.set(targetId, "expelled");
    this.sendBag(targetId);
    this.slips.push({ id: `slip-${++this.slipCount}`, victimId: targetId, x: them.x, z: them.z });
    this.expelReadyAt = this.now() + EXPEL_COOLDOWN_SECONDS * 1000;
    this.send.toPlayer(playerId, "expel:cooldown", { msLeft: EXPEL_COOLDOWN_SECONDS * 1000 });
    for (const w of witnesses) this.send.toPlayer(w, "expel:witnessed", { blufferId: playerId, victimId: targetId });
    this.lastExpelWitnesses = witnesses;
    this.send.publicChanged();
    this.checkWin();
  }

  /** A living classmate walked onto an expulsion slip: everyone meets about it. */
  reportSlip(playerId: string, slipId: string): void {
    this.requirePlaying(playerId);
    const slip = this.slips.find((s) => s.id === slipId);
    if (!slip) return;
    const pos = this.positionOf(playerId);
    if (!pos || distance(pos, slip) > SLIP_REPORT_RADIUS + 0.4) throw new ActionError("TOO_FAR", "Walk onto the slip to report it.");
    const room = roomAt(slip)?.name ?? "Hallway";
    this.startMeeting(playerId, { victimId: slip.victimId, finderId: playerId, room, x: slip.x, z: slip.z });
  }

  chat(playerId: string, rawText: unknown): void {
    this.requireLiving(playerId);
    if (this.phase !== "meeting") throw new ActionError("NOT_ALLOWED", "Chat opens during meetings.");
    const text = typeof rawText === "string" ? rawText.trim().slice(0, CHAT_MAX_LENGTH) : "";
    if (!text) return;
    this.send.toRoom("chat:message", { fromId: playerId, text });
  }

  vote(playerId: string, targetId: string | null): void {
    this.requireLiving(playerId);
    if (this.phase !== "meeting") throw new ActionError("NOT_ALLOWED", "You can only vote in a meeting.");
    if (this.votes.has(playerId)) throw new ActionError("NOT_ALLOWED", "You already voted.");
    if (targetId !== null && !this.alive.has(targetId)) throw new ActionError("NOT_ALLOWED", "That player is not in the meeting.");
    this.votes.set(playerId, targetId);
    this.send.publicChanged();
    if ([...this.alive].every((id) => this.votes.has(id))) this.endMeeting();
  }

  private endMeeting(): void {
    const { ejectedId, counts } = tallyVotes(this.votes);
    const wasBluffer = ejectedId !== null && this.roles.get(ejectedId) === "bluffer";
    if (ejectedId) {
      this.eject(ejectedId);
      this.outReason.set(ejectedId, "voted");
    }
    this.phase = "voteResult";
    this.phaseEndsAt = this.now() + VOTE_RESULT_SECONDS * 1000;
    this.send.toRoom("vote:result", { ejectedId, wasBluffer, counts });
    this.send.publicChanged();
  }

  // --- Role reveal: everyone reads their book before class starts ---

  /** Start the game with the role books open. Practice bots are ready at once. */
  beginReveal(ms: number, readyIds: string[] = []): void {
    this.phase = "reveal";
    this.phaseEndsAt = this.now() + ms;
    this.ready = new Set(readyIds.filter((id) => this.alive.has(id)));
    this.endRevealIfAllReady();
  }

  /** A player closed their book. Class starts when everyone has. */
  markReady(playerId: string): void {
    this.requireLiving(playerId);
    if (this.phase !== "reveal") return;
    this.ready.add(playerId);
    this.send.publicChanged();
    this.endRevealIfAllReady();
  }

  private endRevealIfAllReady(): void {
    if (this.phase === "reveal" && [...this.alive].every((id) => this.ready.has(id))) this.endReveal();
  }

  private endReveal(): void {
    this.phase = "playing";
    this.ready.clear();
    // Expel stays locked for the first moments of class.
    this.expelReadyAt = this.now() + EXPEL_GRACE_SECONDS * 1000;
    this.send.toPlayer(this.blufferId(), "expel:cooldown", { msLeft: EXPEL_GRACE_SECONDS * 1000 });
    this.send.publicChanged();
  }

  /** After the result has been on screen: game over, or back to class. */
  private endVoteResult(): void {
    this.votes.clear();
    this.meetingCallerId = undefined;
    this.meetingReport = undefined;
    this.phase = "playing";
    this.checkWin();
    if (this.over) return;
    this.send.respawn(this.aliveIds());
    this.send.publicChanged();
  }

  /** Called on a timer: time out terminals and meetings. */
  tick(): void {
    const now = this.now();
    if (this.over) return;
    if (this.phase === "reveal" && now >= this.phaseEndsAt) return this.endReveal();
    if (this.phase === "meeting" && now >= this.phaseEndsAt) return this.endMeeting();
    if (this.phase === "voteResult" && now >= this.phaseEndsAt) return this.endVoteResult();
    for (const [playerId, q] of [...this.open]) {
      if (now >= q.deadline) this.answer(playerId, null);
    }
  }

  /** Voted out: out of play, and their pieces go back where they were found. */
  private eject(playerId: string): void {
    this.alive.delete(playerId);
    this.open.delete(playerId);
    this.votes.delete(playerId);
    for (const p of this.pieces.values()) if (p.holderId === playerId) p.holderId = undefined;
  }

  /** A player disconnected: same as being voted out, and the game checks for a winner right away. */
  removePlayer(playerId: string): void {
    if (this.outReason.get(playerId) === "left") return;
    const wasAlive = this.alive.has(playerId);
    this.outReason.set(playerId, "left");
    // A hall monitor who leaves just puts their pieces back.
    if (!wasAlive) {
      for (const p of this.pieces.values()) if (p.holderId === playerId) p.holderId = undefined;
      return;
    }
    this.eject(playerId);
    this.send.publicChanged();
    this.checkWin();
    // Nobody waits for someone who left.
    this.endRevealIfAllReady();
    // Their missing vote shouldn't hold up a meeting.
    if (!this.over && this.phase === "meeting" && this.alive.size > 0 && [...this.alive].every((id) => this.votes.has(id))) {
      this.endMeeting();
    }
  }

  private checkWin(): void {
    if (this.over) return;
    this.result = checkWinner({
      strikes: this.strikes,
      blufferAlive: this.alive.has(this.blufferId()),
      aliveCount: this.alive.size,
      questionsRemaining: this.questions.length - this.solved.size,
    });
    if (this.result) {
      this.open.clear();
      this.send.publicChanged();
    }
  }

  gameOver(): GameOver | undefined {
    if (!this.result) return undefined;
    const myths = this.questions.map((q) => ({
      question: q.prompt,
      myth: q.choices[q.lieIndex],
      truth: q.choices[q.correctIndex],
      why: q.hint,
      solved: this.solved.has(q.id),
    }));
    // "Kicked out of school" isn't right if the Bluffer simply left.
    const reason = this.result.winner === "class" && this.outReason.get(this.blufferId()) === "left" ? "The Bluffer left the game." : this.result.reason;
    return { ...this.result, reason, roles: Object.fromEntries(this.roles), out: Object.fromEntries(this.outReason), myths };
  }
}
