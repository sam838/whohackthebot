import { STRIKES_TO_LOSE } from "./constants";
import type { Role } from "./types";

/** What each role's book says at the start of a game (prd.md > Role Reveal). */
export interface QuickFacts {
  title: string;
  facts: string;
  win: string;
  /** What a Study-Bot terminal is for, in this role (shown next to a picture of one). */
  terminal: string;
}

export const QUICK_FACTS: Record<Role, QuickFacts> = {
  student: {
    title: "Student",
    facts:
      "Find question pieces, team up at Study-Bot terminals, and answer together. Careful: someone may have hacked Study-Bot. Trust it, or double-check?",
    win: "Answer enough questions right, or vote out the hacker.",
    terminal: "Bring your pieces here and answer together.",
  },
  bluffer: {
    title: "Bluffer",
    facts:
      "You hacked Study-Bot and the school cameras: you see everyone, even through walls. Hack terminals so Study-Bot lies, and Expel (Q) a classmate next to you. Anyone watching will see it, so pick your moment.",
    win: `Get the class to trust ${STRIKES_TO_LOSE} wrong answers, or be one of the last two left in class.`,
    terminal: "Press Hack here so Study-Bot lies.",
  },
  factChecker: {
    title: "Fact-Checker",
    facts:
      "You can see the truth, once: Verify one answer to expose a lie. Stay hidden, because if the Bluffer knows who you are, you're a target.",
    win: "Answer enough questions right, or vote out the hacker.",
    terminal: "Answer here, and Verify Study-Bot once.",
  },
};
