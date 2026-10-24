import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AiService, CALLS_PER_ROOM, cleanLine, memorySpendStore } from "./ai";

/** A fake Claude that answers with fixed text (or a refusal/error), and records requests. */
function fake(reply: string | "refusal" | "error") {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const create = async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    calls.push(params);
    if (reply === "error") throw new Error("boom");
    return {
      stop_reason: reply === "refusal" ? "refusal" : "end_turn",
      content: reply === "refusal" ? [] : [{ type: "text", text: reply }],
      usage: { input_tokens: 300, output_tokens: 40 },
    } as unknown as Anthropic.Message;
  };
  return { create, calls };
}

const question = { question: "Which planet has the hottest surface?", choices: ["Mercury", "Venus", "Mars", "Jupiter"], pick: "Mercury" };

describe("AiService", () => {
  it("is off without an API key, and off when AI_DISABLED=1", async () => {
    const off = new AiService({});
    expect(off.enabled).toBe(false);
    expect(await off.studyBotLine("ROOM", question)).toBeUndefined();
    expect(new AiService({ ANTHROPIC_API_KEY: "x", AI_DISABLED: "1" }).enabled).toBe(false);
  });

  it("uses Claude Opus 5.5 by default, or the model in CLAUDE_MODEL", () => {
    expect(new AiService({}, fake("hi").create).model).toBe("claude-opus-5-5");
    expect(new AiService({ CLAUDE_MODEL: "claude-haiku-5-5" }, fake("hi").create).model).toBe("claude-haiku-5-5");
  });

  it("asks Study-Bot to defend the answer the game chose, and returns a clean line", async () => {
    const f = fake('"Mercury is closest to the Sun, so it is obviously the hottest!"');
    const ai = new AiService({}, f.create);
    expect(await ai.studyBotLine("ROOM", question)).toBe("Mercury is closest to the Sun, so it is obviously the hottest!");
    const sent = f.calls[0];
    expect(JSON.stringify(sent.messages)).toContain("The answer you recommend: Mercury");
    expect(sent.output_config?.effort).toBe("low");
  });

  it("gives a Bluffer bot instructions to deflect, and an honest bot its real sightings", async () => {
    const f = fake("I was in the Library the whole time!");
    const ai = new AiService({}, f.create);
    const base = { botName: "Kevin", room: "the Library", others: ["Rina", "Sam"], recentChat: [] };
    await ai.meetingLine("ROOM", { ...base, isBluffer: true, suspects: [] });
    await ai.meetingLine("ROOM", { ...base, isBluffer: false, suspects: ["Rina"] });
    expect(JSON.stringify(f.calls[0].messages)).toContain("secretly the one who hacked");
    expect(JSON.stringify(f.calls[1].messages)).toContain("You saw Rina near the hacked terminal");
  });

  it("returns undefined on a refusal or an error, so callers keep their pre-written line", async () => {
    expect(await new AiService({}, fake("refusal").create).studyBotLine("ROOM", question)).toBeUndefined();
    expect(await new AiService({}, fake("error").create).studyBotLine("ROOM", question)).toBeUndefined();
  });

  it("asks for a reply plus a plan as JSON, and keeps only plans from the list", async () => {
    const req = {
      botName: "Kevin",
      isBluffer: false,
      room: "the Library",
      suspects: [],
      others: ["Rina", "Sam"],
      speaker: "Sam",
      message: "Kevin, meet me in the Gym",
      addressed: true,
      trustOfSpeaker: "not at all" as const,
      rooms: ["Gym", "Library"],
      recentChat: [],
    };
    const f = fake(JSON.stringify({ say: "Sure, see you in the Gym!", plan: { kind: "meet", target: "Gym" } }));
    const ai = new AiService({}, f.create);
    expect(await ai.botReply("ROOM", req)).toEqual({ say: "Sure, see you in the Gym!", plan: { kind: "meet", target: "Gym" } });
    expect(f.calls[0].output_config?.format?.type).toBe("json_schema");
    expect(JSON.stringify(f.calls[0].messages)).toContain("Sam just said to you: Kevin, meet me in the Gym");

    const odd = fake(JSON.stringify({ say: "ok", plan: { kind: "dance", target: "" } }));
    expect((await new AiService({}, odd.create).botReply("ROOM", req))?.plan.kind).toBe("none");
    expect(await new AiService({}, fake("not json").create).botReply("ROOM", req)).toBeUndefined();
  });

  it("stops calling after the per-game limit", async () => {
    const f = fake("Trust me!");
    const ai = new AiService({}, f.create);
    for (let i = 0; i < CALLS_PER_ROOM + 5; i++) await ai.studyBotLine("ROOM", question);
    expect(f.calls).toHaveLength(CALLS_PER_ROOM);
    expect(await ai.studyBotLine("OTHER", question)).toBe("Trust me!");
  });
});

describe("AiService monthly limit", () => {
  const OCT = Date.UTC(2026, 9, 15);
  const NOV = Date.UTC(2026, 10, 1);

  it("switches to pre-written lines before spending passes the limit", async () => {
    const f = fake("Trust me!");
    const store = memorySpendStore();
    const ai = new AiService({ AI_MONTHLY_LIMIT_USD: "0.05" }, f.create, () => OCT, store);
    for (let i = 0; i < 40; i++) await ai.studyBotLine(`ROOM${i}`, question);
    expect(f.calls.length).toBeGreaterThan(0);
    expect(f.calls.length).toBeLessThan(40);
    expect(ai.spentThisMonth()).toBeLessThanOrEqual(0.05);
    expect(store.load()?.usd).toBeCloseTo(ai.spentThisMonth());
    expect(ai.active).toBe(false);
    expect(await ai.studyBotLine("LATE", question)).toBeUndefined();
  });

  it("counts calls still in flight, so many at once can't pass the limit either", async () => {
    const f = fake("Trust me!");
    const ai = new AiService({ AI_MONTHLY_LIMIT_USD: "0.05" }, f.create, () => OCT);
    await Promise.all(Array.from({ length: 20 }, (_, i) => ai.studyBotLine(`ROOM${i}`, question)));
    // Opus worst case is about $0.023 a call, so only 2 fit under $0.05 at the same moment.
    expect(f.calls).toHaveLength(2);
  });

  it("remembers this month's spending across restarts and starts fresh next month", () => {
    const store = memorySpendStore({ month: "2026-10", usd: 5 });
    expect(new AiService({}, fake("hi").create, () => OCT, store).active).toBe(false);
    expect(new AiService({}, fake("hi").create, () => NOV, store).active).toBe(true);
  });

  it("switches off for the run when Anthropic says the spend limit or credits ran out", async () => {
    let calls = 0;
    const create = async () => {
      calls++;
      throw Anthropic.APIError.generate(402, { type: "error", error: { type: "billing_error", message: "no credits" } }, undefined, new Headers());
    };
    const ai = new AiService({}, create, () => OCT);
    expect(await ai.studyBotLine("ROOM", question)).toBeUndefined();
    expect(ai.active).toBe(false);
    await ai.studyBotLine("ROOM", question);
    expect(calls).toBe(1);
    expect(ai.spentThisMonth()).toBe(0);
  });

  it("keeps trying after an ordinary error like a timeout", async () => {
    const ai = new AiService({}, fake("error").create, () => OCT);
    await ai.studyBotLine("ROOM", question);
    expect(ai.active).toBe(true);
  });
});

describe("cleanLine", () => {
  it("collapses whitespace, strips wrapping quotes, and caps the length", () => {
    expect(cleanLine('  "Hello\n  there"  ', 10)).toBe("Hello there");
    expect(cleanLine("one two three four five", 3)).toBe("one two three…");
    expect(cleanLine("   ", 5)).toBeUndefined();
  });
});
