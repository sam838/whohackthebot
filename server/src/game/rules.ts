// Pure game rules (spec.md > Game Server): roles, tasks, win checks.

import { STRIKES_TO_LOSE, TASKS_PER_PLAYER } from "@whtb/shared/constants";
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

/** Exactly one Bluffer, exactly one Fact-Checker, everyone else a Student. */
export function assignRoles(playerIds: readonly string[], random: Random): Map<string, Role> {
  const [bluffer, factChecker, ...students] = shuffle(playerIds, random);
  const roles = new Map<string, Role>([
    [bluffer, "bluffer"],
    [factChecker, "factChecker"],
  ]);
  for (const id of students) roles.set(id, "student");
  return roles;
}

/** Each player gets TASKS_PER_PLAYER different terminals. The Bluffer's are fake. */
export function assignTasks(playerIds: readonly string[], terminalIds: readonly string[], random: Random): Map<string, string[]> {
  return new Map(playerIds.map((id) => [id, shuffle(terminalIds, random).slice(0, TASKS_PER_PLAYER)]));
}

export interface WinInput {
  strikes: number;
  blufferAlive: boolean;
  aliveCount: number;
  /** Unfinished tasks of living Students and the Fact-Checker. */
  tasksRemaining: number;
}

export interface WinResult {
  winner: Winner;
  reason: string;
}

export function checkWinner(s: WinInput): WinResult | undefined {
  if (!s.blufferAlive) return { winner: "class", reason: "The Bluffer was kicked out of school!" };
  if (s.strikes >= STRIKES_TO_LOSE) return { winner: "bluffer", reason: "The class trusted Study-Bot's lies 3 times." };
  if (s.aliveCount <= 2) return { winner: "bluffer", reason: "Only the Bluffer and one classmate are left." };
  if (s.tasksRemaining === 0) return { winner: "class", reason: "The class finished every task." };
  return undefined;
}
