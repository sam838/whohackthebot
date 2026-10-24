// Makes two real Claude calls with your .env settings and prints the results,
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
console.log(`\nSpent this month: $${ai.spentThisMonth().toFixed(4)}`);
process.exit(studyBot && bot ? 0 : 1);
