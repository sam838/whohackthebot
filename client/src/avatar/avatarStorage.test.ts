import { CHARACTERS } from "@whtb/shared/avatars";
import { PLAYER_COLORS } from "@whtb/shared/constants";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, loadAvatar, saveAvatar } from "./avatarStorage";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("avatar storage", () => {
  it("remembers a saved avatar", () => {
    const s = memoryStorage();
    const avatar = { name: "Rina", character: CHARACTERS[3].id, color: PLAYER_COLORS[2] };
    saveAvatar(avatar, s);
    expect(loadAvatar(s)).toEqual(avatar);
  });

  it("falls back to the default when nothing is saved, data is broken, or storage is blocked", () => {
    expect(loadAvatar(memoryStorage())).toEqual(DEFAULT_AVATAR);
    const broken = memoryStorage();
    broken.setItem("whtb.avatar", "{not json");
    expect(loadAvatar(broken)).toEqual(DEFAULT_AVATAR);
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadAvatar(blocked)).toEqual(DEFAULT_AVATAR);
    expect(() => saveAvatar(DEFAULT_AVATAR, blocked)).not.toThrow();
  });

  it("replaces unknown characters or colors with defaults", () => {
    const s = memoryStorage();
    s.setItem("whtb.avatar", JSON.stringify({ name: "Kevin", character: "dragon", color: "#000000" }));
    expect(loadAvatar(s)).toEqual({ name: "Kevin", character: DEFAULT_AVATAR.character, color: DEFAULT_AVATAR.color });
  });

  it("every character model file exists", () => {
    for (const c of CHARACTERS) {
      expect(existsSync(join(__dirname, "../../public", c.file)), c.file).toBe(true);
    }
    expect(existsSync(join(__dirname, "../../public/models/characters/Textures/colormap.png"))).toBe(true);
  });
});
