/** Milliseconds per letter when the role book types, with short pauses after punctuation. */
export const MS_PER_CHAR = 22;
const PAUSE_AFTER: Record<string, number> = { ".": 190, "!": 190, "?": 190, ":": 120, ",": 80, "\n": 320 };

/** How long until each letter of `text` has appeared: entry i is when letter i shows (ms). */
export function typingSchedule(text: string): number[] {
  const times: number[] = [];
  let t = 0;
  for (const ch of text) {
    t += MS_PER_CHAR;
    times.push(t);
    t += PAUSE_AFTER[ch] ?? 0;
  }
  return times;
}

/** How many letters of `text` are showing `elapsedMs` after typing began. */
export function typedCount(schedule: number[], elapsedMs: number): number {
  let n = 0;
  while (n < schedule.length && schedule[n] <= elapsedMs) n++;
  return n;
}
