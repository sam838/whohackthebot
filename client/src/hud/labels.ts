import { ROOMS, TERMINALS } from "@whtb/shared/map";
import type { Role } from "@whtb/shared/types";

/** "Library terminal 2" for a terminal id like "library-2". */
export function terminalLabel(id: string): string {
  const spot = TERMINALS.find((t) => t.id === id);
  const room = ROOMS.find((r) => r.id === spot?.room)?.name ?? "Terminal";
  return `${room} terminal ${id.split("-")[1] ?? ""}`.trim();
}

export const ROLE_NAMES: Record<Role, string> = {
  student: "Student",
  bluffer: "Bluffer",
  factChecker: "Fact-Checker",
};

/** One-line reminder shown in the HUD until the role book arrives in slice 6. */
export const ROLE_REMINDERS: Record<Role, string> = {
  student: "Answer at terminals. Study-Bot might be hacked.",
  bluffer: "Hack terminals so Study-Bot lies. Blend in.",
  factChecker: "You can Verify one answer. Stay hidden.",
};
