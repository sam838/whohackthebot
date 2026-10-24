import { STRIKES_TO_LOSE } from "./constants";
import type { Role } from "./types";

/** What each role's book says at the start of a game (prd.md > Role Reveal). */
export interface QuickFacts {
  title: string;
  facts: string;
  win: string;
}

export const QUICK_FACTS: Record<Role, QuickFacts> = {
  student: {
    title: "Student",
    facts:
      "Find question pieces, team up at Study-Bot terminals, and answer together. Careful: someone may have hacked Study-Bot. Trust it, or double-check?",
    win: "Answer enough questions right, or vote out the hacker.",
  },
  bluffer: {
    title: "Bluffer",
    facts:
      "You hacked Study-Bot. Hack terminals so it gives convincing wrong answers, and blend in so nobody suspects you.",
    win: `Get the class to trust ${STRIKES_TO_LOSE} wrong answers.`,
  },
  factChecker: {
    title: "Fact-Checker",
    facts:
      "You can see the truth, once: Verify one answer to expose a lie. Stay hidden, because if the Bluffer knows who you are, you're a target.",
    win: "Answer enough questions right, or vote out the hacker.",
  },
};
