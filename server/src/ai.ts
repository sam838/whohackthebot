// Real AI for two small jobs (spec.md > AI Service): Study-Bot's confident
// explanation of the answer the game chose, and practice bots' meeting lines.
// The game always decides which answer is true or a lie; Claude only writes
// words. Any failure returns undefined so callers keep their pre-written text.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 6000;
/** Per-game and server-wide limits, so a spammed public link can't run up a bill. */
export const CALLS_PER_ROOM = 60;
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
}

const STUDY_BOT_SYSTEM = `You play Study-Bot, a cheerful, wildly overconfident AI study assistant in a school party game about learning not to blindly trust AI.
You are given a quiz question and the answer you must recommend. The game has already chosen this answer; it may be a common misconception, and that is intended.
Write ONE short sentence (at most 25 words) explaining why that answer is right, in a friendly, totally confident tone.
Never hedge, never say you might be wrong, never mention other options, never mention the game. No quotation marks, no emojis.`;

const MEETING_SYSTEM = `You write one chat message for a student character in a school social deduction party game (like Among Us). Someone secretly "hacked" the class's AI study assistant so it gives wrong answers, and the class is meeting to find out who.
Write ONE casual chat line (at most 15 words), like a teenager typing fast in a game chat. Use only the facts given. No hashtags, no emojis, no quotation marks, no stage directions.`;

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
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: user }],
      });
      if (response.usage) charged = this.cost(response.usage.input_tokens, response.usage.output_tokens);
      if (response.stop_reason === "refusal") return undefined;
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return cleanLine(text, maxWords);
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
      `Players you can mention: ${req.others.join(", ")}.`,
      req.recentChat.length ? `Chat so far:\n${req.recentChat.join("\n")}` : "Nobody has said anything yet.",
      "Your message:",
    ].join("\n");
    return this.ask(roomCode, MEETING_SYSTEM, user, 25);
  }
}
