import { describe, expect, it } from "vitest";
import { MS_PER_CHAR, typedCount, typingSchedule } from "./typewriter";

describe("role book typing", () => {
  const text = "You hacked Study-Bot. Blend in, so nobody suspects you.";
  const schedule = typingSchedule(text);

  it("reveals the text letter by letter until all of it shows", () => {
    expect(typedCount(schedule, 0)).toBe(0);
    expect(typedCount(schedule, MS_PER_CHAR)).toBe(1);
    let last = 0;
    for (let ms = 0; ms <= schedule.at(-1)!; ms += 50) {
      const n = typedCount(schedule, ms);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(typedCount(schedule, schedule.at(-1)!)).toBe(text.length);
    expect(typedCount(schedule, 1e9)).toBe(text.length);
  });

  it("pauses a little after a full stop", () => {
    const stop = text.indexOf(".");
    expect(schedule[stop + 1] - schedule[stop]).toBeGreaterThan(schedule[stop] - schedule[stop - 1]);
  });
});
