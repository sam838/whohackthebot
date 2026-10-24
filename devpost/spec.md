---
doc: spec
status: approved
---

# Who Hacked the Bot? — Technical Spec

## How This Works, In Plain Language

The game has **two parts that talk to each other in real time**:

1. **The game page (client)** is a React + TypeScript app that runs in each player's phone or desktop browser. It draws the 2.5D school using **React Three Fiber** (three.js scenes written as React components), shows the screens (menu, lobby, role book, terminal, meeting), and sends the player's actions to the server.
2. **The game server** is a small Node + TypeScript program. It **holds the true game**: who is in which lobby, who has which secret role, where everyone is, which terminals are hacked, the strike count, the votes. Phones connect to it over **Socket.IO**, a live two-way connection where both sides can send messages at any time.

**The server is the referee.** Phones never decide anything important. They say "I moved here," "I picked answer B," or "I vote for Kevin," and the server checks it, updates the game, and tells each phone **only what that player is allowed to know**. That's how roles stay secret: the server tells the Bluffer's phone "you're the Bluffer" and nobody else's. The correct answer to a question never leaves the server until it's answered.

The same server also delivers the game page, so there's **one program, one public URL** on Render. Nothing is saved to a database: each game lives in the server's memory and disappears when it ends, which is all a 10-minute party game needs.

**Why this shape:** you know React and TypeScript, so the only new tool is 3D-in-React. Socket.IO is a plain, well-known way to do real-time rooms without learning a game framework. One service is the simplest thing that gives friends a public link.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Open the link** → Render serves the built game page → the page opens a Socket.IO connection to the same server → **Main Menu** shows your avatar, loaded from `localStorage` (or a default the first time), as a rotating 3D preview. Changing character, color, or name saves to `localStorage` immediately.
2. **Create Lobby** → phone sends `lobby:create {name, character, color}` → server makes a room with a 4-letter code, makes this player host → sends `lobby:state` → phone shows **Lobby** with code and share link `https://<site>/?room=ABCD`.
3. **Join** → friend types the code, or the page reads `?room=ABCD` from the share link (after the avatar is set) → sends `lobby:join {code, name, character, color}` → server adds them (or replies with `error` such as "room not found") → everyone in the room gets the new `lobby:state`.
4. **Start** → host sends `lobby:start` → server checks 4–5 players, **randomly assigns roles**, assigns each non-Bluffer 3 terminal tasks (Bluffer gets fake ones) → sends each player **privately** `game:role` plus the shared `game:state` (phase `reveal`).
5. **Role Reveal** → phone shows the classroom and book scene; quick facts type out with a synthesized typing sound → after about 8 seconds the server switches phase to `playing`.
6. **Walk** → the joystick (or WASD/arrow keys on desktop) moves your character locally, blocked by walls from the shared map → the phone sends `move {x, z, heading}` about 12 times a second → server stores it and broadcasts all positions about 12 times a second → other phones smoothly move those characters every frame.
7. **Terminal** → near a terminal, the action button appears → `terminal:open {terminalId}` → server checks you're close, picks a question, and decides Study-Bot's pick (the correct option, or the lie if the terminal is hacked, which clears the hack) → privately sends `terminal:question {prompt, choices, botPick, deadline}`.
   - **Double-check** → `terminal:doubleCheck` → server moves the deadline 8 seconds earlier and sends `terminal:hint`.
   - **Verify (Fact-Checker, once)** → `terminal:verify` → server replies `TRUE` or `FALSE` about `botPick`.
   - **Hack (Bluffer)** → `terminal:hack {terminalId}` → server marks the terminal hacked and starts a 30s cooldown. Nobody else is told.
8. **Answer** → `terminal:answer {choiceIndex}` → server checks it: correct means the task is done and progress +1; picking a lie Study-Bot recommended means **+1 strike**; any other wrong answer or a timeout leaves the task on your list → private `terminal:result`, then the updated public `game:state` (strikes and progress) to everyone → server checks win conditions.
9. **Meeting** → in the classroom near the button → `meeting:call` → server checks proximity and that you haven't used your one call → phase `meeting` for everyone → chat messages (`chat:send` → `chat:message`) are allowed only in this phase → `vote:cast {targetId | null}`.
10. **Vote result** → when all votes are in or 90 seconds pass → server ejects the most-voted player (a tie or skip ejects nobody) → `vote:result {ejectedId, wasBluffer}` → checks win conditions → back to `playing` with everyone placed in the classroom, or `over`.
11. **Game Over** → `game:over {winner, roles}` → every phone shows the winner and reveals all roles. ★ The demo moment: "Kicked out of school!"

## Stack

| Piece | Choice | Docs | Why |
|---|---|---|---|
| Language | TypeScript everywhere | https://www.typescriptlang.org/docs/ | Learner's daily language; types shared between client and server |
| UI | React 19 | https://react.dev | Learner's daily framework |
| Build tool | Vite (current major) | https://vite.dev/guide/ | Fast dev server for React + TS; proxies Socket.IO in dev |
| 3D | React Three Fiber **v9** (pairs with React 19) | https://r3f.docs.pmnd.rs/getting-started/installation | three.js as React components; learner accepted this as their new tool |
| 3D helpers | drei **v10.x** | https://drei.docs.pmnd.rs | `useGLTF` model loading, helpers |
| 3D engine | three.js (version required by R3F) | https://threejs.org/docs/ | Under R3F |
| Client state | Zustand | https://zustand.docs.pmnd.rs | Small store for screen/lobby/HUD state, readable outside React (needed for per-frame code) |
| Real-time | Socket.IO v4 (server + client) | https://socket.io/docs/v4/ | Rooms and private per-player messages; learner accepted over Colyseus |
| Server | Node 20+ with Express | https://expressjs.com | Serves the built page and hosts Socket.IO |
| Dev runner | tsx | https://tsx.is | Runs the TS server in watch mode |
| Tests | Vitest | https://vitest.dev | Unit tests for game rules (roles, strikes, votes, wins) |
| Models | CC0 packs from Kenney and Quaternius (glTF/GLB) | https://kenney.nl/assets · https://quaternius.com | Free, no copyright restrictions; learner required non-copyrighted models |

**Verify early in the build:** exact current versions of R3F (9.x), drei (10.x), and Vite via `npm view`, plus the R3F + React 19 install. A [reported v9 issue with Next.js](https://github.com/pmndrs/react-three-fiber/issues/3471) doesn't apply because this uses Vite, but install problems should surface in step 1. Also confirm each model pack's license page says CC0.

## Where It Runs and How Someone Tries It

**Requirements:** Node 20+ and npm. No API keys. No database.

**Local development and the demo recording:**
```
npm install
npm run dev
```
- Starts the server on `http://localhost:3001` and the Vite page on `http://localhost:5173`. Vite forwards Socket.IO traffic to the server.
- **Demo:** open 4 browser windows side by side at `http://localhost:5173`. Window 1: Create Lobby. Windows 2–4: open the share link. Window 1: Start. Move with **WASD or the arrow keys**, since the on-screen joystick is for phones. You narrate each role, how to win, and how to lose (learner's plan for `6-ship`).
- 4 tabs in one browser work, because each tab has its own connection. The avatar is saved in `localStorage`, which all tabs in one browser share, so **set each window's avatar before recording** (each tab keeps what you picked while it's open).

**Production build:**
```
npm run build   # builds the page into client/dist and compiles the server
npm start       # one Node process serves the page + Socket.IO on $PORT
```

**Public link (learner chose deployment):** one **Render Web Service** connected to the public GitHub repo.
- Build command: `npm install && npm run build` · Start command: `npm start` · Node 20+.
- The learner's Render trial credits allow a paid instance that doesn't sleep. On the free tier the service [sleeps after 15 minutes idle and takes about a minute to wake](https://render.com/docs/free). Same code either way.
- Render settings and credentials live in Render's dashboard only, never in the repo or chat. `.env.example` documents `PORT` only.
- Friends open `https://<service>.onrender.com`, and share links look like `https://<service>.onrender.com/?room=ABCD`.

## Look and Feel
From `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **View:** 2.5D. A 3D scene with a **fixed camera above and in front of the player that follows them** (about 50° down, like Mobile Legends and Super Sus). The player never rotates it. Walls are **kept low** (about 1.6 units) so they rarely hide players from this angle. Reference: https://claude.ai/artifact/AH9VqGaLz1TYLjQgsdcAjY (option 2).
- **Characters:** cute, chunky, low-poly CC0 characters tinted with each player's chosen color. Fallback: a bean made from a cylinder, two spheres, a visor, and a backpack, as in the comparison page. **No Super Sus or Among Us assets or look-alike characters.**
- **School:** a common school in a cartoon style. Room floor colors: Classroom warm yellow `#f3dfa2`, Library lavender `#cdbbe8`, Science Lab mint `#b8e0d2`, Canteen peach `#f7c59f`, hallway light grey `#e4e1ea`, walls muted purple `#8c7aa3`. Toon-shaded materials (`MeshToonMaterial`) for the cartoon feel.
- **Study-Bot:** terminals have bright yellow screens (`#ffd84d`). In the terminal panel, Study-Bot speaks in **chat bubbles** with a confidence meter, so it sounds sure of itself.
- **UI (React DOM over the 3D canvas):** rounded, chunky, friendly. Headings in **Baloo 2**, body in **Nunito** (Google Fonts, with system-font fallbacks). Big tap targets for phones. Strikes are red, progress green, accent purple `#6b4fd8`.
- **Role book:** an open-book card over the classroom scene. Character picture on the left page, role and quick facts on the right. Text types out letter by letter with a short synthesized key-click sound (Web Audio, no file). The reveal is started by tapping "Open your book," which also satisfies the browser's rule that sound needs a tap first.
- **Tone:** playful and dramatic, never "educational." Copy like "Kicked out of school!", "Someone hacked Study-Bot…".
- **Layout:** designed for **phone portrait**. The 3D view fills the screen, with the HUD on top (strikes and progress top, task list top-left collapsible, joystick bottom-left, action button bottom-right). Also works in a desktop window for testing and the demo.

## Components

### Shared Game Definitions (`shared/`)
Types and data both sides import, so client and server never disagree.
- `types.ts`: `Role`, `Phase`, `PublicPlayer`, `GameStatePublic`, `Question`, and so on.
- `events.ts`: typed Socket.IO event names and payloads (the list in **Socket Events**).
- `map.ts`: room rectangles, wall segments, terminal positions (2 per room in Library, Science Lab, and Canteen, so 6 total), meeting button position, and classroom spawn seats. The client uses it for drawing and collision, the server for proximity checks.
- `questions.ts`: the pre-written question set. See **Question Set**.
- `constants.ts`: tuning values (min 4 / max 5 players, 3 tasks each, 3 strikes, 20s question timer, 8s double-check cost, 30s hack cooldown, 90s meeting, 1 meeting call per player, ~8s reveal, interaction radius).
- `quickFacts.ts`: role-book text (from `prd.md > Role Reveal`).

### Game Server (`server/`)
PRD ref: all of `prd.md > Features and Behavior`.
- **`index.ts`:** Express serves `client/dist` and Socket.IO is attached to the same HTTP server. Routes socket events to the room manager.
- **`rooms.ts`:** creates 4-letter codes (no confusing letters like O/0 or I/1), looks up rooms, enforces max players and "game already started," handles host handoff if the host leaves the lobby, and deletes empty rooms.
- **`game/GameRoom.ts`:** the referee for one game. It holds players, roles, positions, tasks, terminals (hacked flag, current question per player), strikes, progress, meeting calls, votes, phase, and timers. It's written as plain TypeScript methods (`start()`, `move()`, `openTerminal()`, `answer()`, `hack()`, `verify()`, `callMeeting()`, `vote()`, `removePlayer()`) that return the messages to send, so it can be **unit-tested without sockets**.
- **`game/rules.ts`:** pure functions for role assignment (exactly 1 Bluffer, exactly 1 Fact-Checker, the rest Students), task assignment, vote tallying, and win checks.

### Avatar Setup (client)
PRD ref: `prd.md > Avatar Setup`.
- `screens/MainMenu.tsx` hosts `avatar/AvatarPreview.tsx`: a small R3F `<Canvas>` showing the chosen character slowly rotating.
- `avatar/AvatarPicker.tsx`: arrows to cycle 4–6 characters, 5 color swatches, and a name field (max 12 characters).
- `avatar/avatarStorage.ts`: reads and writes `{name, character, color}` in `localStorage` under one key, wrapped in try/catch with a default if storage is blocked.
- `shared/avatars.ts`: the list of character ids and model files (or `bean` fallback) and the 5 colors.
- Characters are CC0 models tinted by color. If a pack lacks enough characters, the list falls back to bean variants.

### Main Menu, Join & Lobby (client)
PRD ref: `prd.md > Main Menu and Lobby`, `prd.md > States and Boundaries`.
- `screens/MainMenu.tsx`: avatar preview and setup, plus Create Lobby and Join Friend buttons. If the URL has `?room=`, it shows the avatar step with a "Join ABCD" button.
- `screens/Join.tsx`: code input (the avatar comes from Avatar Setup). Shows server errors in plain words ("Room not found," "Room is full," "Game already started").
- `screens/Lobby.tsx`: big room code, a copy-link button (`navigator.clipboard`, falling back to selecting the text), and the player list with colors. **Start** is shown only to the host, enabled at 4+ players, and otherwise says "Need X more players."

### Role Reveal (client)
PRD ref: `prd.md > Role Reveal`.
- `screens/RoleReveal.tsx`: the classroom 3D scene behind an open-book overlay. "Open your book" tap → the book animates open → character on the left, role name and typed quick facts on the right.
- `audio/typing.ts`: Web Audio key-click generator, triggered per typed character with slight random pitch.

### School Scene (client 3D)
PRD ref: `prd.md > Moving Around the School`.
- `game/GameView.tsx`: the R3F `<Canvas>`, lights, toon materials, and `<Suspense>` with the bean fallback for models.
- `game/SchoolMap.tsx`: floors, low walls, and furniture built from `shared/map.ts`, plus CC0 furniture models where available (desks, shelves, lab tables, canteen tables).
- `game/Player.tsx`: one character (CC0 model or bean fallback) tinted by color, with a walk bob, facing its heading. Remote players are **interpolated** toward their latest server position in `useFrame`.
- `game/Terminal3D.tsx` and `game/MeetingButton3D.tsx`: props that glow when you're close enough to use them.
- `game/FollowCamera.tsx`: fixed-offset camera that follows the local player in `useFrame`.
- `game/useMovement.ts`: reads the joystick or keys each frame, moves the local player, collides with wall rectangles, and throttles `move` messages to about 12 per second.
- `game/positions.ts`: a mutable map of the latest remote positions **outside React state**, written by socket messages and read by `useFrame`.

### HUD & Controls (client)
PRD ref: `prd.md > Moving Around the School`.
- `hud/Hud.tsx`: overlays everything below on the canvas.
- `hud/Joystick.tsx`: custom pointer-events joystick (no library) on touch screens. Desktop uses WASD and arrow keys.
- `hud/StrikeBar.tsx`: "Strikes: 1/3" and class progress, always visible.
- `hud/TaskList.tsx`: your remaining terminals (the Bluffer sees fake ones).
- `hud/ActionButton.tsx`: context button: **Use** near a terminal, **Meeting** near the classroom button.

### Study-Bot Terminal Panel (client) — the kernel
PRD ref: `prd.md > Study-Bot Terminals (the kernel)`, `prd.md > Bluffer: Hacking`, `prd.md > Fact-Checker: Verify`.
- `terminal/TerminalPanel.tsx`: the question, a countdown bar (from the server's `deadline`), Study-Bot's chat bubble recommending an option with high confidence, and four answer buttons.
  - **Double-check** button: shows the hint, and the countdown jumps forward.
  - **Verify** (Fact-Checker, while unused): shows a TRUE or FALSE stamp on Study-Bot's bubble.
  - **Hack** (Bluffer only, when cooldown is ready): "Hack this terminal" → confirmation "Next answer here will lie."
  - The result flash: "Correct!", "Study-Bot lied: strike!", or "Wrong. Try this task again later."

### Question Pieces (server + client)
PRD ref: `prd.md > Question Pieces`. Added in slice 3b, reworked into a shared puzzle in slice 3c.
- `shared/questions.ts`: each question has `pieces` (3 ordered fragments joining into `prompt`) and `twistedPrompt` (a believable wrong question whose honest answer is the lie).
- `shared/pieces.ts`: `PIECE_SPOTS`, free floor points on a grid inside each room.
- `GameRoom`: picks 2 questions per classmate; each question's 3 pieces get home spots in three different rooms. A piece is on the floor, held by a player, or used. Pickup is checked by distance (the Bluffer holds at most 2). At a terminal, the pool is the pieces held by everyone alive standing within reach (the Bluffer included), snapshotted when Use is pressed. The Bluffer arranges and answers like anyone but can't cause a strike or use up their own hack. The opener's 3-piece arrangement must be one question's pieces in reading order. Study-Bot arranges only when a full question is in the pool, and uses `twistedPrompt` if hacked. Correct uses the pieces; anything else returns them. Leavers' pieces go back to their home spots.
- Messages: everyone gets `pieces:state` (pieces on the floor: id and position, **no text**); the holder gets `game:bag` (their pieces with text).
- Client: `game/Pieces3D.tsx` (paper scraps, auto-pickup by walking over), a bag and class board in the HUD, and `TerminalPanel` with a pool to pick 3 from (or "Let Study-Bot arrange it"); the answer step shows the 3 real pieces under the question.

### Practice Mode & Bots (server + client)
PRD ref: `prd.md > Practice Mode`. Added during `5-build` (slice 5c).
- `practice:start {name, character, color, role | "random"}` creates a room with the player and 3 bots, then starts it at once. The player's chosen role is fixed; the bots get the rest.
- `shared/nav.ts`: a walkable grid built from the same obstacles as collision, and A* paths across it, so bots never get stuck on walls.
- `server/src/bots.ts`: one `BotController` per practice room, ticked with the game loop. Each bot wanders to pieces, picks them up, walks to the human's terminal to help pool, solves full questions (trusting Study-Bot about 70% of the time), hacks if it is the Bluffer, may call a meeting after a strike, and in meetings chats canned lines and votes for whoever was seen near a hacked terminal. Bots act through the same `GameRoom` methods as players, so the rules can't be bent.
- Bots are server-side players with no socket. A practice room is deleted when its human leaves.

### Meeting, Chat & Vote (client)
PRD ref: `prd.md > Meetings and Voting`.
- `screens/Meeting.tsx`: who called it, the chat log and input (max 140 characters per message), a player list with vote buttons and a Skip button, a 90-second countdown, and who has voted (not *for whom*).
- `screens/VoteResult.tsx`: "Kevin was kicked out of school. Kevin **was** the Bluffer!" or "…was **not** the Bluffer." or "Nobody was kicked out."

### Game Over (client)
PRD ref: `prd.md > Win and Game Over`.
- `screens/GameOver.tsx`: the winning side headline, every player with their role revealed, and **Back to menu**.

### Client Connection & Store
- `net/socket.ts`: a single Socket.IO client with typed events from `shared/events.ts`.
- `net/store.ts`: Zustand store for the current screen and phase, lobby, my id and role, public game state, my tasks, open terminal question, chat, and vote state. Socket handlers write to it; React screens read from it.
- `App.tsx`: picks the screen from `phase` (`menu` · `lobby` · `reveal` · `playing` · `meeting` · `voteResult` · `over`), plus a connection banner.

## Socket Events
All typed in `shared/events.ts`. "Private" means sent only to that player's socket.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| C→S | `lobby:create` | `{name, character, color}` | Creator becomes host |
| C→S | `lobby:join` | `{code, name, character, color}` | |
| C→S | `lobby:start` | — | Host only, 4–5 players |
| C→S | `practice:start` | `{name, character, color, role}` | Solo game with 3 bots |
| C→S | `move` | `{x, z, heading}` | ~12/s, ignored unless `playing` |
| C→S | `piece:pickup` | `{pieceId}` | Within reach; Bluffer max 2 held |
| C→S | `terminal:open` | `{terminalId}` | Within reach; pool of nearby classmates must hold 3+ pieces |
| C→S | `terminal:arrange` | `{order: pieceIds[3]}` | 3 pool pieces in reading order |
| C→S | `terminal:botArrange` | — | Ask Study-Bot to arrange |
| C→S | `terminal:answer` | `{choiceIndex}` | |
| C→S | `terminal:doubleCheck` | — | |
| C→S | `terminal:verify` | — | Fact-Checker, once |
| C→S | `terminal:hack` | `{terminalId}` | Bluffer, cooldown |
| C→S | `meeting:call` | — | Near button, 1 per player |
| C→S | `chat:send` | `{text}` | Meeting phase only |
| C→S | `vote:cast` | `{targetId \| null}` | |
| S→C | `lobby:state` | `{code, hostId, players[]}` | Room |
| S→C | `error` | `{code, message}` | Private |
| S→C | `game:role` | `{role}` | **Private** |
| S→C | `game:tasks` | `{terminalIds[]}` | **Private** |
| S→C | `game:state` | `{phase, players[] (id, name, character, color, alive), strikes, progress, goal, meetingCaller?, phaseEndsAt?}` | Room. Never includes roles |
| S→C | `positions` | `{[id]: {x, z, heading}}` | Room, ~12/s |
| S→C | `pieces:state` | `{pieces: {id, x, z}[]}` | Everyone; pieces on the floor, no text |
| S→C | `game:bag` | `{pieces: {id, text}[]}` | **Private**: what you carry |
| S→C | `terminal:arrange` | `{terminalId, cards: {id, text}[], msLeft}` | **Private**: the shuffled pool |
| S→C | `terminal:arrangeWrong` | — | Private: try again |
| S→C | `terminal:question` | `{prompt, choices[4], botPick, deadline}` | **Private**. No correct answer included |
| S→C | `terminal:hint` | `{hint, deadline}` | Private |
| S→C | `terminal:verifyResult` | `{botIsRight: boolean}` | Private |
| S→C | `terminal:result` | `{outcome: 'correct' \| 'strike' \| 'wrong'}` | Private |
| S→C | `terminal:hacked` | `{terminalId, cooldownEndsAt}` | Private to the Bluffer |
| S→C | `chat:message` | `{fromId, text}` | Room |
| S→C | `vote:result` | `{ejectedId \| null, wasBluffer}` | Room |
| S→C | `game:over` | `{winner: 'class' \| 'bluffer', roles: {[id]: Role}}` | Room |

## Data Model
Everything lives in **server memory**. Nothing is saved to disk, and nothing persists between games (`prd.md > States and Boundaries`).

```ts
Room {
  code: string; hostId: string;
  players: Map<socketId, Player>;
  phase: 'lobby'|'reveal'|'playing'|'meeting'|'voteResult'|'over';
  game?: GameRoom;
}
Player { id; name; character; color; alive: boolean; role?: 'student'|'bluffer'|'factChecker';
         x; z; heading; tasks: string[]; meetingCallsLeft: 1; verifyUsed: boolean;
         openQuestion?: { terminalId; questionId; botPick; deadline } }
Terminal { id; room; x; z; hacked: boolean }
GameRoom { strikes; progress /* tasks completed */; goal /* recomputed: completed + remaining tasks of alive non-Bluffers */;
           hackReadyAt; votes: Map<voterId, targetId|null>; phaseEndsAt; questionCursor }
Question { id; subject; prompt; choices: [string,string,string,string];
           correctIndex; lieIndex; hint }
```

| Data | Where it lives | How it changes | Leave and come back |
|---|---|---|---|
| Room, players, roles, strikes, votes | Server memory | Only the server changes it, in response to events | Refreshing the page means leaving. The player is removed (eliminated mid-game), and their role stays hidden until Game Over |
| Your avatar (name, character, color) | Browser `localStorage` | Saved on every change in Avatar Setup | Restored next time on this device |
| Remote positions | Client `positions.ts` (outside React) | Every `positions` message | Rebuilt from the next message |
| Screen, role, tasks, question, chat | Client Zustand store | Socket handlers | Lost on refresh (you've left the game) |
| Questions | `shared/questions.ts` (in code) | Edited by hand | Same every game |

**Win checks** (`rules.ts`, run after each answer, vote, and removal):
- Bluffer ejected → **class wins**. Every alive non-Bluffer has finished all their tasks (progress ≥ goal; ejected players' unfinished tasks drop out of the goal) → **class wins**.
- Strikes ≥ 3 → **Bluffer wins**. Bluffer alive and alive players ≤ 2 → **Bluffer wins**.
- A Bluffer who disconnects counts as ejected (class wins).

## Question Set
PRD ref: `prd.md > Study-Bot Terminals (the kernel)`.
- 15–20 school-subject and trivia questions in `shared/questions.ts`. Each has 4 choices, the correct one, **one plausible lie** (a common misconception, e.g. "The Great Wall is visible from space"), and a one-line hint for Double-check.
- **Content is drafted by the agent during the build and reviewed by the learner**, then labelled in the README as hand-written sample content.
- Study-Bot recommends the correct option unless the terminal is hacked, in which case it recommends `lieIndex`. Each player gets questions cycled without repeats until the set runs out.

## File Structure

```
New folder/                      # project root (the hackathon repo)
├── package.json                 # npm workspaces: shared, server, client; scripts dev/build/start/test
├── tsconfig.base.json           # shared TS settings
├── README.md                    # what it is, how to run, how to play, credits, demo notes
├── CREDITS.md                   # CC0 model packs used, with links and license notes
├── .gitignore                   # node_modules, dist, .env*, /devpost/learner-profile.md
├── .env.example                 # PORT only
├── shared/
│   ├── package.json
│   └── src/
│       ├── types.ts             # roles, phases, public state, question shape
│       ├── events.ts            # typed Socket.IO events (client↔server contract)
│       ├── map.ts               # rooms, walls, terminals, button, spawn seats
│       ├── questions.ts         # pre-written questions with lie + hint
│       ├── quickFacts.ts        # role-book text
│       ├── avatars.ts           # character ids, model files, colors
│       └── constants.ts         # tuning numbers
├── server/
│   ├── package.json
│   └── src/
│       ├── index.ts             # Express + Socket.IO; serves client/dist
│       ├── rooms.ts             # codes, join/leave, host handoff
│       └── game/
│           ├── GameRoom.ts      # the referee: one game's state + timers
│           ├── rules.ts         # roles, tasks, votes, win checks (pure)
│           └── rules.test.ts    # Vitest unit tests
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts           # React plugin; proxy /socket.io → :3001
│   ├── public/
│   │   └── models/              # CC0 .glb files (characters, furniture)
│   └── src/
│       ├── main.tsx             # React root
│       ├── App.tsx              # picks screen by phase; connection banner
│       ├── styles.css           # tokens, fonts, HUD + screen styles
│       ├── net/
│       │   ├── socket.ts        # Socket.IO client
│       │   └── store.ts         # Zustand store
│       ├── screens/
│       │   ├── MainMenu.tsx
│       │   ├── Join.tsx
│       │   ├── Lobby.tsx
│       │   ├── RoleReveal.tsx
│       │   ├── Meeting.tsx
│       │   ├── VoteResult.tsx
│       │   └── GameOver.tsx
│       ├── game/
│       │   ├── GameView.tsx     # <Canvas>, lights, Suspense + fallback
│       │   ├── SchoolMap.tsx    # floors, walls, furniture
│       │   ├── Player.tsx       # model or bean; interpolation
│       │   ├── Terminal3D.tsx
│       │   ├── MeetingButton3D.tsx
│       │   ├── FollowCamera.tsx
│       │   ├── useMovement.ts   # joystick/keys → move + collide + send
│       │   └── positions.ts     # remote positions outside React
│       ├── hud/
│       │   ├── Hud.tsx
│       │   ├── Joystick.tsx
│       │   ├── StrikeBar.tsx
│       │   ├── TaskList.tsx
│       │   └── ActionButton.tsx
│       ├── avatar/
│       │   ├── AvatarPreview.tsx  # rotating 3D preview
│       │   ├── AvatarPicker.tsx   # character, color, name
│       │   └── avatarStorage.ts   # localStorage read/write
│       ├── terminal/
│       │   └── TerminalPanel.tsx
│       └── audio/
│           └── typing.ts        # Web Audio key clicks
└── devpost/                     # planning docs (learner-profile.md is git-ignored)
```

## External Services and Dependencies
- **Render** (hosting): https://render.com/docs/web-services. One Web Service from the GitHub repo, configured in Render's dashboard. No API calls from the code. Cost: covered by the learner's trial credits, or the free tier (750 instance-hours a month, sleeps after 15 minutes idle). No keys in the repo.
- **Google Fonts** (Baloo 2, Nunito): loaded by stylesheet link, with system-font fallbacks if blocked.
- **CC0 model packs:** downloaded once into `client/public/models/`. No runtime service.
- **npm packages:** see **Stack**. No paid or rate-limited APIs. No AI service at runtime (Study-Bot is pre-written; `prd.md > Possible Later Enhancements` keeps AI-generated questions for later).

## Important Failure Modes
- **Server unreachable or waking up** → a "Connecting to school… (this can take up to a minute)" banner. Socket.IO retries automatically; menu buttons are disabled until connected.
- **3D model fails to load** → the `<Suspense>` and error boundary show the **bean fallback** for that object. The game stays playable (learner's agreed fallback).
- **No WebGL on a device** → a plain message: "Your browser can't show 3D. Try Chrome or another device."
- **A player disconnects or refreshes mid-game** → treated as eliminated, their role hidden until Game Over, and win checks run (fewer than 3 alive with the Bluffer means the Bluffer wins). In the lobby, the next player becomes host.
- **Sound blocked** → typing animation still plays silently. Sound only starts after the "Open your book" tap.

## What Was Simplified and Why
- **Phones report their own movement and the server trusts it** (no anti-cheat), instead of the server simulating movement. Friends playing together don't cheat, and server-simulated movement would double the movement work.
- **Games live in memory, with no database**, instead of stored games. A 10-minute party game needs nothing saved. The fuller version would add Redis or a database plus reconnect tokens.
- **No reconnection** (refreshing means leaving) instead of rejoining your seat. The fuller version needs a session token and seat-holding timers.
- **Pre-written questions in code** instead of AI-generated ones. The kernel is *trusting a confident AI*, which pre-written Study-Bot answers demonstrate fully. Live AI is a Later enhancement.
- **Low walls with a fixed camera** instead of see-through-wall shaders. Low walls barely block this camera angle.
- **Synthesized typing sound** instead of an audio file. No asset or licensing to manage.
- **Avatar remembered in `localStorage`** instead of Google sign-in. The fuller version needs OAuth setup plus a database for profiles.
- **Custom joystick plus keyboard** instead of a joystick library. It's about 60 lines, and the keyboard is needed for the 4-window desktop demo.

## Decisions and Open Issues

**Learner decisions (this conversation):**
- **Avatar setup on the home screen**, with 4–6 characters + color and a rotating 3D preview (agent recommendation, learner: "Okay keep it"). Added to the PRD as `prd.md > Avatar Setup`.
- **localStorage, not Google sign-in**: "keep localstorage for now." Sign-in would add Google Cloud setup, a database, and a login wall. Moved to Later.
- **React + TypeScript**: the learner's daily stack.
- **Public link deployment**: "Make other people can play through public link." Demo still recorded with 4 windows, narrating roles, how to win, and how to lose.
- **Render** using the learner's trial credits from another hackathon. The free tier works as a no-code-change fallback.
- **CC0 3D model packs**: "I need 3d model that is not copyrighted."
- **Bean-shape fallback** if models don't work out (closes `prd.md > Open Questions`).

**Agent recommendations the learner accepted (no objection when asked):**
- React Three Fiber v9 + drei for 3D, over plain three.js. Tradeoff: new per-frame patterns.
- Socket.IO with server-authoritative game logic, over Colyseus. Tradeoff: room and code logic written by hand, but no new framework and simple private messages.
- One Render service that serves the page and Socket.IO. Tradeoff: in-memory games are lost on restart.

**Implementation details derived from those decisions (agent):** Zustand, Vitest, tsx, the custom joystick, the socket event list, the 6-terminal map, the 4-letter codes, the progress goal = all tasks of alive non-Bluffers, and the "wrong answer keeps the task" rule.

**Learner's useful unknown:** *"I never create 3d in react."*
- **Clarified:** `<Canvas>` and JSX for 3D objects; per-frame motion through `useFrame` and refs, not React state; `useGLTF` with `<Suspense>` for models.
- **Agreed check:** build step 1 is a small 3D test with one room, the bean, the fixed follow camera, and joystick plus WASD. **Evidence:** smooth movement in a desktop window and on a phone browser before any multiplayer code.

- **No AI model at runtime for the hackathon** (learner, during `5-build`): Study-Bot and the practice bots are pre-written and rule-based; real Claude features are in `prd.md > Possible Later Enhancements` with cost estimates. The README must say plainly that Study-Bot is simulated.

**Open (none block approval):**
- Exact package versions, verified with `npm view` in build step 1.
- Which specific Kenney or Quaternius packs. Choose during the build after checking for school furniture and cute characters, and confirm CC0 on each license page.
- Question content (15–20 questions): drafted during the build, reviewed by the learner.
- Timing values (`shared/constants.ts`) were accepted as placeholders in the PRD and will be tuned during the 4-window playtest.
