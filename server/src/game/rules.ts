// Pure game rules (spec.md > Game Server): roles, win checks.

import { STRIKES_TO_LOSE } from "@whtb/shared/constants";
import type { Role, Winner } from "@whtb/shared/types";

export type Random = () => number;

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Exactly one Bluffer, exactly one Fact-Checker, everyone else a Student.
 * `fixed` pins some players' roles (practice mode lets you choose yours).
 */
export function assignRoles(playerIds: readonly string[], random: Random, fixed?: ReadonlyMap<string, Role>): Map<string, Role> {
  const roles = new Map<string, Role>(fixed ?? []);
  const free = shuffle(playerIds.filter((id) => !roles.has(id)), random);
  const taken = new Set(roles.values());
  for (const special of ["bluffer", "factChecker"] as const) {
    if (!taken.has(special) && free.length) roles.set(free.shift()!, special);
  }
  for (const id of free) roles.set(id, "student");
  return roles;
}

export interface Tally {
  ejectedId: string | null;
  counts: Record<string, number>;
}

/**
 * Counts votes (null = skip). The player with the most votes is kicked out;
 * a tie for the top, or skip having as many votes as the leader, ejects nobody.
 */
export function tallyVotes(votes: ReadonlyMap<string, string | null>): Tally {
  const counts: Record<string, number> = { skip: 0 };
  for (const target of votes.values()) {
    const key = target ?? "skip";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const players = Object.entries(counts).filter(([k]) => k !== "skip");
  const top = Math.max(0, ...players.map(([, n]) => n));
  const leaders = players.filter(([, n]) => n === top);
  const ejectedId = top > 0 && leaders.length === 1 && top > counts.skip ? leaders[0][0] : null;
  return { ejectedId, counts };
}

export interface WinInput {
  strikes: number;
  blufferAlive: boolean;
  aliveCount: number;
  /** Class questions not yet answered correctly. */
  questionsRemaining: number;
}

export interface WinResult {
  winner: Winner;
  reason: string;
}

export function checkWinner(s: WinInput): WinResult | undefined {
  if (!s.blufferAlive) return { winner: "class", reason: "The Bluffer was kicked out of school!" };
  if (s.strikes >= STRIKES_TO_LOSE) return { winner: "bluffer", reason: "The class trusted Study-Bot's lies 3 times." };
  if (s.aliveCount <= 2) return { winner: "bluffer", reason: "Only the Bluffer and one classmate are left." };
  if (s.questionsRemaining === 0) return { winner: "class", reason: "The class solved every question." };
  return undefined;
}
