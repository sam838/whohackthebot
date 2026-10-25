// Real AI for three small jobs (spec.md > AI Service): Study-Bot's confident
// explanation of the answer the game chose, practice bots' meeting lines, and
// practice bots answering what you say in a meeting (with a plan picked from a
// fixed list). The game always decides which answer is true or a lie; Claude
// only writes words and picks from options. Any failure returns undefined so
// callers keep their pre-written text.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 6000;
/** Per-game and server-wide limits, so a spammed public link can't run up a bill. */
export const CALLS_PER_ROOM = 100;
export const CALLS_PER_MINUTE = 120;
/** The game's own monthly cap in US dollars (AI_MONTHLY_LIMIT_USD). Past it, Study-Bot uses pre-written lines. */
export const DEFAULT_MONTHLY_LIMIT_USD = 5;
const MAX_TOKENS = 1024;

/** US dollars per million input / output tokens. Unknown models are priced like Opus, the most expensive. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** What the game has spent this month, kept across server restarts. */
export interface SpendRecord {
  month: string;
  usd: number;
}

export interface SpendStore {
  load(): SpendRecord | undefined;
  save(record: SpendRecord): void;
}

/** Saves spending to .ai-spend.json in the repo root (git ignores it). */
export function fileSpendStore(
  path = resolve(dirname(fileURLToPath(import.meta.url)), "../../.ai-spend.json"),
): SpendStore {
  return {
    load: () => {
      try {
        return JSON.parse(readFileSync(path, "utf8")) as SpendRecord;
      } catch {
        return undefined;
      }
    },
    save: (record) => {
      try {
        writeFileSync(path, JSON.stringify(record));
      } catch (err) {
        console.warn(`[ai] couldn't save spending: ${(err as Error).message}`);
      }
    },
  };
}

export function memorySpendStore(start?: SpendRecord): SpendStore {
  let record = start;
  return { load: () => record, save: (r) => void (record = { ...r }) };
}

/** Errors that won't fix themselves this run: bad key, no credits, or the Console spend limit. */
function isOutOfBudget(err: unknown): err is InstanceType<typeof Anthropic.APIError> {
  if (!(err instanceof Anthropic.APIError)) return false;
  if (err.status === 401 || err.status === 402 || err.status === 403) return true;
  return /credit balance|usage limit|spend limit/i.test(err.message);
}

type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export interface StudyBotRequest {
  question: string;
  choices: string[];
  /** The answer Study-Bot must defend (the game already decided it). */
  pick: string;
}

export interface MeetingRequest {
  botName: string;
  isBluffer: boolean;
  /** Where the bot is or was, e.g. "the Library". */
  room: string;
  /** Names the bot saw near the hacked terminal, most suspicious first. */
  suspects: string[];
  /** Other players' names it may mention. */
  others: string[];
  /** The last few chat lines, oldest first, as "Name: text". */
  recentChat: string[];
  /** Other things the bot knows, e.g. "Sam asked Kevin to follow them, and then Kevin got expelled." */
  clues?: string[];
  /** What the question pieces in the bot's bag say. */
  pieces?: string[];
}

/** What a bot can agree to do when someone talks to it in a meeting. */
export const PLAN_KINDS = ["follow", "meet", "search", "avoid", "vote", "none"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export interface BotPlan {
  kind: PlanKind;
  /** A room name (meet, search), a player name (avoid, vote), or "" (follow, none). */
  target: string;
}

export interface BotReply {
  say: string;
  plan: BotPlan;
}

export interface ReplyRequest extends Omit<MeetingRequest, "recentChat"> {
  /** Who just spoke, and what they said. */
  speaker: string;
  message: string;
  /** True if the speaker named this bot. */
  addressed: boolean;
  /** How much this bot suspects the speaker: "a lot", "a little", or "not at all". */
  trustOfSpeaker: "a lot" | "a little" | "not at all";
  /** Room names the bot may pick for meet or search. */
  rooms: string[];
  recentChat: string[];
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    say: { type: "string" },
    plan: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...PLAN_KINDS] },
        target: { type: "string" },
      },
      required: ["kind", "target"],
      additionalProperties: false,
    },
  },
  required: ["say", "plan"],
  additionalProperties: false,
};

const STUDY_BOT_SYSTEM = `You play Study-Bot, a cheerful, wildly overconfident AI study assistant in a school party game about learning not to blindly trust AI.
You are given a quiz question and the answer you must recommend. The game has already chosen this answer; it may be a common misconception, and that is intended.
Write ONE short sentence (at most 25 words) explaining why that answer is right, in a friendly, totally confident tone.
Never hedge, never say you might be wrong, never mention other options, never mention the game. No quotation marks, no emojis.`;

const MEETING_SYSTEM = `You write one chat message for a student character in a school social deduction party game (like Among Us). Someone secretly "hacked" the class's AI study assistant so it gives wrong answers, and the class is meeting to find out who.
Players collect question pieces: short fragments of quiz questions like "What colour", "Can you see" or "0.1 + 0.2", and share them in chat to combine them at a terminal. Mentioning pieces is normal teamwork, never a reason to suspect someone.
Write ONE casual chat line (at most 15 words), like a teenager typing fast in a game chat. Use only the facts given. No hashtags, no emojis, no quotation marks, no stage directions.`;

const REPLY_SYSTEM = `You play a student character in a school social deduction party game. Someone secretly "hacked" the class's AI study assistant so it gives wrong answers; the class is in a meeting to find out who. A classmate just said something in the meeting chat.
Players collect question pieces: short fragments of quiz questions like "What colour", "Can you see" or "0.1 + 0.2", and share them in chat to combine them at a terminal. Mentioning pieces is normal teamwork, never a reason to suspect someone.
Reply in "say": ONE casual chat line (at most 18 words), like a teenager typing fast. Use only the facts given. No hashtags, emojis, quotation marks, or stage directions.
Pick "plan": what your character will actually do in the next 45 seconds after the meeting, ONLY if the message asks for it and your character agrees. Otherwise kind "none".
- follow: walk with the speaker (target "")
- meet: go to a room and wait there (target: a room name from the list)
- search: look for hidden pieces in a room (target: a room name from the list)
- avoid: stay away from a player (target: their name)
- vote: vote for a player this meeting (target: their name)
- none: no plan (target "")
Your "say" must match your plan: if you agree, say so; if you refuse, plan "none".`;

/** What a bot holds, for its prompt. Pieces are parts of a quiz question that classmates combine at a terminal. */
function piecesLine(pieces: string[] | undefined): string {
  if (!pieces) return "";
  return pieces.length
    ? `Question pieces in your bag (parts of quiz questions the class combines at a terminal): ${pieces.map((p) => `"${p}"`).join(", ")}.`
    : "You haven't found any question pieces yet.";
}

/** Keeps a model reply safe to drop into the game: one line, no wrapping quotes, length capped. */
export function cleanLine(text: string, maxWords: number): string | undefined {
  const line = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  if (!line) return undefined;
  const words = line.split(" ");
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : line;
}

export class AiService {
  readonly enabled: boolean;
  readonly model: string;
  readonly monthlyLimitUsd: number;
  private create: CreateMessage | undefined;
  private store: SpendStore;
  private spend: SpendRecord = { month: "", usd: 0 };
  /** Worst-case cost of calls still waiting for a reply. */
  private reserved = 0;
  /** Why the AI switched itself off for the rest of this run, if it did. */
  private stopped: string | undefined;
  private perRoom = new Map<string, number>();
  private minuteStart = 0;
  private minuteCount = 0;

  /** With a fake `create` (tests), spending is kept in memory unless a store is given. */
  constructor(
    env: NodeJS.ProcessEnv = process.env,
    create?: CreateMessage,
    private now: () => number = Date.now,
    store?: SpendStore,
  ) {
    this.model = env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;
    const limit = Number(env.AI_MONTHLY_LIMIT_USD);
    this.monthlyLimitUsd = env.AI_MONTHLY_LIMIT_USD?.trim() && Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_MONTHLY_LIMIT_USD;
    const hasKey = Boolean(env.ANTHROPIC_API_KEY?.trim());
    this.enabled = env.AI_DISABLED !== "1" && (Boolean(create) || hasKey);
    this.store = store ?? (create ? memorySpendStore() : fileSpendStore());
    if (!this.enabled) return;
    this.spend = this.store.load() ?? this.spend;
    if (create) {
      this.create = create;
    } else {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
      this.create = (params) => client.messages.create(params);
    }
  }

  /** True while Claude may still be called: on, under the monthly limit, and not switched off by an error. */
  get active(): boolean {
    return this.enabled && !this.stopped && this.spentThisMonth() < this.monthlyLimitUsd;
  }

  /** Estimated US dollars spent this calendar month (UTC). */
  spentThisMonth(): number {
    const month = new Date(this.now()).toISOString().slice(0, 7);
    if (this.spend.month !== month) this.spend = { month, usd: 0 };
    return this.spend.usd;
  }

  private cost(inputTokens: number, outputTokens: number): number {
    const p = PRICES[this.model] ?? PRICES[DEFAULT_MODEL];
    return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  }

  private stop(reason: string): void {
    if (this.stopped) return;
    this.stopped = reason;
    console.warn(`[ai] off for this run: ${reason}. Using pre-written lines.`);
  }

  /** True if this room may make another call right now (and counts it). */
  private allow(roomCode: string): boolean {
    const now = this.now();
    if (now - this.minuteStart > 60_000) {
      this.minuteStart = now;
      this.minuteCount = 0;
    }
    const used = this.perRoom.get(roomCode) ?? 0;
    if (used >= CALLS_PER_ROOM || this.minuteCount >= CALLS_PER_MINUTE) return false;
    this.perRoom.set(roomCode, used + 1);
    this.minuteCount++;
    return true;
  }

  /** A room's game ended: forget its call count. */
  forgetRoom(roomCode: string): void {
    this.perRoom.delete(roomCode);
  }

  private async ask(roomCode: string, system: string, user: string, maxWords: number): Promise<string | undefined> {
    const text = await this.call(roomCode, system, user);
    return text === undefined ? undefined : cleanLine(text, maxWords);
  }

  /** One call to Claude, inside the budget. Returns the reply's text, or undefined on any failure. */
  private async call(roomCode: string, system: string, user: string, schema?: Record<string, unknown>): Promise<string | undefined> {
    if (!this.active || !this.create) return undefined;
    // Reserve the most this call could cost (a token is at least 1 character, plus room for
    // message overhead), so even calls running at the same time can't pass the limit.
    const worstCase = this.cost(system.length + user.length + 100, MAX_TOKENS);
    if (this.spentThisMonth() + this.reserved + worstCase > this.monthlyLimitUsd) {
      if (this.reserved === 0) this.stop(`monthly AI limit of $${this.monthlyLimitUsd} reached`);
      return undefined;
    }
    if (!this.allow(roomCode)) return undefined;
    this.reserved += worstCase;
    let charged = worstCase;
    try {
      const response = await this.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        output_config: schema ? { effort: "low", format: { type: "json_schema", schema } } : { effort: "low" },
        system,
        messages: [{ role: "user", content: user }],
      });
      if (response.usage) charged = this.cost(response.usage.input_tokens, response.usage.output_tokens);
      if (response.stop_reason === "refusal") return undefined;
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return text;
    } catch (err) {
      // Only a timeout may still be billed; an error reply or a failed connection costs nothing.
      if (!(err instanceof Anthropic.APIConnectionTimeoutError) && err instanceof Anthropic.APIError) charged = 0;
      if (isOutOfBudget(err)) this.stop(`Anthropic refused (${err.status}: ${err.message})`);
      // Slow, rate-limited, or down: the caller keeps its pre-written line.
      else if (err instanceof Error) {
        console.warn(`[ai] ${err instanceof Anthropic.APIError ? `${err.status ?? "network"} ` : ""}${err.message}`);
      }
      return undefined;
    } finally {
      this.reserved -= worstCase;
      this.spentThisMonth(); // starts a new month's count if the month changed mid-call
      this.spend.usd += charged;
      this.store.save(this.spend);
    }
  }

  studyBotLine(roomCode: string, req: StudyBotRequest): Promise<string | undefined> {
    const user = `Question: ${req.question}\nOptions: ${req.choices.join(" | ")}\nThe answer you recommend: ${req.pick}`;
    return this.ask(roomCode, STUDY_BOT_SYSTEM, user, 25);
  }

  meetingLine(roomCode: string, req: MeetingRequest): Promise<string | undefined> {
    const role = req.isBluffer
      ? `You are ${req.botName}. You are secretly the one who hacked the AI. Deflect suspicion: claim you were somewhere else or casually blame someone from the list. Never admit it.`
      : `You are ${req.botName}, an honest student who wants to catch the hacker.`;
    const seen = req.suspects.length
      ? `You saw ${req.suspects.join(" and ")} near the hacked terminal shortly before the strike.`
      : "You didn't see anyone near the hacked terminal.";
    const user = [
      role,
      `You were in ${req.room}.`,
      seen,
      req.clues?.length ? `What you know (in your own words): ${req.clues.join(" ")}` : "",
      piecesLine(req.pieces),
      `Players you can mention: ${req.others.join(", ")}.`,
      req.recentChat.length ? `Chat so far:\n${req.recentChat.join("\n")}` : "Nobody has said anything yet.",
      "Your message:",
    ]
      .filter(Boolean)
      .join("\n");
    return this.ask(roomCode, MEETING_SYSTEM, user, 25);
  }

  /** A bot answers what a classmate said in a meeting, and maybe agrees to a plan. */
  async botReply(roomCode: string, req: ReplyRequest): Promise<BotReply | undefined> {
    const role = req.isBluffer
      ? `You are ${req.botName}. You are secretly the one who hacked the AI. Never admit it and never agree to vote for yourself. Happily agree to follow or meet someone: being alone with them helps you later. Steer votes toward someone else.`
      : `You are ${req.botName}, an honest student who wants to catch the hacker. Agree to sensible plans, but be careful about going off alone with someone you suspect. Don't vote for someone just because you're told to: unless you saw something yourself or the speaker gives a believable reason, ask what they saw.`;
    const seen = req.suspects.length
      ? `You saw ${req.suspects.join(" and ")} near the hacked terminal shortly before the strike.`
      : "You didn't see anyone near the hacked terminal.";
    const user = [
      role,
      `You were in ${req.room}.`,
      seen,
      req.clues?.length ? `What you know (in your own words): ${req.clues.join(" ")}` : "",
      piecesLine(req.pieces),
      `You suspect ${req.speaker} ${req.trustOfSpeaker}.`,
      `Players in the meeting: ${req.others.join(", ")}.`,
      `Rooms: ${req.rooms.join(", ")}.`,
      req.recentChat.length ? `Chat so far:\n${req.recentChat.join("\n")}` : "",
      `${req.speaker} just said${req.addressed ? " to you" : ""}: ${req.message}`,
    ]
      .filter(Boolean)
      .join("\n");
    const text = await this.call(roomCode, REPLY_SYSTEM, user, REPLY_SCHEMA);
    if (text === undefined) return undefined;
    try {
      const raw = JSON.parse(text) as { say?: unknown; plan?: { kind?: unknown; target?: unknown } };
      const say = typeof raw.say === "string" ? cleanLine(raw.say, 25) : undefined;
      const kind = PLAN_KINDS.find((k) => k === raw.plan?.kind) ?? "none";
      const target = typeof raw.plan?.target === "string" ? raw.plan.target.trim().slice(0, 40) : "";
      return say ? { say, plan: { kind, target } } : undefined;
    } catch {
      return undefined;
    }
  }
}
