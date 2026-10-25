# Who Hacked the Bot?

**A social deduction party game about trusting AI.** Study-Bot, the class's AI study assistant, answers every question with total confidence. But one of your classmates secretly hacked it. Work out when it's lying, and vote the hacker out of school before the class trusts too many wrong answers.

*Never trust the bot blindly.*

- 4–5 players, each on their own phone or computer, in one browser game (nothing to install)
- About 6–10 minutes a round
- A cartoon 3D school (classroom, library, science lab, canteen) with a follow camera
- Practice mode: play alone with 3 bots and pick your own role

## How to play

Everyone gets a secret role in their **Student Handbook** at the start:

| Role | Goal |
|---|---|
| **Student** | Find question pieces around the school, team up at Study-Bot terminals, and answer together. Trust Study-Bot, or double-check? |
| **Bluffer** (1 player) | You hacked Study-Bot. Hack terminals so it gives confident wrong answers, and **Expel** a classmate next to you (anyone watching will see it, so pick your moment). You win when the class trusts 3 wrong answers, or when only you and one classmate are left. |
| **Fact-Checker** (1 player) | Like a Student, but you can **Verify** one answer to see if Study-Bot is telling the truth. Stay hidden. |

1. **Search for pieces.** Each question is split into 3 pieces hidden in different rooms: inside desks, behind posters, between books, in the lockers, even in the fridge. Walk up to things: a glowing ring on the floor means you can **Examine** it. Some hiding spots are empty.
2. **Pool them at a terminal.** Everyone standing at the same terminal shares their pieces. Put 3 in the right order, or tap "Let Study-Bot arrange it". A hacked Study-Bot quietly builds a *different* question whose answer is its lie.
3. **Answer.** Study-Bot recommends an answer with a confidence meter. **Double-check** costs 8 seconds and shows a hint. Trusting a hacked answer gives the class a strike, which everyone sees.
4. **Meet and vote.** Anyone can press the button in Class 7A to call a meeting: chat, accuse, and vote someone out of school. Finding an **expulsion slip** (left where the Bluffer expelled someone) starts a meeting too.
5. **Hall monitors.** Voted-out and expelled players walk the halls unseen and watch the class; they can't search, vote, chat, or answer. Their pieces go back where they were found.
6. **Limited vision.** You only see a circle around you; walls hide classmates. Every classmate you can see has a name tag in their color.
7. **Game over.** The class wins by answering enough questions or voting out the Bluffer. The Bluffer wins at 3 strikes, or when only one classmate is left. **Myths busted** then shows every question's myth next to the truth.

## Where the AI is (and isn't)

When an Anthropic API key is set, **Claude** (`claude-opus-5-5` by default) writes two things live:

- **Study-Bot's explanation** of the answer it recommends, in its overconfident voice.
- **Practice bots' meeting chat**, based on what each bot actually saw. The Bluffer bot is told to deflect.

**The game itself decides everything that matters:** which answer is right, when Study-Bot lies (only on a hacked terminal), strikes, roles, and votes. Claude only writes words, so a strange reply can't break a round. Without a key, or if Claude is slow (6 s timeout), down, or over the monthly budget, the game uses its own pre-written lines.

Cost controls: 60 calls per game, 120 per minute across the server, and a monthly budget (`AI_MONTHLY_LIMIT_USD`, default $5) that is checked *before* each call, so it is never passed.

## Run it locally

Needs **Node.js 24.11 or newer**.

```bash
npm install
cp .env.example .env      # optional: add ANTHROPIC_API_KEY to turn on the AI
npm run dev               # game at http://localhost:5173
```

To try multiplayer on one computer, open 4 browser windows: create a lobby in one and join with the 4-letter code (or the share link) in the others.

**Production mode** (one server for the page and the game, as on Render):

```bash
npm run build
npm start                 # http://localhost:3001, or $PORT
```

### Environment variables

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3001` | Port for the server (Render sets this) |
| `ANTHROPIC_API_KEY` | — | Turns on the AI. Leave empty to use pre-written lines. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Or `claude-sonnet-5-5` / `claude-haiku-5-5` (faster, cheaper) |
| `AI_MONTHLY_LIMIT_USD` | `5` | The game's own monthly AI budget |
| `AI_DISABLED` | `0` | Set to `1` to switch the AI off without removing the key |

Keep the key in `.env` (git ignores it) or in your host's dashboard, never in the code.

## Deploy on Render

One **Web Service** from this repo:

- **Build command:** `npm ci --include=dev && npm run build`
- **Start command:** `npm start`
- **Environment:** add the variables above (at least `ANTHROPIC_API_KEY` if you want the AI). Also set a spend limit in the Claude Console.

## Checks

```bash
npm test                  # unit tests: rules, referee, bots, AI service, typing, storage
npm run sim               # full games with real Socket.IO clients (AI forced off)
npm run smoke [url]       # checks a running production server (default http://localhost:4000)
npm run ai:check          # a few real Claude calls with your .env settings
npm run balance [games]   # many all-bot games: how often each side wins (aim: about even)
```

The demo video's footage was recorded by a script playing the real game (the page opened with `?demo` exposes a small read-only hook, `client/src/demo.ts`):

```bash
npm run demo:record -- <outDir> [url] [full|terminal|factchecker|bluffer|books|title|roles]
npm run demo:cut -- raw <outDir>              # frames → raw.mp4, plus a timeline of what happened when
npm run demo:cut -- cut <outDir> <plan.json>  # cut parts (from one or more recordings) into demo.mp4
```

## How it's built

- **`shared/`**: TypeScript shared by both sides: the map, collision, question bank, roles' book text, and the socket event types.
- **`server/`**: Node + Express + Socket.IO. `GameRoom` is the referee: it holds the secret state (roles, answers, hacks) and sends each player only what they may see. `BotController` runs practice bots; `ai.ts` is the only code that talks to Claude.
- **`client/`**: React + React Three Fiber (three.js). The school, characters, menus, terminals, meetings, and the role book.

The question set is hand-written sample content (18 myths and trivia questions), drafted with an AI assistant and reviewed by the project's author.

## Credits

3D models by [Kenney](https://www.kenney.nl) (CC0). Fonts: Baloo 2 and Nunito (SIL Open Font License). Study-Bot is an original mascot drawn in code. See [CREDITS.md](CREDITS.md).

Built for the Devpost "Build With AI: Basics" hackathon with an AI coding assistant (Claude Code).
