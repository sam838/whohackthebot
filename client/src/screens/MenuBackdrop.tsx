import type { ReactNode } from "react";

/** What Study-Bot says on each menu screen, in the same overconfident voice as the title. */
export const MENU_LINES = {
  avatar: ["Looking good!", "…I think?"],
  mode: ["Play with friends?", "…or practice with me!"],
  vs: ["Bring your classmates!", "I'll answer everything."],
  practice: ["Pick a role!", "I promise I won't lie. ;)"],
  howto: ["Rule number one:", "don't trust me blindly!"],
  join: ["Type the code!", "4 letters. Easy."],
  lobby: ["Waiting for classmates…", "Need 4 to start!"],
} as const;

/**
 * A menu screen's card area. The wallpaper itself (sunburst and Study-Bot) is
 * drawn once behind every menu by App, so it never restarts between screens;
 * `lines` are what Study-Bot says on this screen.
 */
export function MenuBackdrop({ children }: { lines?: readonly [string, string]; children: ReactNode }) {
  return <div className="screen themed">{children}</div>;
}
