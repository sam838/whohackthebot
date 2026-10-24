import type { Role } from "@whtb/shared/types";

// Which roles this device has already read in full, so returning players get the
// role book's facts instantly instead of typed out again. Storage can be blocked
// (private mode), so every read and write is allowed to fail: then everything types.

const KEY = "whtb.seenRoles";

export function hasSeenRole(role: Role): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).includes(role);
  } catch {
    return false;
  }
}

export function markRoleSeen(role: Role): void {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
    seen.add(role);
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Not remembered; the facts just type out again next time.
  }
}
