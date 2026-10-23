// The referee for one game (spec.md > Game Server > game/GameRoom.ts).
// Holds the secret state and decides every outcome. It talks to players only
// through the Sender, so tests can record messages without sockets.

import {
  DOUBLE_CHECK_COST_SECONDS,
  HACK_COOLDOWN_SECONDS,
  INTERACT_RADIUS,
  QUESTION_SECONDS,
} from "@whtb/shared/constants";
import type { ServerToClientEvents } from "@whtb/shared/events";
import { distance } from "@whtb/shared/geometry";
import { TERMINALS, type Point } from "@whtb/shared/map";
import { PICKUP_RADIUS, PIECE_ROOMS, PIECE_SPOTS, type PieceSpot } from "@whtb/shared/pieces";
import { QUESTIONS, type Question } from "@whtb/shared/questions";
import type { AnswerOutcome, ErrorCode, GameOver, PieceInfo, Role, TaskInfo } from "@whtb/shared/types";
import { assignRoles, assignTasks, checkWinner, shuffle, type Random, type WinResult } from "./rules";

type Event = keyof ServerToClientEvents;
type Payload<E extends Event> = Parameters<ServerToClientEvents[E]>[0];

export interface Sender {
  toPlayer<E extends Event>(playerId: string, event: E, payload: Payload<E>): void;
  /** Called whenever public state (strikes, progress, alive, phase) changes. */
  publicChanged(): void;
}

interface Piece {
  id: string;
  ownerId: string;
  terminalId: string;
  text: string;
  x: number;
  z: number;
  collected: boolean;
}

interface Task {
  terminalId: string;
  /** Undefined for the Bluffer's fake tasks. */
  question?: Question;
  pieceIds: string[];
}

interface OpenTerminal {
  stage: "arrange" | "answer";
  task: Task;
  question: Question;
  /** Shown position i holds question.choices[choiceOrder[i]]. */
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

const TERMINAL_IDS = TERMINALS.map((t) => t.id);

export class GameRoom {
  readonly roles: Map<string, Role>;
  private tasks = new Map<string, Task[]>();
  private pieces = new Map<string, Piece>();
  private alive: Set<string>;
  private open = new Map<string, OpenTerminal>();
  private hacked = new Set<string>();
  private hackReadyAt = 0;
  private verifyUsed = false;
  strikes = 0;
  progress = 0;
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
    const terminalsFor = assignTasks(playerIds, TERMINAL_IDS, random);
    let freeSpots = shuffle(PIECE_SPOTS, random);

    for (const id of playerIds) {
      const terminals = terminalsFor.get(id)!;
      if (this.roles.get(id) === "bluffer") {
        this.tasks.set(id, terminals.map((terminalId) => ({ terminalId, pieceIds: [] })));
        continue;
      }
      const questions = shuffle(QUESTIONS, random);
      this.tasks.set(
        id,
        terminals.map((terminalId, i) => {
          const question = questions[i % questions.length];
          // One piece in each of three different rooms.
          const rooms = shuffle(PIECE_ROOMS, random).slice(0, question.pieces.length);
          const pieceIds = question.pieces.map((text, k) => {
            const spot = freeSpots.find((s) => s.room === rooms[k]) ?? freeSpots[0];
            freeSpots = freeSpots.filter((s) => s !== spot);
            return this.placePiece(id, terminalId, text, spot, `${id}:${terminalId}:${k}`).id;
          });
          return { terminalId, question, pieceIds };
        }),
      );
    }
  }

  private placePiece(ownerId: string, terminalId: string, text: string, spot: PieceSpot, id: string): Piece {
    const piece: Piece = { id, ownerId, terminalId, text, x: spot.x, z: spot.z, collected: false };
    this.pieces.set(id, piece);
    return piece;
  }

  /** Tell each player, privately, their role, tasks, and (if not the Bluffer) where pieces lie. */
  dealSecrets(): void {
    for (const [id, role] of this.roles) {
      this.send.toPlayer(id, "game:role", { role });
      this.sendTasks(id);
    }
    this.sendPieces();
  }

  get over(): boolean {
    return this.result !== undefined;
  }

  isAlive(id: string): boolean {
    return this.alive.has(id);
  }

  private blufferId(): string {
    return [...this.roles].find(([, r]) => r === "bluffer")![0];
  }

  private taskInfo(id: string): TaskInfo[] {
    return this.tasks.get(id)!.map((t) => ({
      terminalId: t.terminalId,
      found: t.pieceIds.filter((p) => this.pieces.get(p)!.collected).length,
      total: t.pieceIds.length,
    }));
  }

  private sendTasks(id: string): void {
    this.send.toPlayer(id, "game:tasks", { tasks: this.taskInfo(id) });
  }

  /** Uncollected pieces, without text, to every non-Bluffer. The Bluffer is blind to pieces. */
  private sendPieces(): void {
    const visible: PieceInfo[] = [...this.pieces.values()]
      .filter((p) => !p.collected && this.alive.has(p.ownerId))
      .map(({ id, ownerId, x, z }) => ({ id, ownerId, x, z }));
    for (const [id, role] of this.roles) {
      if (role !== "bluffer") this.send.toPlayer(id, "pieces:state", { pieces: visible });
    }
  }

  /** Remaining tasks of living non-Bluffers; ejected players' tasks drop out. */
  tasksRemaining(): number {
    let n = 0;
    for (const id of this.alive) if (this.roles.get(id) !== "bluffer") n += this.tasks.get(id)!.length;
    return n;
  }

  goal(): number {
    return this.progress + this.tasksRemaining();
  }

  private requireLiving(playerId: string): Role {
    const role = this.roles.get(playerId);
    if (!role || !this.alive.has(playerId) || this.over) throw new ActionError("NOT_ALLOWED", "You can't do that right now.");
    return role;
  }

  private requireNear(playerId: string, terminalId: string) {
    const t = TERMINALS.find((x) => x.id === terminalId);
    const pos = this.positionOf(playerId);
    if (!t || !pos || distance(pos, t) > INTERACT_RADIUS + 0.2) throw new ActionError("TOO_FAR", "Walk closer to the terminal.");
    return t;
  }

  pickUp(playerId: string, pieceId: string): void {
    const role = this.requireLiving(playerId);
    const piece = this.pieces.get(pieceId);
    if (role === "bluffer" || !piece || piece.ownerId !== playerId || piece.collected) return;
    const pos = this.positionOf(playerId);
    if (!pos || distance(pos, piece) > PICKUP_RADIUS + 0.4) throw new ActionError("TOO_FAR", "Walk onto the piece to pick it up.");
    piece.collected = true;
    this.send.toPlayer(playerId, "piece:collected", { pieceId, terminalId: piece.terminalId, text: piece.text });
    this.sendTasks(playerId);
    this.sendPieces();
  }

  openTerminal(playerId: string, terminalId: string): void {
    const role = this.requireLiving(playerId);
    this.requireNear(playerId, terminalId);
    if (this.open.has(playerId)) return;
    const isBluffer = role === "bluffer";

    // The Bluffer gets a random question to look busy; nobody sees their screen.
    let task = this.tasks.get(playerId)!.find((t) => t.terminalId === terminalId);
    if (!isBluffer) {
      if (!task) throw new ActionError("NO_TASK_HERE", "No task for you at this terminal. Check your task list.");
      const found = task.pieceIds.filter((p) => this.pieces.get(p)!.collected).length;
      if (found < task.pieceIds.length) {
        throw new ActionError("NO_TASK_HERE", `Find all the question pieces first (${found}/${task.pieceIds.length}).`);
      }
    }
    task ??= { terminalId, pieceIds: [] };
    const question = task.question ?? QUESTIONS[Math.floor(this.random() * QUESTIONS.length)];

    // Shuffle the options so the right answer isn't always in the same spot.
    const choiceOrder = shuffle([0, 1, 2, 3], this.random);
    const correct = choiceOrder.indexOf(question.correctIndex);
    const lie = choiceOrder.indexOf(question.lieIndex);
    // A hack is used up by the next real player at that terminal, not the Bluffer.
    const hacked = !isBluffer && this.hacked.delete(terminalId);
    if (hacked) this.send.toPlayer(this.blufferId(), "terminal:hackUsed", { terminalId });

    const open: OpenTerminal = {
      stage: isBluffer ? "answer" : "arrange",
      task,
      question,
      choiceOrder,
      botPick: hacked ? lie : correct,
      correct,
      hacked,
      deadline: this.now() + QUESTION_SECONDS * 1000,
      doubleChecked: false,
    };
    this.open.set(playerId, open);

    if (open.stage === "arrange") {
      const cards = shuffle(task.pieceIds, this.random).map((id) => ({ id, text: this.pieces.get(id)!.text }));
      this.send.toPlayer(playerId, "terminal:arrange", { terminalId, cards, msLeft: open.deadline - this.now() });
    } else {
      this.reveal(playerId, open, "none");
    }
  }

  /** The player put the pieces in order themselves. */
  arrange(playerId: string, order: string[]): void {
    this.requireLiving(playerId);
    const open = this.open.get(playerId);
    if (!open || open.stage !== "arrange") return;
    const expected = open.task.pieceIds;
    const right = Array.isArray(order) && order.length === expected.length && order.every((id, i) => id === expected[i]);
    if (!right) return void this.send.toPlayer(playerId, "terminal:arrangeWrong", undefined);
    this.reveal(playerId, open, "you");
  }

  /** Study-Bot arranges it instantly; if hacked, into a believable wrong question. */
  botArrange(playerId: string): void {
    this.requireLiving(playerId);
    const open = this.open.get(playerId);
    if (!open || open.stage !== "arrange") return;
    this.reveal(playerId, open, "studybot");
  }

  private reveal(playerId: string, open: OpenTerminal, arrangedBy: "you" | "studybot" | "none"): void {
    open.stage = "answer";
    const q = open.question;
    this.send.toPlayer(playerId, "terminal:question", {
      terminalId: open.task.terminalId,
      subject: q.subject,
      prompt: arrangedBy === "studybot" && open.hacked ? q.twistedPrompt : q.prompt,
      arrangedBy,
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
    this.send.toPlayer(playerId, "terminal:hint", { hint: q.question.hint, msLeft: q.deadline - this.now() });
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
    const role = this.requireLiving(playerId);
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

    let outcome: AnswerOutcome;
    if (role === "bluffer") outcome = "faked";
    else if (choiceIndex === q.correct) outcome = "correct";
    else if (q.hacked && choiceIndex === q.botPick) outcome = "strike";
    else outcome = "wrong";

    const list = this.tasks.get(playerId)!;
    if (outcome === "correct" || outcome === "faked") {
      // The Bluffer's fake list shrinks too, so they look busy.
      const i = list.findIndex((t) => t.terminalId === q.task.terminalId);
      if (i >= 0) list.splice(i, 1);
      if (outcome === "correct") this.progress++;
      this.sendTasks(playerId);
    } else if (outcome === "strike") {
      this.strikes++;
    }
    this.send.toPlayer(playerId, "terminal:result", { outcome });
    this.send.publicChanged();
    this.checkWin();
  }

  /** Called on a timer: time out terminals past their deadline. */
  tick(): void {
    const now = this.now();
    for (const [playerId, q] of [...this.open]) {
      if (now >= q.deadline) this.answer(playerId, null);
    }
  }

  /** A player left or was voted out. */
  removePlayer(playerId: string): void {
    if (!this.alive.delete(playerId)) return;
    this.open.delete(playerId);
    this.sendPieces();
    this.send.publicChanged();
    this.checkWin();
  }

  private checkWin(): void {
    if (this.over) return;
    this.result = checkWinner({
      strikes: this.strikes,
      blufferAlive: this.alive.has(this.blufferId()),
      aliveCount: this.alive.size,
      tasksRemaining: this.tasksRemaining(),
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
