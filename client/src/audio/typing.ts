// Key-click sound for the role book. The sound itself lives with the game's other sounds (audio/sound.ts).

export { unlockAudio } from "./sound";
import { sfx } from "./sound";

/** One soft key click, at a slightly different pitch each time so it sounds like real typing. */
export function keyClick(): void {
  sfx.key();
}
