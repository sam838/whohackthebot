// The referee for one game (spec.md > Game Server > game/GameRoom.ts).
// Holds the secret state and decides every outcome. It talks to players only
// through the Sender, so tests can record messages without sockets.

import {
  BLUFFER_MAX_PIECES,
  CHAT_MAX_LENGTH,
  DOUBLE_CHECK_COST_SECONDS,
  HACK_COOLDOWN_SECONDS,
  INTERACT_RADIUS,
  MEETING_CALLS_PER_PLAYER,
  MEETING_SECONDS,
  QUESTION_SECONDS,
  QUESTIONS_PER_CLASSMATE,
  VOTE_RESULT_SECONDS,
} from "@whtb/shared/constants";
import type { ServerToClientEvents } from "@whtb/shared/events";
import { distance, nearMeetingButton } from "@whtb/shared/geometry";
import { TERMINALS, type Point } from "@whtb/shared/map";
import { PICKUP_RADIUS, PIECE_ROOMS, PIECE_SPOTS } from "@whtb/shared/pieces";
import { QUESTIONS, type Question } from "@whtb/shared/questions";
import type { AnswerOutcome, ArrangeCard, ErrorCode, GameOver, PieceInfo, Role } from "@whtb/shared/types";
import { assignRoles, checkWinner, shuffle, tallyVotes, type Random, type WinResult } from "./rules";

/** Where the game is between start and game over. */
export type GamePhase = "playing" | "meeting" | "voteResult";

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

/** A piece is on the floor at its home spot, in someone's bag, or used up. */
interface Piece {
  id: string;
  question: Question;
  /** 0, 1, 2: reading order within its question. */
  index: number;
  text: string;
  home: Point;
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
  private phaseEndsAt = 0;
  phase: GamePhase = "playing";
  meetingCallerId: string | undefined;
  strikes = 0;
  result: WinResult | undefined;

  constructor(
    playerIds: string[],
    private send: Sender,
    private positionOf: (playerId: string) => Point | undefined,
    private random: Random = Math.random,
    private now: () => number = Date.now,
  ) {
    this.roles = assignRoles(playerIds, random);
    this.alive = new Set(playerIds);
    playerIds.forEach((id) => this.meetingCalls.set(id, MEETING_CALLS_PER_PLAYER));
    const classmates = playerIds.length - 1;
    this.questions = shuffle(QUESTIONS, random).slice(0, classmates * QUESTIONS_PER_CLASSMATE);

    // Each question's 3 pieces start in three different rooms. Piece ids are
    // opaque so they never hint which question a piece belongs to.
    let freeSpots = shuffle(PIECE_SPOTS, random);
    const idNumbers = shuffle([...Array(this.questions.length * 3).keys()], random);
    for (const question of this.questions) {
      const rooms = shuffle(PIECE_ROOMS, random).slice(0, question.pieces.length);
      question.pieces.forEach((text, index) => {
        const spot = freeSpots.find((s) => s.room === rooms[index]) ?? freeSpots[0];
        freeSpots = freeSpots.filter((s) => s !== spot);
        const id = `piece-${idNumbers.pop()}`;
        this.pieces.set(id, { id, question, index, text, home: { x: spot.x, z: spot.z }, used: false });
      });
    }
  }

  /** Tell each player, privately, their role; tell everyone where pieces lie. */
  dealSecrets(): void {
    for (const [id, role] of this.roles) {
      this.send.toPlayer(id, "game:role", { role });
      this.sendBag(id);
    }
    this.sendFloor();
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

  aliveIds(): string[] {
    return [...this.alive];
  }

  votedIds(): string[] {
    return this.phase === "meeting" ? [...this.votes.keys()] : [];
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

  /** Pieces lying on the floor, without text, to everyone. */
  private sendFloor(): void {
    const floor: PieceInfo[] = [...this.pieces.values()]
      .filter((p) => !p.used && !p.holderId)
      .map((p) => ({ id: p.id, x: p.home.x, z: p.home.z }));
    for (const id of this.roles.keys()) this.send.toPlayer(id, "pieces:state", { pieces: floor });
  }

  private requireLiving(playerId: string): Role {
    const role = this.roles.get(playerId);
    if (!role || !this.alive.has(playerId) || this.over) throw new ActionError("NOT_ALLOWED", "You can't do that right now.");
    return role;
  }

  /** Terminal and piece actions only happen while everyone is walking around. */
  private requirePlaying(playerId: string): Role {
    const role = this.requireLiving(playerId);
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

  pickUp(playerId: string, pieceId: string): void {
    const role = this.requirePlaying(playerId);
    const piece = this.pieces.get(pieceId);
    if (!piece || piece.used || piece.holderId) return;
    const pos = this.positionOf(playerId);
    if (!pos || distance(pos, piece.home) > PICKUP_RADIUS + 0.4) throw new ActionError("TOO_FAR", "Walk onto the piece to pick it up.");
    if (role === "bluffer" && this.bagOf(playerId).length >= BLUFFER_MAX_PIECES) {
      throw new ActionError("HANDS_FULL", `Your hands are full (${BLUFFER_MAX_PIECES} pieces).`);
    }
    piece.holderId = playerId;
    this.send.toPlayer(playerId, "piece:collected", { pieceId, text: piece.text });
    this.sendBag(playerId);
    this.sendFloor();
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
    }
    // Anything but correct: the pieces simply stay in their owners' bags.
    this.send.toPlayer(playerId, "terminal:result", { outcome });
    this.send.publicChanged();
    this.checkWin();
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
    // Everyone stops what they're doing; open terminals close with nothing lost.
    this.open.clear();
    this.votes.clear();
    this.phase = "meeting";
    this.meetingCallerId = playerId;
    this.phaseEndsAt = this.now() + MEETING_SECONDS * 1000;
    this.send.publicChanged();
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
    if (ejectedId) this.eject(ejectedId);
    this.phase = "voteResult";
    this.phaseEndsAt = this.now() + VOTE_RESULT_SECONDS * 1000;
    this.send.toRoom("vote:result", { ejectedId, wasBluffer, counts });
    this.send.publicChanged();
  }

  /** After the result has been on screen: game over, or back to class. */
  private endVoteResult(): void {
    this.votes.clear();
    this.meetingCallerId = undefined;
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
    this.sendFloor();
  }

  /** A player disconnected: same as being voted out, and the game checks for a winner right away. */
  removePlayer(playerId: string): void {
    if (!this.alive.has(playerId)) return;
    this.eject(playerId);
    this.send.publicChanged();
    this.checkWin();
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
    return { ...this.result, roles: Object.fromEntries(this.roles) };
  }
}
