// Practice-mode bots (spec.md > Practice Mode & Bots). Simple rules, not smart AI:
// search the school for hidden pieces (they don't know where pieces hide either),
// help the human at a terminal, solve full questions
// (often trusting Study-Bot blindly, like real players), hack if they're the
// Bluffer, call a meeting after a strike, then chat and vote on who was seen
// near the hacked terminal. Every action goes through GameRoom, so bots follow
// exactly the same rules as people.

import { buildObstacles, moveWithCollision } from "@whtb/shared/collision";
import { INTERACT_RADIUS, PLAYER_RADIUS, WALK_SPEED } from "@whtb/shared/constants";
import { distance, nearMeetingButton } from "@whtb/shared/geometry";
import { MEETING_BUTTON, ROOMS, TERMINALS, roomAt, type Point } from "@whtb/shared/map";
import { findPath, isWalkable } from "@whtb/shared/nav";
import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { canSee } from "@whtb/shared/vision";
import type { PlayerPosition } from "@whtb/shared/types";
import type { MeetingRequest } from "./ai";
import type { GameRoom } from "./game/GameRoom";
import { ActionError } from "./game/GameRoom";

const obstacles = buildObstacles();
/** How often a bot trusts Study-Bot without checking. */
const TRUST_RATE = 0.7;
const BOT_SPEED = WALK_SPEED * 0.8;
/** How long bots remember who stood near a terminal. */
const MEMORY_MS = 45_000;

type Goal =
  | { kind: "wander" }
  | { kind: "solve"; terminalId: string; giveUpAt: number }
  | { kind: "help"; terminalId: string; until: number }
  | { kind: "hack"; terminalId: string }
  | { kind: "search"; spotId: string }
  | { kind: "meeting" };

interface Bot {
  id: string;
  path: Point[];
  goal?: Goal;
  waitUntil: number;
  /** Scheduled steps while using a terminal. */
  terminalSteps: { at: number; run: () => void }[];
  suspicion: Map<string, number>;
  /** Hiding spots this bot has already examined. */
  searched: Set<string>;
  chatAt?: number;
  voteAt?: number;
}

export interface BotWorld {
  game: GameRoom;
  botIds: string[];
  humanId: string;
  position(id: string): PlayerPosition | undefined;
  move(id: string, pos: PlayerPosition): void;
  nameOf(id: string): string;
  /** Optional AI voice for meeting lines; resolves to undefined to use the canned line. */
  speak?: (req: Omit<MeetingRequest, "recentChat">) => Promise<string | undefined>;
  now?: () => number;
  random?: () => number;
}

/**
 * Where a bot stands to use a terminal: a walkable spot in the same room and
 * within reach (never the far side of a wall).
 */
const STANDS = new Map(
  TERMINALS.map((t) => {
    const room = roomAt(t)?.id;
    for (const r of [1.0, 1.2, 1.4]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const p = { x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r };
        if (isWalkable(p) && roomAt(p)?.id === room && distance(p, t) <= INTERACT_RADIUS) return [t.id, p];
      }
    }
    return [t.id, { x: t.x, z: t.z + 0.9 }];
  }),
);
export const terminalStand = (terminalId: string): Point => STANDS.get(terminalId)!;

export class BotController {
  private bots: Bot[];
  private now: () => number;
  private random: () => number;
  private seenStrikes = 0;
  private lastPhase: string;
  /** What each bot saw: bot → terminal → classmate seen near it → when. */
  private sightings = new Map<string, Map<string, Map<string, number>>>();
  /** Where each bot last saw each classmate (bot → classmate → position). */
  private lastSeen = new Map<string, Map<string, Point>>();

  constructor(private world: BotWorld) {
    this.now = world.now ?? Date.now;
    this.random = world.random ?? Math.random;
    this.bots = world.botIds.map((id) => ({ id, path: [], waitUntil: 0, terminalSteps: [], suspicion: new Map(), searched: new Set() }));
    this.lastPhase = world.game.phase;
  }

  private get game() {
    return this.world.game;
  }

  private try(fn: () => void) {
    try {
      fn();
    } catch (err) {
      if (!(err instanceof ActionError)) throw err;
    }
  }

  private pick<T>(items: T[]): T | undefined {
    return items.length ? items[Math.floor(this.random() * items.length)] : undefined;
  }

  tick(dt: number): void {
    const game = this.game;
    if (game.over) return;
    const now = this.now();

    if (game.phase !== this.lastPhase) this.onPhaseChange(game.phase);
    this.lastPhase = game.phase;

    if (game.phase === "meeting") return this.meetingTick(now);
    if (game.phase !== "playing") return;

    this.watch(now);
    this.noticeStrikes(now);
    for (const bot of this.bots) {
      if (!game.isAlive(bot.id)) continue;
      this.botTick(bot, now, dt);
    }
  }

  // --- Watching: who stands near which terminal, and blame after a strike ---

  /** Each bot notes who it can see standing near a terminal (limited vision, like players). */
  private watch(now: number) {
    for (const bot of this.bots) {
      const eyes = this.game.isAlive(bot.id) ? this.world.position(bot.id) : undefined;
      if (!eyes) continue;
      if (!this.sightings.has(bot.id)) this.sightings.set(bot.id, new Map());
      if (!this.lastSeen.has(bot.id)) this.lastSeen.set(bot.id, new Map());
      const log = this.sightings.get(bot.id)!;
      for (const id of this.game.aliveIds()) {
        const pos = id === bot.id ? undefined : this.world.position(id);
        if (!pos || !canSee(eyes, pos)) continue;
        this.lastSeen.get(bot.id)!.set(id, { x: pos.x, z: pos.z });
        for (const t of TERMINALS) {
          if (distance(pos, t) > 2.5) continue;
          if (!log.has(t.id)) log.set(t.id, new Map());
          log.get(t.id)!.set(id, now);
        }
      }
    }
  }

  private noticeStrikes(now: number) {
    const strikes = this.game.strikeTerminals;
    while (this.seenStrikes < strikes.length) {
      const terminalId = strikes[this.seenStrikes++];
      for (const bot of this.bots) {
        const seen = this.sightings.get(bot.id)?.get(terminalId) ?? new Map<string, number>();
        for (const [pid, at] of seen) {
          if (pid === bot.id || now - at > MEMORY_MS) continue;
          bot.suspicion.set(pid, (bot.suspicion.get(pid) ?? 0) + 1);
        }
      }
      // Someone heads to the button to call a meeting (not always).
      if (this.random() < 0.6) {
        const caller = this.pick(
          this.bots.filter((b) => this.game.isAlive(b.id) && this.game.roles.get(b.id) !== "bluffer" && (this.game.meetingCallsLeft()[b.id] ?? 0) > 0),
        );
        if (caller) this.setGoal(caller, { kind: "meeting" }, MEETING_BUTTON);
      }
    }
  }

  // --- Moving and doing things ---

  private setGoal(bot: Bot, goal: Goal, target: Point) {
    const pos = this.world.position(bot.id);
    if (!pos) return;
    bot.goal = goal;
    bot.path = findPath(pos, target);
  }

  private nearestTerminal(p: Point) {
    return [...TERMINALS].sort((a, b) => distance(p, a) - distance(p, b))[0];
  }

  /**
   * Where a sharp Bluffer would hack: the not-yet-hacked terminal closest to where
   * it last saw its classmates (only what a player could know: no bags, no x-ray).
   */
  private terminalToHack(bot: Bot) {
    const game = this.game;
    const hacked = new Set(game.hackedTerminals());
    const seen = this.lastSeen.get(bot.id) ?? new Map<string, Point>();
    const others = [...seen].filter(([id]) => game.isAlive(id)).map(([, p]) => p);
    const score = (t: Point) => others.reduce((sum, p) => sum + 1 / (1 + distance(p, t)), 0);
    const open = TERMINALS.filter((t) => !hacked.has(t.id));
    return [...(open.length ? open : TERMINALS)].sort((a, b) => score(b) - score(a))[0];
  }

  private busy(bot: Bot): boolean {
    return bot.terminalSteps.length > 0 || bot.goal?.kind === "solve" || bot.goal?.kind === "help" || bot.goal?.kind === "meeting";
  }

  /** Pieces held by everyone alive standing at this terminal (what the server will pool). */
  private poolAt(terminalId: string): string[] {
    const t = TERMINALS.find((x) => x.id === terminalId)!;
    return this.game.aliveIds().flatMap((id) => {
      const pos = this.world.position(id);
      return pos && distance(pos, t) <= INTERACT_RADIUS + 0.2 ? this.game.bagIds(id) : [];
    });
  }

  private chooseGoal(bot: Bot, now: number) {
    const game = this.game;
    const role = game.roles.get(bot.id);
    const bag = game.bagIds(bot.id);
    const pos = this.world.position(bot.id)!;

    if (role !== "bluffer" && game.fullQuestionIn(bag)) {
      const t = this.nearestTerminal(pos);
      return this.setGoal(bot, { kind: "solve", terminalId: t.id, giveUpAt: now + 25_000 }, terminalStand(t.id));
    }

    // Teamwork, like real players: gather every free bot holding a piece of a question
    // this bot has started, and meet at a terminal.
    if (role !== "bluffer" && bag.length > 0) {
      const free = this.bots.filter((b) => b !== bot && game.isAlive(b.id) && !this.busy(b));
      const union = [...bag, ...free.flatMap((b) => game.bagIds(b.id))];
      const question = game.fullQuestionIn(union);
      const needed = question ? game.pieceIdsOf(question) : [];
      if (question && needed.some((id) => bag.includes(id))) {
        const helpers = free.filter((b) => game.bagIds(b.id).some((id) => needed.includes(id)));
        const t = this.nearestTerminal(pos);
        this.setGoal(bot, { kind: "solve", terminalId: t.id, giveUpAt: now + 30_000 }, terminalStand(t.id));
        for (const h of helpers) {
          this.setGoal(h, { kind: "help", terminalId: t.id, until: now + 30_000 }, terminalStand(t.id));
          h.waitUntil = 0;
        }
        return;
      }
    }

    // Help the human: walk over with pieces when they're standing at a terminal.
    const human = this.world.position(this.world.humanId);
    const humanTerminal = human && game.isAlive(this.world.humanId) ? TERMINALS.find((t) => distance(human, t) <= INTERACT_RADIUS) : undefined;
    const someoneHelping = this.bots.some((b) => b.goal?.kind === "help");
    if (humanTerminal && bag.length > 0 && !someoneHelping && this.random() < 0.7) {
      return this.setGoal(bot, { kind: "help", terminalId: humanTerminal.id, until: now + 15_000 }, terminalStand(humanTerminal.id));
    }

    if (role === "bluffer" && game.hackReady() && this.random() < 0.5) {
      const t = this.terminalToHack(bot);
      return this.setGoal(bot, { kind: "hack", terminalId: t.id }, terminalStand(t.id));
    }

    // Search something this bot hasn't checked yet, usually one of the nearest.
    const here = this.world.position(bot.id);
    if (here && game.hiddenCount() > 0 && this.random() < 0.85) {
      let fresh = HIDING_SPOTS.filter((s) => !bot.searched.has(s.id));
      if (!fresh.length) {
        // Searched everything: pieces come back when someone leaves, so start over.
        bot.searched.clear();
        fresh = HIDING_SPOTS;
      }
      const nearest = [...fresh].sort((a, b) => distance(here, a) - distance(here, b)).slice(0, 3);
      const spot = this.pick(nearest)!;
      return this.setGoal(bot, { kind: "search", spotId: spot.id }, spot);
    }
    this.setGoal(bot, { kind: "wander" }, this.roomMiddle());
  }

  private roomMiddle(): Point {
    const r = this.pick(ROOMS)!;
    return { x: r.x + r.w * (0.25 + this.random() * 0.5), z: r.z + r.d * (0.25 + this.random() * 0.5) };
  }

  private botTick(bot: Bot, now: number, dt: number) {
    const game = this.game;
    const pos = this.world.position(bot.id);
    if (!pos) return;

    // Busy at a terminal: run the scheduled steps.
    if (bot.terminalSteps.length) {
      while (bot.terminalSteps.length && now >= bot.terminalSteps[0].at) this.try(bot.terminalSteps.shift()!.run);
      return;
    }

    if (now < bot.waitUntil) return;
    // A helper stays put until its help time is up.
    if (bot.goal?.kind === "help" && bot.path.length === 0 && now < bot.goal.until) return;

    if (!bot.goal || (bot.path.length === 0 && now >= bot.waitUntil && bot.goal.kind === "wander")) {
      if (now >= bot.waitUntil) this.chooseGoal(bot, now);
      return;
    }

    if (bot.path.length) return this.walk(bot, pos, dt);
    this.arrive(bot, now);
  }

  private walk(bot: Bot, pos: PlayerPosition, dt: number) {
    const next = bot.path[0];
    const dx = next.x - pos.x;
    const dz = next.z - pos.z;
    const d = Math.hypot(dx, dz);
    const step = BOT_SPEED * dt;
    if (d <= step + 0.05) {
      bot.path.shift();
      this.world.move(bot.id, { x: next.x, z: next.z, heading: Math.atan2(dx, dz) || pos.heading });
      return;
    }
    const moved = moveWithCollision(pos, (dx / d) * step, (dz / d) * step, PLAYER_RADIUS, obstacles);
    this.world.move(bot.id, { ...moved, heading: Math.atan2(dx, dz) });
  }

  private arrive(bot: Bot, now: number) {
    const game = this.game;
    const goal = bot.goal!;
    bot.goal = undefined;
    switch (goal.kind) {
      case "wander":
        bot.waitUntil = now + 400 + this.random() * 1500;
        bot.goal = { kind: "wander" };
        return;
      case "hack":
        this.try(() => game.hack(bot.id, goal.terminalId));
        bot.waitUntil = now + 800;
        return;
      case "search":
        this.try(() => game.examine(bot.id, goal.spotId));
        bot.searched.add(goal.spotId);
        bot.waitUntil = now + 500 + this.random() * 700;
        return;
      case "help":
        // Stay at the terminal until the help time is up, then go back to wandering.
        if (now < goal.until) {
          bot.goal = goal;
          bot.waitUntil = goal.until;
        }
        return;
      case "meeting": {
        const pos = this.world.position(bot.id);
        if (pos && nearMeetingButton(pos)) this.try(() => game.callMeeting(bot.id));
        return;
      }
      case "solve": {
        const question = game.fullQuestionIn(this.poolAt(goal.terminalId));
        if (question) this.try(() => game.openTerminal(bot.id, goal.terminalId));
        if (!game.hasOpenTerminal(bot.id)) {
          // The partner isn't here yet: wait a moment and try again, up to a limit.
          if (now < goal.giveUpAt) {
            bot.goal = goal;
            bot.waitUntil = now + 500;
          }
          return;
        }
        const useStudyBot = this.random() < 0.5;
        const trust = this.random() < TRUST_RATE;
        bot.terminalSteps = [
          {
            at: now + 1500,
            run: () => (useStudyBot || !question ? game.botArrange(bot.id) : game.arrange(bot.id, game.pieceIdsOf(question))),
          },
          { at: now + 3500, run: () => game.botAnswer(bot.id, trust) },
          { at: now + 3600, run: () => game.close(bot.id) },
        ];
        return;
      }
    }
  }

  // --- Meetings: chat a line, then vote ---

  private onPhaseChange(phase: string) {
    const now = this.now();
    for (const bot of this.bots) {
      bot.path = [];
      bot.goal = undefined;
      bot.terminalSteps = [];
      bot.waitUntil = now + 500;
      if (phase === "meeting") {
        bot.chatAt = now + 2000 + this.random() * 6000;
        bot.voteAt = now + 8000 + this.random() * 12000;
      }
    }
  }

  private topSuspect(bot: Bot): string | undefined {
    let best: string | undefined;
    let score = 0;
    for (const [pid, n] of bot.suspicion) {
      if (pid !== bot.id && this.game.isAlive(pid) && n > score) {
        best = pid;
        score = n;
      }
    }
    return best;
  }

  /** What a bot knows going into a meeting, for its AI-written line. */
  private meetingFacts(bot: Bot): Omit<MeetingRequest, "recentChat"> {
    const pos = this.world.position(bot.id);
    const room = pos ? roomAt(pos)?.name ?? "the hallway" : "the hallway";
    const suspects = [...bot.suspicion]
      .filter(([pid, n]) => n > 0 && pid !== bot.id && this.game.isAlive(pid))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([pid]) => this.world.nameOf(pid));
    return {
      botName: this.world.nameOf(bot.id),
      isBluffer: this.game.roles.get(bot.id) === "bluffer",
      room: room === "the hallway" ? room : `the ${room}`,
      suspects,
      others: this.game.aliveIds().filter((id) => id !== bot.id).map((id) => this.world.nameOf(id)),
    };
  }

  private chatLine(bot: Bot): string {
    const pos = this.world.position(bot.id);
    const here = pos ? roomAt(pos)?.name ?? "the hallway" : "the hallway";
    const isBluffer = this.game.roles.get(bot.id) === "bluffer";
    const suspect = this.topSuspect(bot);
    if (isBluffer) {
      const elsewhere = this.pick(ROOMS.filter((r) => r.name !== here && r.id !== "hallway"))!.name;
      const scapegoat = this.pick(this.game.aliveIds().filter((id) => id !== bot.id));
      return this.random() < 0.5 || !scapegoat
        ? `I was in the ${elsewhere} the whole time, collecting pieces.`
        : `${this.world.nameOf(scapegoat)} keeps hanging around the terminals… sus.`;
    }
    if (suspect) return `I saw ${this.world.nameOf(suspect)} near the terminal before the strike!`;
    return this.pick([`I was in the ${here}.`, "Not me! I've been looking for pieces.", "Did anyone see who used that terminal?"])!;
  }

  private meetingTick(now: number) {
    for (const bot of this.bots) {
      if (!this.game.isAlive(bot.id)) continue;
      if (bot.chatAt !== undefined && now >= bot.chatAt) {
        bot.chatAt = undefined;
        const canned = this.chatLine(bot);
        if (!this.world.speak) this.try(() => this.game.chat(bot.id, canned));
        else {
          void this.world.speak(this.meetingFacts(bot)).then((line) => {
            if (this.game.phase === "meeting" && this.game.isAlive(bot.id)) this.try(() => this.game.chat(bot.id, line ?? canned));
          });
        }
      }
      if (bot.voteAt !== undefined && now >= bot.voteAt && !this.game.hasVoted(bot.id)) {
        bot.voteAt = undefined;
        const isBluffer = this.game.roles.get(bot.id) === "bluffer";
        let target = this.topSuspect(bot) ?? null;
        if (isBluffer && !target) target = this.pick(this.game.aliveIds().filter((id) => id !== bot.id)) ?? null;
        if (!isBluffer && !target && this.random() < 0.5) target = null;
        this.try(() => this.game.vote(bot.id, target));
      }
    }
  }
}
