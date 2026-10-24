import { useGLTF } from "@react-three/drei";
import { CHARACTERS } from "@whtb/shared/avatars";

// Every 3D model the game uses, downloaded once at startup (screens/LoadingScreen.tsx)
// so nothing pops in later: no placeholder bean in the menus, no empty furniture in class.
export const FURNITURE_MODELS = [
  "bookcaseClosedWide",
  "books",
  "desk",
  "kitchenBar",
  "kitchenFridge",
  "kitchenSink",
  "lampRoundTable",
  "plantSmall2",
  "pottedPlant",
  "rugRectangle",
  "stoolBar",
  "table",
  "trashcan",
].map((name) => `/models/furniture/${name}.glb`);

export const ALL_MODELS = [...CHARACTERS.map((c) => c.file), ...FURNITURE_MODELS];

/** The fonts the game draws with (canvas text too, so they must be ready before anything is painted). */
const FONTS = ['800 20px "Baloo 2"', '600 20px "Baloo 2"', '400 16px "Nunito"', '700 16px "Nunito"'];

export function preloadModels(): void {
  for (const file of ALL_MODELS) useGLTF.preload(file);
}

/** Resolves when the fonts are in (or after a few seconds, so a blocked font server can't stall the game). */
export function preloadFonts(): Promise<void> {
  const fonts = document.fonts ? Promise.all(FONTS.map((f) => document.fonts.load(f))).then(() => undefined) : Promise.resolve();
  return Promise.race([fonts, new Promise<void>((r) => setTimeout(r, 4000))]).catch(() => undefined);
}
