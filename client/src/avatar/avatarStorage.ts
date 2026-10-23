import { DEFAULT_CHARACTER, isCharacter, isPlayerColor, type Avatar } from "@whtb/shared/avatars";
import { NAME_MAX_LENGTH, PLAYER_COLORS } from "@whtb/shared/constants";

const KEY = "whtb.avatar";

export const DEFAULT_AVATAR: Avatar = { name: "", character: DEFAULT_CHARACTER, color: PLAYER_COLORS[0] };

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): Store | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Your saved avatar, or the default if nothing is saved or storage is blocked. */
export function loadAvatar(storage: Store | undefined = browserStorage()): Avatar {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_AVATAR };
    const saved = JSON.parse(raw) as Partial<Avatar>;
    return {
      name: typeof saved.name === "string" ? saved.name.slice(0, NAME_MAX_LENGTH) : "",
      character: isCharacter(saved.character) ? saved.character : DEFAULT_AVATAR.character,
      color: isPlayerColor(saved.color) ? saved.color : DEFAULT_AVATAR.color,
    };
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

/** Remembers the avatar on this device. Silently does nothing if storage is blocked. */
export function saveAvatar(avatar: Avatar, storage: Store | undefined = browserStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(avatar));
  } catch {
    // Private mode or blocked storage: the avatar just won't be remembered.
  }
}
