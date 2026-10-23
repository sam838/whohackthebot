// Avatar choices (prd.md > Avatar Setup). Characters are Kenney "Mini Characters"
// (CC0, see CREDITS.md). Files live in client/public/models/characters/.

import { PLAYER_COLORS } from "./constants";

export interface CharacterChoice {
  id: string;
  label: string;
  /** Path the browser loads, relative to the site root. */
  file: string;
}

const letters = ["a", "b", "c", "d", "e", "f"];

export const CHARACTERS: CharacterChoice[] = letters.flatMap((l, i) => [
  { id: `female-${l}`, label: `Student ${i * 2 + 1}`, file: `/models/characters/character-female-${l}.glb` },
  { id: `male-${l}`, label: `Student ${i * 2 + 2}`, file: `/models/characters/character-male-${l}.glb` },
]);

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function characterFile(id: string | undefined): string | undefined {
  return CHARACTERS.find((c) => c.id === id)?.file;
}

export function isCharacter(id: unknown): id is string {
  return typeof id === "string" && CHARACTERS.some((c) => c.id === id);
}

export function isPlayerColor(color: unknown): color is string {
  return typeof color === "string" && PLAYER_COLORS.includes(color);
}

export interface Avatar {
  name: string;
  character: string;
  color: string;
}
