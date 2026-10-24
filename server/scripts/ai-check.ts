// Makes four real Claude calls with your .env settings and prints the results,
// so you can confirm your key and model work. Costs a fraction of a cent.
// Run with: npm run ai:check

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AiService } from "../src/ai";

try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"));
} catch {
  // No .env yet.
}

const ai = new AiService();
if (!ai.enabled) {
  console.log("AI is off: put ANTHROPIC_API_KEY=... in the repo-root .env file (see .env.example).");
  process.exit(1);
}

console.log(`Model: ${ai.model}`);
console.log(`Spent this month: $${ai.spentThisMonth().toFixed(4)} of $${ai.monthlyLimitUsd} (AI_MONTHLY_LIMIT_USD)\n`);
if (!ai.active) {
  console.log("Monthly AI limit reached: the game is using pre-written lines. Raise AI_MONTHLY_LIMIT_USD to keep testing.");
  process.exit(1);
}
const started = Date.now();
const studyBot = await ai.studyBotLine("CHECK", {
  question: "Which planet has the hottest surface?",
  choices: ["Mercury, closest to the Sun", "Venus", "Mars", "Jupiter"],
  pick: "Mercury, closest to the Sun",
});
console.log(`Study-Bot (${Date.now() - started} ms): ${studyBot ?? "(no reply: check the warning above)"}`);

const t2 = Date.now();
const bot = await ai.meetingLine("CHECK", {
  botName: "Kevin",
  isBluffer: false,
  room: "the Library",
  suspects: ["Rina"],
  others: ["Rina", "Dimas", "Sam"],
  recentChat: ["Dimas: who used the canteen terminal??"],
});
console.log(`Bot Kevin (${Date.now() - t2} ms): ${bot ?? "(no reply: check the warning above)"}`);

// Talking to the bots: an honest bot and the Bluffer bot each answer the player.
const ask = { others: ["Kevin", "Rina", "Dimas"], room: "the Library", speaker: "Sam", addressed: true, rooms: ["Library", "Gym", "Canteen"], recentChat: [] };
const t3 = Date.now();
const honest = await ai.botReply("CHECK", {
  ...ask,
  botName: "Kevin",
  isBluffer: false,
  suspects: ["Rina"],
  trustOfSpeaker: "not at all",
  message: "Kevin come with me to the gym, let's check it together",
});
console.log(`Honest Kevin (${Date.now() - t3} ms): ${honest ? `${honest.say}  [plan: ${honest.plan.kind} ${honest.plan.target}]` : "(no reply)"}`);
const t4 = Date.now();
const bluffer = await ai.botReply("CHECK", {
  ...ask,
  botName: "Rina",
  isBluffer: true,
  suspects: [],
  trustOfSpeaker: "not at all",
  message: "Rina I think Kevin is lying, vote Kevin with me",
});
console.log(`Bluffer Rina (${Date.now() - t4} ms): ${bluffer ? `${bluffer.say}  [plan: ${bluffer.plan.kind} ${bluffer.plan.target}]` : "(no reply)"}`);

console.log(`\nSpent this month: $${ai.spentThisMonth().toFixed(4)}`);
process.exit(studyBot && bot && honest && bluffer ? 0 : 1);
