// Balance check: many all-bot practice games (the "human" idles as a Student; a bot
// Bluffer hacks the way a sharp player would). Prints who wins and how long games run.
// Run with: npm run balance [games]
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { PlayerPosition, Role } from "@whtb/shared/types";
import { BotController } from "../src/bots";
import { GameRoom, type Sender } from "../src/game/GameRoom";

const N = Number(process.argv[2] ?? 200);
const tally = { class: 0, bluffer: 0, timeout: 0 };
let strikesTotal = 0, minutes = 0, hacksUsed = 0, hacksPlaced = 0;
for (let g = 0; g < N; g++) {
  const ids = ["human", "bot-0", "bot-1", "bot-2"];
  let clock = 1_000_000;
  const positions = new Map<string, PlayerPosition>(ids.map((id, i) => [id, { ...SPAWN_SEATS[i], heading: 0 }]));
  const sender: Sender = { toPlayer: (_id, e) => { if (e === "terminal:hackUsed") hacksUsed++; if (e === "terminal:hacked") hacksPlaced++; }, toRoom: () => {}, publicChanged: () => {}, respawn: () => {} };
  const game = new GameRoom(ids, sender, (id) => positions.get(id), Math.random, () => clock, new Map<string, Role>([["human", "student"]]));
  game.dealSecrets();
  const c = new BotController({ game, botIds: ids.slice(1), humanId: "human", position: (id) => positions.get(id), move: (id, p) => positions.set(id, p), nameOf: (id) => id, now: () => clock });
  let t = 0;
  for (; t < 15 * 60 * 12 && !game.over; t++) { clock += 1000 / 12; c.tick(1 / 12); game.tick(); }
  const over = game.gameOver();
  if (!over) tally.timeout++; else tally[over.winner as "class" | "bluffer"]++;
  strikesTotal += game.strikes; minutes += t / 12 / 60;
}
console.log(`${N} games:`, tally, `avg strikes ${(strikesTotal / N).toFixed(2)}, avg length ${(minutes / N).toFixed(1)} min, hacks placed ${(hacksPlaced / N).toFixed(2)}, used ${(hacksUsed / N).toFixed(2)}/game`);
