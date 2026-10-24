// Study-Bot's question bank (spec.md > Question Set): hand-written sample content,
// drafted with an AI assistant and reviewed by the learner. Each `lieIndex` is a
// common misconception, so a hacked Study-Bot sounds believable.

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
  q({
    id: "napoleon-height",
    subject: "History",
    pieces: ["How tall was", "Napoleon", "for a man of his time?"],
    twistedPrompt: "How do old British cartoons show Napoleon's height?",
    choices: ["Very short", "About average", "Very tall", "Nobody knows"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "He was about 1.69 m. The 'tiny Napoleon' joke came from enemy cartoonists.",
  }),
  q({
    id: "viking-horns",
    subject: "History",
    pieces: ["Did Viking warriors", "wear helmets", "with horns?"],
    twistedPrompt: "What do Vikings wear in most cartoons and costumes?",
    choices: ["Yes, horned helmets", "No, plain helmets", "Only the kings did", "Only in winter"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "The horned look comes from costumes for a 19th-century opera.",
  }),
  q({
    id: "chameleon-colour",
    subject: "Biology",
    pieces: ["Why do chameleons", "mainly", "change colour?"],
    twistedPrompt: "Why do most people think chameleons change colour?",
    choices: ["To blend into the background", "To show mood and control heat", "To scare off rain", "Only when they sleep"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Their colours change most during fights and courtship.",
  }),
  q({
    id: "falling-balls",
    subject: "Physics",
    pieces: ["With no air at all,", "which lands first:", "a heavy ball or a light ball?"],
    twistedPrompt: "In a strong wind, which lands first: a bowling ball or a ping-pong ball?",
    choices: ["The heavy ball", "Both at the same time", "The light ball", "Neither one falls"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "An astronaut dropped a hammer and a feather on the Moon.",
  }),
  q({
    id: "largest-desert",
    subject: "Geography",
    pieces: ["What is the", "largest desert", "on Earth?"],
    twistedPrompt: "What is the largest hot desert on Earth?",
    choices: ["The Sahara", "Antarctica", "The Gobi", "The Arabian Desert"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "A desert is about how little rain or snow falls, not about heat.",
  }),
  q({
    id: "half-of-two",
    subject: "Math",
    pieces: ["What is", "half of 2", "plus 2?"],
    twistedPrompt: "What is half of (2 plus 2)?",
    choices: ["2", "3", "1", "4"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Do the 'half of 2' part first.",
  }),
  q({
    id: "sun-colour",
    subject: "Science",
    pieces: ["What colour", "is the Sun", "really?"],
    twistedPrompt: "What colour is the Sun in most children's drawings?",
    choices: ["Yellow", "White", "Orange", "Blue"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Astronauts in space see it without the air in the way.",
  }),
  q({
    id: "blind-bats",
    subject: "Biology",
    pieces: ["Are bats", "actually", "blind?"],
    twistedPrompt: "What does the saying 'blind as a bat' claim about bats?",
    choices: ["Yes, completely blind", "No, they can see", "Only in daylight", "Only baby bats"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Many bats see well, and some fruit bats even see colour.",
  }),
  q({
    id: "air-gas",
    subject: "Chemistry",
    pieces: ["Which gas makes up", "most of the air", "we breathe?"],
    twistedPrompt: "Which gas in the air do our bodies need to breathe?",
    choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "About 78% of the air is one gas, and it isn't the one we need.",
  }),
  q({
    id: "time-zones",
    subject: "Geography",
    pieces: ["Which country", "has the most", "time zones?"],
    twistedPrompt: "Which country has the most time zones on one connected piece of land?",
    choices: ["Russia", "France", "USA", "China"],
    correctIndex: 1,
    lieIndex: 0,
    hint: "Count islands and territories far from the mainland too.",
  }),
];
