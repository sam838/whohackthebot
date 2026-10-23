// Study-Bot's question bank (spec.md > Question Set). Starter set; the full
// 15–20 arrives in slice 7 after learner review. Each `lieIndex` is a common
// misconception, so a hacked Study-Bot sounds believable.

export interface Question {
  id: string;
  subject: string;
  /** The real question. Always equals `pieces.join(" ")`. */
  prompt: string;
  /** The 3 scraps hidden around the school, in reading order (prd.md > Question Pieces). */
  pieces: [string, string, string];
  /** What a hacked Study-Bot "arranges": a believable question whose honest answer is the lie. */
  twistedPrompt: string;
  choices: [string, string, string, string];
  correctIndex: number;
  lieIndex: number;
  /** Shown by Double-check: a nudge, not the answer. */
  hint: string;
}

function q(def: Omit<Question, "prompt">): Question {
  return { ...def, prompt: def.pieces.join(" ") };
}

export const QUESTIONS: Question[] = [
  q({
    id: "great-wall",
    subject: "Geography",
    pieces: ["Can you see", "the Great Wall of China", "from space with the naked eye?"],
    twistedPrompt: "What do most people believe about seeing the Great Wall of China from space?",
    choices: ["Yes, easily from orbit", "No, it's too narrow", "Only at night", "Only from the Moon"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "The wall is very long, but only about 6–9 metres wide.",
  }),
  q({
    id: "brain-10",
    subject: "Biology",
    pieces: ["How much of", "your brain do", "you actually use?"],
    twistedPrompt: "According to the famous movie myth, how much of your brain do you use?",
    choices: ["Only about 10%", "Almost all of it", "About half", "Only the left side"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Brain scans show activity in nearly every region over a normal day.",
  }),
  q({
    id: "lightning-twice",
    subject: "Physics",
    pieces: ["Can lightning strike", "the same place", "twice?"],
    twistedPrompt: "What does the old saying claim about lightning striking the same place twice?",
    choices: ["Never", "Yes, and it often does", "Only over the sea", "Only once a year"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Tall towers get hit many times every year.",
  }),
  q({
    id: "australia-capital",
    subject: "Geography",
    pieces: ["What is the", "capital city", "of Australia?"],
    twistedPrompt: "What is the biggest city in Australia?",
    choices: ["Sydney", "Canberra", "Melbourne", "Perth"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "It was built on purpose as a compromise between two big rival cities.",
  }),
  q({
    id: "hottest-planet",
    subject: "Science",
    pieces: ["Which planet has", "the hottest", "surface?"],
    twistedPrompt: "Which planet is closest to the Sun?",
    choices: ["Mercury, closest to the Sun", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "A thick carbon dioxide atmosphere traps heat like a greenhouse.",
  }),
  q({
    id: "order-of-operations",
    subject: "Math",
    pieces: ["What is", "0.1 + 0.2", "× 10?"],
    twistedPrompt: "What is (0.1 + 0.2) × 10?",
    choices: ["3", "2.1", "0.3", "30"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Multiplication happens before addition.",
  }),
  q({
    id: "goldfish-memory",
    subject: "Biology",
    pieces: ["How long can", "a goldfish", "remember things?"],
    twistedPrompt: "What does the popular myth say about a goldfish's memory?",
    choices: ["Only 3 seconds", "For months", "Exactly one day", "They can't remember at all"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Goldfish can be trained to come at feeding time.",
  }),
  q({
    id: "bull-red",
    subject: "Biology",
    pieces: ["What makes a bull", "charge at", "a matador's cape?"],
    twistedPrompt: "What do most people think makes a bull charge?",
    choices: ["The red colour", "The cape moving", "The crowd noise", "Hunger"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Bulls can't tell red from green.",
  }),
];
