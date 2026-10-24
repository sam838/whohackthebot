// Practice-mode bots (spec.md > Practice Mode & Bots). Simple rules, not smart AI:
// search the school for hidden pieces (they don't know where pieces hide either),
// help the human at a terminal, solve full questions
// (often trusting Study-Bot blindly, like real players), hack if they're the
// Bluffer, call a meeting after a strike, then chat and vote on who was seen
// near the hacked terminal. You can talk to them in a meeting ("follow me",
// "meet me in the Library", "vote Kevin"): they answer and may agree to a plan,
// which they carry out after the meeting. Every action goes through GameRoom,
// so bots follow exactly the same rules as people.

import { buildObstacles, moveWithCollision } from "@whtb/shared/collision";
import { EXPEL_RADIUS, INTERACT_RADIUS, PLAYER_RADIUS, SLIP_REPORT_RADIUS, WALK_SPEED } from "@whtb/shared/constants";
import { distance, nearMeetingButton } from "@whtb/shared/geometry";
import { MEETING_BUTTON, ROOMS, TERMINALS, roomAt, type Point } from "@whtb/shared/map";
import { findPath, isWalkable } from "@whtb/shared/nav";
import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { canSee } from "@whtb/shared/vision";
import type { PlayerPosition } from "@whtb/shared/types";
import type { BotPlan, BotReply, MeetingRequest, PlanKind, ReplyRequest } from "./ai";
import type { GameRoom } from "./game/GameRoom";
import { ActionError } from "./game/GameRoom";

const obstacles = buildObstacles();
/** How often a bot trusts Study-Bot without checking. */
const TRUST_RATE = 0.7;
const BOT_SPEED = WALK_SPEED * 0.8;
/** How long bots remember who stood near a terminal. */
const MEMORY_MS = 45_000;
/** How long a bot keeps to a plan it agreed to in a meeting, once class resumes. */
export const PLAN_MS = 30_000;
/** At most this many bot replies to you per meeting (keeps the chat readable and AI costs low). */
const MAX_REPLIES_PER_MEETING = 8;

/** What a bot agreed to do after the meeting, resolved to things in the game. */
interface ActivePlan {
  kind: Exclude<PlanKind, "vote" | "none">;
  /** follow: who to walk with; avoid: who to keep away from. */
  targetId?: string;
  /** meet, search: which room. */
  roomId?: string;
  /** Set when class resumes; the plan ends after this. */
  until?: number;
}

/** Other words people use for a room. */
const ROOM_ALIASES: Record<string, string[]> = {
  library: ["libary"],
  lab: ["lab", "science"],
  canteen: ["cafeteria", "cafe", "kantin"],
  server: ["server"],
  music: ["music"],
  art: ["art"],
  hallway: ["hall"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** True if `text` contains `word` as a whole word (case-insensitive). */
const mentions = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escape(word.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase());

type Goal =
  | { kind: "wander" }
  | { kind: "solve"; terminalId: string; giveUpAt: number }
  | { kind: "help"; terminalId: string; until: number }
  | { kind: "hack"; terminalId: string }
  | { kind: "search"; spotId: string }
  | { kind: "hunt"; targetId: string; giveUpAt: number }
  | { kind: "report"; slipId: string }
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
  /** What it agreed to do after the meeting. */
  plan?: ActivePlan;
  /** Replies waiting to be posted (so they don't appear instantly). */
  outbox: { at: number; reply: BotReply }[];
  repathAt: number;
  /** The last time it agreed to go somewhere with the human (remembered if it then gets expelled). */
  agreed?: { kind: "follow" | "meet"; room?: string; at: number };
  /** When it started being alone with the human while keeping to a plan. */
  aloneSince?: number;
  /** Things it will bring up in the next meeting. */
  clues: string[];
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
  /** Optional AI reply to what someone said in a meeting; resolves to undefined to use keyword matching. */
  reply?: (req: Omit<ReplyRequest, "recentChat">) => Promise<BotReply | undefined>;
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

/** A spot within reach of a terminal but not on top of someone already standing there. */
function standBeside(terminalId: string, taken: Point): Point {
  const t = TERMINALS.find((x) => x.id === terminalId)!;
  const room = roomAt(t)?.id;
  for (const r of [1.0, 1.2, 1.4]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const p = { x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r };
      if (isWalkable(p) && roomAt(p)?.id === room && distance(p, t) <= INTERACT_RADIUS - 0.2 && distance(p, taken) >= 0.8) return p;
    }
  }
  return terminalStand(terminalId);
}

export class BotController {
  private bots: Bot[];
  private now: () => number;
  private random: () => number;
  private seenStrikes = 0;
  private lastPhase: string;
  /** What each bot saw: bot → terminal → classmate seen near it → when. */
  private sightings = new Map<string, Map<string, Map<string, number>>>();
  /** Where and when each bot last saw each classmate (bot → classmate → position). */
  private lastSeen = new Map<string, Map<string, Point & { at: number }>>();
  private repliesThisMeeting = 0;

  constructor(private world: BotWorld) {
    this.now = world.now ?? Date.now;
    this.random = world.random ?? Math.random;
    this.bots = world.botIds.map((id) => ({
      id,
      path: [],
      waitUntil: 0,
      terminalSteps: [],
      suspicion: new Map(),
      searched: new Set(),
      outbox: [],
      repathAt: 0,
      clues: [],
    }));
    this.lastPhase = world.game.phase;
  }

  private get game() {
    return this.world.game;
  }

  /** A classmate's name as people type it: "Rina", not "Rina (bot)". */
  private name(id: string): string {
    return this.world.nameOf(id).replace(/\s*\(bot\)$/, "");
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

    this.syncPhase();

    if (game.phase === "meeting") return this.meetingTick(now);
    if (game.phase !== "playing") return;

    this.watch(now);
    this.noticeStrikes(now);
    for (const bot of this.bots) {
      if (!game.isAlive(bot.id)) continue;
      this.botTick(bot, now, dt);
    }
  }

  private syncPhase() {
    if (this.game.phase !== this.lastPhase) this.onPhaseChange(this.game.phase);
    this.lastPhase = this.game.phase;
  }

  // --- Watching: who stands near which terminal, and blame after a strike ---

  /** What a bot can see: the Bluffer sees everyone (like the player Bluffer); others have limited vision. */
  private sees(bot: Bot, from: Point, to: Point): boolean {
    return this.game.roles.get(bot.id) === "bluffer" || canSee(from, to);
  }

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
        if (!pos || !this.sees(bot, eyes, pos)) continue;
        this.lastSeen.get(bot.id)!.set(id, { x: pos.x, z: pos.z, at: now });
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
        // Keeping to a plan with someone it just saw near the hacked terminal: it backs off.
        const human = this.world.humanId;
        const at = seen.get(human);
        if (at !== undefined && now - at <= MEMORY_MS && this.withHuman(bot)) {
          this.doubt(bot, now, `I was with ${this.name(human)}, then the bot got hacked right where they'd been. I bailed.`);
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

    if (role === "bluffer" && game.expelReady() && this.random() < 0.6) {
      // The Bluffer sees everyone: go after the nearest classmate nobody else can see.
      const alone = game
        .aliveIds()
        .filter((id) => id !== bot.id)
        .map((id) => ({ id, p: this.world.position(id) }))
        .filter((c): c is { id: string; p: PlayerPosition } => Boolean(c.p) && this.unwatched(bot, c.id, c.p!))
        .sort((a, b) => distance(pos, a.p) - distance(pos, b.p));
      if (alone.length) {
        return this.setGoal(bot, { kind: "hunt", targetId: alone[0].id, giveUpAt: now + 15_000 }, alone[0].p);
      }
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

  private roomMiddle(r = this.pick(ROOMS)!): Point {
    return { x: r.x + r.w * (0.25 + this.random() * 0.5), z: r.z + r.d * (0.25 + this.random() * 0.5) };
  }

  /** Nobody alive but the bot can see this classmate right now. */
  private unwatched(bot: Bot, id: string, p: Point): boolean {
    return !this.game.aliveIds().some((o) => {
      if (o === id || o === bot.id) return false;
      const w = this.world.position(o);
      return Boolean(w && canSee(w, p));
    });
  }

  // --- Plans agreed in a meeting ---

  /** Carries out the bot's plan. True when the plan moved the bot this tick (skip normal goals). */
  private followPlan(bot: Bot, pos: PlayerPosition, now: number, dt: number): boolean {
    const game = this.game;
    const plan = bot.plan!;
    if (plan.until === undefined) return false;
    if (now > plan.until) {
      bot.plan = undefined;
      return false;
    }
    // A Bluffer who agreed to stick with you waits for the moment nobody else is watching.
    const human = this.world.humanId;
    const hp = this.world.position(human);
    if (game.roles.get(bot.id) === "bluffer" && (plan.kind === "follow" || plan.kind === "meet") && hp && game.isAlive(human)) {
      if (game.expelReady() && distance(pos, hp) < 5 && this.unwatched(bot, human, hp)) {
        bot.plan = undefined;
        this.setGoal(bot, { kind: "hunt", targetId: human, giveUpAt: now + 10_000 }, hp);
        return true;
      }
    }
    // An honest bot that already has doubts gets nervous when you lead it where nobody else can see.
    if (this.withHuman(bot) && hp && (bot.suspicion.get(human) ?? 0) > 0) {
      if (distance(pos, hp) > 6 || !this.unwatched(bot, human, pos)) bot.aloneSince = undefined;
      else if (bot.aloneSince === undefined) bot.aloneSince = now;
      else if (now - bot.aloneSince > 4000) {
        this.doubt(bot, now, `${this.name(human)} kept leading me somewhere empty. Felt off, so I left.`);
        return false;
      }
    }
    switch (plan.kind) {
      case "follow": {
        const target = plan.targetId ? this.world.position(plan.targetId) : undefined;
        if (!target || !game.isAlive(plan.targetId!)) {
          bot.plan = undefined;
          return false;
        }
        bot.goal = undefined;
        // You're at a terminal: stand within its reach too, so the bot's pieces pool with yours.
        const t = TERMINALS.find((x) => distance(target, x) <= INTERACT_RADIUS + 0.2);
        const close = t ? distance(pos, t) <= INTERACT_RADIUS - 0.1 : distance(pos, target) <= 2;
        if (close) bot.path = [];
        else if (now >= bot.repathAt) {
          bot.path = findPath(pos, t ? standBeside(t.id, target) : target);
          bot.repathAt = now + 700;
        }
        // Don't walk off while you're answering at the terminal together.
        if (t && close && game.hasOpenTerminal(plan.targetId!)) plan.until = Math.max(plan.until, now + 2000);
        if (bot.path.length) this.walk(bot, pos, dt);
        return true;
      }
      case "meet": {
        const spot = this.meetingSpot(plan.roomId!);
        bot.goal = undefined;
        if (distance(pos, spot) > 0.4 && bot.path.length === 0 && now >= bot.repathAt) {
          bot.path = findPath(pos, spot);
          bot.repathAt = now + 3000;
        }
        if (bot.path.length) this.walk(bot, pos, dt);
        return true;
      }
      case "search": {
        if (bot.goal && bot.goal.kind !== "wander") return false;
        const spot = HIDING_SPOTS.filter((s) => roomAt(s)?.id === plan.roomId && !bot.searched.has(s.id)).sort(
          (a, b) => distance(pos, a) - distance(pos, b),
        )[0];
        if (!spot) {
          bot.plan = undefined;
          return false;
        }
        this.setGoal(bot, { kind: "search", spotId: spot.id }, spot);
        return false;
      }
      case "avoid": {
        const target = plan.targetId ? this.world.position(plan.targetId) : undefined;
        if (target && game.isAlive(plan.targetId!) && distance(pos, target) < 6 && now >= bot.repathAt) {
          const middle = (r: (typeof ROOMS)[number]) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 });
          const far = ROOMS.filter((r) => r.id !== "hallway").sort((a, b) => distance(middle(b), target) - distance(middle(a), target))[0];
          this.setGoal(bot, { kind: "wander" }, this.roomMiddle(far));
          bot.repathAt = now + 5000;
        }
        return false;
      }
    }
  }

  /** An honest bot keeping to a follow or meet plan the human asked for. */
  private withHuman(bot: Bot): boolean {
    return (
      this.game.roles.get(bot.id) !== "bluffer" && this.game.isAlive(bot.id) && (bot.plan?.kind === "follow" || bot.plan?.kind === "meet") && bot.plan.until !== undefined
    );
  }

  /** Drops the plan, keeps away from the human for the rest of it, and remembers why. */
  private doubt(bot: Bot, now: number, clue: string) {
    const human = this.world.humanId;
    bot.plan = { kind: "avoid", targetId: human, until: bot.plan?.until ?? now + PLAN_MS };
    bot.suspicion.set(human, (bot.suspicion.get(human) ?? 0) + 1);
    bot.path = [];
    bot.goal = undefined;
    bot.repathAt = 0;
    bot.aloneSince = undefined;
    bot.clues.push(clue);
  }

  /** Where to wait when meeting someone in a room: at its terminal if it has one (so pieces pool), else the middle. */
  private meetingSpot(roomId: string): Point {
    const t = TERMINALS.find((x) => roomAt(x)?.id === roomId);
    if (t) return terminalStand(t.id);
    const r = ROOMS.find((x) => x.id === roomId)!;
    return { x: r.x + r.w / 2, z: r.z + r.d / 2 };
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

    // Anyone but the Bluffer reports an expulsion slip they can see.
    if (game.roles.get(bot.id) !== "bluffer" && bot.goal?.kind !== "report") {
      const slip = game.slips.find((s) => canSee(pos, s));
      if (slip) return this.setGoal(bot, { kind: "report", slipId: slip.id }, slip);
    }
    if (bot.goal?.kind === "report") {
      const slipId = bot.goal.slipId;
      const slip = game.slips.find((s) => s.id === slipId);
      if (!slip) bot.goal = undefined;
      else if (distance(pos, slip) <= SLIP_REPORT_RADIUS) {
        bot.goal = undefined;
        return this.try(() => game.reportSlip(bot.id, slip.id));
      }
    }
    // The Bluffer bot follows its target and expels them when they're within reach.
    if (bot.goal?.kind === "hunt") {
      const goal = bot.goal;
      const target = this.world.position(goal.targetId);
      if (!target || !game.isAlive(goal.targetId) || now > goal.giveUpAt || !this.sees(bot, pos, target)) {
        bot.goal = undefined;
      } else if (distance(pos, target) <= EXPEL_RADIUS) {
        bot.goal = undefined;
        bot.waitUntil = now + 800;
        return this.try(() => game.expel(bot.id, goal.targetId));
      } else if (bot.path.length === 0 || this.random() < 0.05) {
        bot.path = findPath(pos, target);
      }
    }

    if (bot.plan && bot.goal?.kind !== "hunt" && bot.goal?.kind !== "report" && this.followPlan(bot, pos, now, dt)) return;

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
      bot.outbox = [];
      // A plan agreed in the meeting starts when class resumes.
      if (phase === "playing" && bot.plan) bot.plan.until = now + PLAN_MS;
      if (phase === "voteResult") bot.clues = [];
      if (phase === "meeting") {
        bot.plan = undefined;
        bot.aloneSince = undefined;
        this.repliesThisMeeting = 0;
        bot.chatAt = now + 2000 + this.random() * 6000;
        bot.voteAt = now + 20_000 + this.random() * 15_000;
        const report = this.game.meetingReport;
        // Saw the expel happen: certain.
        if (report && this.game.lastExpelWitnesses.includes(bot.id)) {
          const bluffer = [...this.game.roles].find(([, r]) => r === "bluffer")?.[0];
          if (bluffer) bot.suspicion.set(bluffer, (bot.suspicion.get(bluffer) ?? 0) + 10);
        }
        // The expelled classmate had just gone off with the human: everyone remembers.
        const victim = report && this.bots.find((b) => b.id === report.victimId);
        if (victim?.agreed && victim !== bot && now - victim.agreed.at < 150_000) {
          const h = this.name(this.world.humanId);
          const v = this.name(victim.id);
          bot.clues.push(
            victim.agreed.kind === "follow"
              ? `${h} asked ${v} to follow them, and then ${v} got expelled.`
              : `${h} told ${v} to meet them in the ${victim.agreed.room}, and then ${v} got expelled.`,
          );
          bot.suspicion.set(this.world.humanId, (bot.suspicion.get(this.world.humanId) ?? 0) + 3);
        }
        if (report) {
          for (const [pid, seen] of this.lastSeen.get(bot.id) ?? []) {
            if (pid === bot.id || pid === report.victimId || now - seen.at > MEMORY_MS) continue;
            if (distance(seen, report) <= 7) bot.suspicion.set(pid, (bot.suspicion.get(pid) ?? 0) + 2);
          }
        }
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
      .map(([pid]) => this.name(pid));
    return {
      botName: this.name(bot.id),
      isBluffer: this.game.roles.get(bot.id) === "bluffer",
      room: room === "the hallway" ? room : `the ${room}`,
      suspects,
      others: this.game.aliveIds().filter((id) => id !== bot.id).map((id) => this.name(id)),
      clues: bot.clues,
      pieces: this.game.bagTexts(bot.id),
    };
  }

  private chatLine(bot: Bot): string {
    const pos = this.world.position(bot.id);
    const here = pos ? roomAt(pos)?.name ?? "the hallway" : "the hallway";
    const isBluffer = this.game.roles.get(bot.id) === "bluffer";
    const suspect = this.topSuspect(bot);
    if (bot.clues.length) return bot.clues[bot.clues.length - 1];
    if (isBluffer) {
      const elsewhere = this.pick(ROOMS.filter((r) => r.name !== here && r.id !== "hallway"))!.name;
      const scapegoat = this.pick(this.game.aliveIds().filter((id) => id !== bot.id));
      return this.random() < 0.5 || !scapegoat
        ? `I was in the ${elsewhere} the whole time, collecting pieces.`
        : `${this.name(scapegoat)} keeps hanging around the terminals… sus.`;
    }
    if (suspect) return `I saw ${this.name(suspect)} near the terminal before the strike!`;
    return this.pick([`I was in the ${here}.`, "Not me! I've been looking for pieces.", "Did anyone see who used that terminal?"])!;
  }

  // --- Talking to the bots ---

  /** How much a bot suspects someone, in words. */
  private trustOf(bot: Bot, id: string): ReplyRequest["trustOfSpeaker"] {
    const n = bot.suspicion.get(id) ?? 0;
    if (n === 0) return "not at all";
    return this.topSuspect(bot) === id && n >= 2 ? "a lot" : "a little";
  }

  private roomIn(text: string) {
    return ROOMS.find((r) => [r.name, ...(ROOM_ALIASES[r.id] ?? [])].some((w) => mentions(text, w)));
  }

  private playerIn(text: string, except: string): string | undefined {
    return this.game.aliveIds().find((id) => id !== except && mentions(text, this.name(id)));
  }

  /**
   * Without the AI: understand a few common requests by keywords, and answer like the AI
   * would (honest bots are wary of someone they suspect; the Bluffer agrees to anything but voting itself).
   */
  keywordReply(botId: string, speakerId: string, text: string, addressed: boolean): BotReply | undefined {
    const bot = this.bots.find((b) => b.id === botId)!;
    const lower = text.toLowerCase();
    const room = this.roomIn(lower);
    const player = this.playerIn(lower, speakerId);
    const name = player ? this.name(player) : "";
    const isBluffer = this.game.roles.get(bot.id) === "bluffer";
    const wary = !isBluffer && this.trustOf(bot, speakerId) === "a lot";
    let plan: BotPlan = { kind: "none", target: "" };
    if (player && /\b(vote|sus|bluffer|hacker|hacked|did it|kick|saw|caught)\b/.test(lower)) plan = { kind: "vote", target: name };
    else if (player && /(stay away|avoid|don'?t trust|do not trust|keep away)/.test(lower)) plan = { kind: "avoid", target: name };
    else if (room && /\b(search|check|look|find)\b/.test(lower)) plan = { kind: "search", target: room.name };
    else if (room && /\b(meet|go|come|wait|head|see you|let'?s|lets)\b/.test(lower)) plan = { kind: "meet", target: room.name };
    else if (/(follow|come with|with me|stick with|go with|join me|stay with)/.test(lower)) plan = { kind: "follow", target: "" };

    const none: BotPlan = { kind: "none", target: "" };
    const suspect = this.topSuspect(bot);
    switch (plan.kind) {
      case "vote":
        if (player === bot.id) return { say: isBluffer ? "Me? No way, I was looking for pieces the whole time." : "It wasn't me, I promise!", plan: none };
        if (!isBluffer && suspect && suspect !== player) return { say: `Not sure… I saw ${this.name(suspect)} near the terminal.`, plan: none };
        // No evidence of its own: it wants a reason before voting.
        if (!isBluffer && !bot.suspicion.get(player!) && !room && !/\b(saw|seen|caught|watched|near|terminal|hack|hacking|hacked|lied|lying)\b/.test(lower)) {
          return { say: this.pick([`Why ${name}? What did you see?`, `I didn't see ${name} do anything. Proof?`])!, plan: none };
        }
        return { say: `Yeah, ${name} does seem sus.`, plan };
      case "avoid":
        if (player === bot.id) return { say: "Hey, I didn't do anything!", plan: none };
        return { say: `Got it, I'll keep away from ${name}.`, plan };
      case "follow":
        if (wary) return { say: "Hmm, I'm not going anywhere alone with you.", plan: none };
        return { say: this.pick(["Okay, I'll stick with you.", "Sure, lead the way.", "Fine, I'll follow you."])!, plan };
      case "meet":
        if (wary) return { say: `No thanks, I'll stay away from the ${room!.name}.`, plan: none };
        return { say: `Okay, see you in the ${room!.name}.`, plan };
      case "search":
        return { say: `On it, I'll check the ${room!.name}.`, plan };
    }
    // Asked about pieces: say what's in the bag (the Bluffer too; it has nothing to hide there).
    if (/\bpieces?\b/.test(lower)) {
      const pieces = this.game.bagTexts(bot.id);
      return { say: pieces.length ? `I've got ${pieces.map((t) => `"${t}"`).join(" and ")}.` : "No pieces yet, still looking.", plan: none };
    }
    // Not a request: only answer if spoken to.
    return addressed ? { say: this.chatLine(bot), plan: none } : undefined;
  }

  /** Turns a plan (from the AI or keywords) into something the bot will do; false if it doesn't make sense. */
  private adopt(bot: Bot, speakerId: string, plan: BotPlan): boolean {
    const isBluffer = this.game.roles.get(bot.id) === "bluffer";
    const target = plan.target.toLowerCase();
    switch (plan.kind) {
      case "follow":
        bot.plan = { kind: "follow", targetId: speakerId };
        bot.agreed = { kind: "follow", at: this.now() };
        return true;
      case "meet":
      case "search": {
        const room = this.roomIn(target);
        if (!room) return false;
        bot.plan = { kind: plan.kind, roomId: room.id };
        if (plan.kind === "meet") bot.agreed = { kind: "meet", room: room.name, at: this.now() };
        return true;
      }
      case "avoid":
      case "vote": {
        const id = this.playerIn(target, "");
        // Nobody asks you to vote against them: "vote Sam" from Sam is a misread.
        if (!id || id === bot.id || id === speakerId) return false;
        if (plan.kind === "avoid") bot.plan = { kind: "avoid", targetId: id };
        else bot.suspicion.set(id, (bot.suspicion.get(id) ?? 0) + (isBluffer ? 8 : 3));
        return true;
      }
      case "none":
        return true;
    }
  }

  /**
   * Someone said something in a meeting. If it was the human, one or two bots answer
   * (or the ones it names), and may agree to a plan they carry out after the meeting.
   */
  hear(fromId: string, text: string): void {
    const game = this.game;
    if (game.phase !== "meeting" || fromId !== this.world.humanId || game.over) return;
    this.syncPhase();
    if (this.repliesThisMeeting >= MAX_REPLIES_PER_MEETING) return;
    const now = this.now();
    const living = this.bots.filter((b) => game.isAlive(b.id));
    if (!living.length) return;
    const lower = text.toLowerCase();
    const named = living.filter((b) => mentions(lower, this.name(b.id)));
    const toEveryone = /\b(everyone|everybody|all of you|guys|y'?all|team|you all)\b/.test(lower);
    // "vote Kevin" names Kevin, but it's said to the others.
    const aboutSomeone = /\b(vote|sus|avoid|trust|away|bluffer|hacker)\b/.test(lower);
    let responders: Bot[];
    if (toEveryone) responders = living;
    else if (named.length && !aboutSomeone) responders = named;
    else {
      const others = living.filter((b) => !named.includes(b)).sort(() => this.random() - 0.5);
      responders = [...named, ...others.slice(0, this.random() < 0.35 ? 2 : 1)];
    }
    // You're still talking: nobody votes until you've had your say.
    for (const bot of living) if (bot.voteAt !== undefined) bot.voteAt = Math.max(bot.voteAt, now + 15_000);
    responders = responders.slice(0, MAX_REPLIES_PER_MEETING - this.repliesThisMeeting);
    this.repliesThisMeeting += responders.length;

    responders.forEach((bot, i) => {
      const addressed = named.includes(bot) || toEveryone;
      const delay = 1200 + i * 1500 + this.random() * 1000;
      const fallback = this.keywordReply(bot.id, fromId, text, addressed);
      const post = (reply: BotReply | undefined) => {
        if (!reply || game.phase !== "meeting") return;
        bot.outbox.push({ at: Math.max(this.now(), now + delay), reply });
        bot.outbox.sort((x, y) => x.at - y.at);
      };
      if (!this.world.reply) return post(fallback);
      void this.world
        .reply({
          ...this.meetingFacts(bot),
          speaker: this.name(fromId),
          message: text,
          addressed,
          trustOfSpeaker: this.trustOf(bot, fromId),
          rooms: ROOMS.map((r) => r.name),
        })
        .then((reply) => post(reply ?? fallback));
    });
  }

  private meetingTick(now: number) {
    for (const bot of this.bots) {
      if (!this.game.isAlive(bot.id)) continue;
      while (bot.outbox.length && now >= bot.outbox[0].at) {
        const { reply } = bot.outbox.shift()!;
        this.try(() => this.game.chat(bot.id, reply.say));
        this.adopt(bot, this.world.humanId, reply.plan);
      }
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
