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
import { QUESTIONS, type Question } from "@whtb/shared/questions";
import type { AnswerOutcome, ErrorCode, GameOver, Role } from "@whtb/shared/types";
import { assignRoles, assignTasks, checkWinner, shuffle, type Random, type WinResult } from "./rules";

type Event = keyof ServerToClientEvents;
type Payload<E extends Event> = Parameters<ServerToClientEvents[E]>[0];

export interface Sender {
  toPlayer<E extends Event>(playerId: string, event: E, payload: Payload<E>): void;
  /** Called whenever public state (strikes, progress, alive, phase) changes. */
  publicChanged(): void;
}

interface OpenQuestion {
  terminalId: string;
  question: Question;
  /** choiceOrder[i] = index into question.choices shown at position i. */
  choiceOrder: number[];
  botPick: number;
  correct: number;
  lie: number;
  hacked: boolean;
  deadline: number;
  doubleChecked: boolean;
}

export class ActionError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

const TERMINAL_IDS = TERMINALS.map((t) => t.id);

export class GameRoom {
  readonly roles: Map<string, Role>;
  private tasks: Map<string, string[]>;
  private alive: Set<string>;
  private open = new Map<string, OpenQuestion>();
  private questionCursor = new Map<string, number>();
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
    this.tasks = assignTasks(playerIds, TERMINAL_IDS, random);
    this.alive = new Set(playerIds);
    playerIds.forEach((id) => this.questionCursor.set(id, Math.floor(random() * QUESTIONS.length)));
  }

  /** Tell each player, privately, their role and tasks. */
  dealSecrets(): void {
    for (const [id, role] of this.roles) {
      this.send.toPlayer(id, "game:role", { role });
      this.send.toPlayer(id, "game:tasks", { terminalIds: this.tasks.get(id)! });
    }
  }

  get over(): boolean {
    return this.result !== undefined;
  }

  isAlive(id: string): boolean {
    return this.alive.has(id);
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

  openTerminal(playerId: string, terminalId: string): void {
    const role = this.requireLiving(playerId);
    this.requireNear(playerId, terminalId);
    if (this.open.has(playerId)) return;
    const isBluffer = role === "bluffer";
    if (!isBluffer && !this.tasks.get(playerId)!.includes(terminalId)) {
      throw new ActionError("NO_TASK_HERE", "No task for you at this terminal. Check your task list.");
    }

    const cursor = this.questionCursor.get(playerId)!;
    this.questionCursor.set(playerId, cursor + 1);
    const question = QUESTIONS[cursor % QUESTIONS.length];
    // Shuffle the options so the right answer isn't always in the same spot.
    const choiceOrder = shuffle([0, 1, 2, 3], this.random);
    const correct = choiceOrder.indexOf(question.correctIndex);
    const lie = choiceOrder.indexOf(question.lieIndex);
    // A hack is used up by the next real player at that terminal, not the Bluffer.
    const hacked = !isBluffer && this.hacked.delete(terminalId);
    if (hacked) this.send.toPlayer(this.blufferId(), "terminal:hackUsed", { terminalId });
    const deadline = this.now() + QUESTION_SECONDS * 1000;

    const open: OpenQuestion = {
      terminalId,
      question,
      choiceOrder,
      botPick: hacked ? lie : correct,
      correct,
      lie,
      hacked,
      deadline,
      doubleChecked: false,
    };
    this.open.set(playerId, open);
    this.send.toPlayer(playerId, "terminal:question", {
      terminalId,
      subject: question.subject,
      prompt: question.prompt,
      choices: choiceOrder.map((i) => question.choices[i]),
      botPick: open.botPick,
      confidence: 92 + Math.floor(this.random() * 8),
      msLeft: deadline - this.now(),
    });
  }

  doubleCheck(playerId: string): void {
    this.requireLiving(playerId);
    const q = this.open.get(playerId);
    if (!q || q.doubleChecked) return;
    q.doubleChecked = true;
    q.deadline = Math.max(this.now() + 1000, q.deadline - DOUBLE_CHECK_COST_SECONDS * 1000);
    this.send.toPlayer(playerId, "terminal:hint", { hint: q.question.hint, msLeft: q.deadline - this.now() });
  }

  verify(playerId: string): void {
    const role = this.requireLiving(playerId);
    if (role !== "factChecker") throw new ActionError("NOT_ALLOWED", "Only the Fact-Checker can verify.");
    if (this.verifyUsed) throw new ActionError("NOT_ALLOWED", "You already used your one Verify.");
    const q = this.open.get(playerId);
    if (!q) throw new ActionError("NOT_ALLOWED", "Open a terminal question first.");
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
    this.open.delete(playerId);

    let outcome: AnswerOutcome;
    if (role === "bluffer") outcome = "faked";
    else if (choiceIndex === q.correct) outcome = "correct";
    else if (q.hacked && choiceIndex === q.botPick) outcome = "strike";
    else outcome = "wrong";

    if (outcome === "correct") {
      const remaining = this.tasks.get(playerId)!;
      remaining.splice(remaining.indexOf(q.terminalId), 1);
      this.progress++;
      this.send.toPlayer(playerId, "game:tasks", { terminalIds: [...remaining] });
    } else if (outcome === "faked") {
      // The Bluffer's fake list shrinks too, so they look busy.
      const remaining = this.tasks.get(playerId)!;
      const i = remaining.indexOf(q.terminalId);
      if (i >= 0) remaining.splice(i, 1);
      this.send.toPlayer(playerId, "game:tasks", { terminalIds: [...remaining] });
    } else if (outcome === "strike") {
      this.strikes++;
    }
    this.send.toPlayer(playerId, "terminal:result", { outcome });
    this.send.publicChanged();
    this.checkWin();
  }

  /** Called on a timer: time out questions past their deadline. */
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
    this.send.publicChanged();
    this.checkWin();
  }

  private blufferId(): string {
    return [...this.roles].find(([, r]) => r === "bluffer")![0];
  }

  private checkWin(): void {
    if (this.over) return;
    const blufferId = this.blufferId();
    this.result = checkWinner({
      strikes: this.strikes,
      blufferAlive: this.alive.has(blufferId),
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
