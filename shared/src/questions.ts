// Study-Bot's question bank (spec.md > Question Set). Starter set for slice 3;
// the full 15–20 arrives in slice 7 after learner review. Each `lieIndex` is a
// common misconception, so a hacked Study-Bot sounds believable.

export interface Question {
  id: string;
  subject: string;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: number;
  lieIndex: number;
  /** Shown by Double-check: a nudge, not the answer. */
  hint: string;
}

export const QUESTIONS: Question[] = [
  {
    id: "great-wall",
    subject: "Geography",
    prompt: "Can you see the Great Wall of China from space with the naked eye?",
    choices: ["Yes, easily from orbit", "No, it's too narrow", "Only at night", "Only from the Moon"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "The wall is very long, but only about 6–9 metres wide.",
  },
  {
    id: "brain-10",
    subject: "Biology",
    prompt: "How much of your brain do you actually use?",
    choices: ["Only about 10%", "Almost all of it", "About half", "Only the left side"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Brain scans show activity in nearly every region over a normal day.",
  },
  {
    id: "lightning-twice",
    subject: "Physics",
    prompt: "Can lightning strike the same place twice?",
    choices: ["Never", "Yes, and it often does", "Only over the sea", "Only once a year"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Tall towers get hit many times every year.",
  },
  {
    id: "australia-capital",
    subject: "Geography",
    prompt: "What is the capital city of Australia?",
    choices: ["Sydney", "Canberra", "Melbourne", "Perth"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "It was built on purpose as a compromise between two big rival cities.",
  },
  {
    id: "hottest-planet",
    subject: "Science",
    prompt: "Which planet has the hottest surface?",
    choices: ["Mercury, closest to the Sun", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "A thick carbon dioxide atmosphere traps heat like a greenhouse.",
  },
  {
    id: "order-of-operations",
    subject: "Math",
    prompt: "What is 0.1 + 0.2 × 10?",
    choices: ["3", "2.1", "0.3", "30"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Multiplication happens before addition.",
  },
];
