---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn — learner tries every slice and approves before it is committed ("I don't want unapproved code goes to the git")

## Slices

- [x] **1. You can walk a bean around the 3D school**
  Becomes usable: Opening the page shows the 2.5D school (four rooms, hallway, low walls, six yellow-screen terminals, the red meeting button) with one bean you move by joystick on a phone or WASD/arrows on desktop. The fixed camera follows it and walls block it. Single player, no server yet.
  Why now: 3D in React is the learner's stated unknown (`spec.md > Decisions and Open Issues`). Proving it first means bad news arrives before anything depends on it. It also bootstraps the whole workspace.
  PRD ref: `prd.md > Moving Around the School`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`, `spec.md > Shared Game Definitions (shared/)`, `spec.md > School Scene (client 3D)`, `spec.md > HUD & Controls (client)`, `spec.md > Look and Feel`
  Build: Scaffold npm workspaces (`shared`, `server`, `client`) with TypeScript, Vite, React 19, React Three Fiber 9, drei 10, Zustand, Vitest, after checking versions with `npm view`. Write `shared/map.ts` and `shared/constants.ts`. Build `GameView`, `SchoolMap` (toon floors, low walls, simple furniture boxes, terminals, button), `Player` (bean fallback), `FollowCamera`, `useMovement` with wall collision, the custom `Joystick`, and keyboard input. Load fonts and color tokens in `styles.css`.
  Verify (mechanical): `npm run build` type-checks and builds with no errors. Vitest tests for the wall-collision function pass (blocked by a wall, sliding along it, passing through a doorway). `npm run dev` serves the page with HTTP 200 and no console build errors.
  Learner check: Run `npm run dev`, open `http://localhost:5173` in a desktop window, and walk with WASD from the classroom through a doorway into the Library. Then open the same address on your phone (same Wi-Fi, using the network URL Vite prints) and walk with the joystick. Tell me whether the camera angle and the movement feel right.
  Commit: `Walk a bean around the 3D school`

- [x] **2. Friends can join your lobby and walk together**
  Becomes usable: Main Menu → Create Lobby shows a 4-letter code and a copyable share link. Other windows join by typing the code or opening the link. Everyone sees the player list. The host's Start unlocks at 4 players. After Start, everyone appears in the classroom and sees each other walking live.
  Why now: Multiplayer underpins every later behavior, including the kernel. Wiring it right after the 3D test proves the riskiest connection while the game is still small.
  PRD ref: `prd.md > Main Menu and Lobby`, `prd.md > Moving Around the School`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Game Server (server/)`, `spec.md > Socket Events`, `spec.md > Main Menu, Join & Lobby (client)`, `spec.md > Client Connection & Store`, `spec.md > Data Model`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Express + Socket.IO server (`index.ts`), `rooms.ts` (codes without O/0 or I/1, max 5, "already started", host handoff, empty-room cleanup), typed `shared/events.ts`, the socket client and Zustand store, the `MainMenu`/`Join`/`Lobby` screens with a temporary name field, `?room=` auto-join, a Vite proxy, the `move` → `positions` broadcast at ~12/s, remote-player interpolation, and the connection banner.
  Verify (mechanical): Vitest tests for `rooms.ts` pass (code format, full room, wrong code, started game, host handoff). A Node simulation script connects 4 Socket.IO clients: one creates, three join, the host starts; it confirms all 4 get `lobby:state`, a 5th join of a started game gets `error`, and `move` from one client arrives in another's `positions`. `npm run build` passes.
  Learner check: Open 4 browser windows. Create a lobby in one, join two by the share link and one by typing the code, check that Start says "Need X more" until the 4th joins, then start. Walk in one window and watch the same character move in the others.
  Commit: `Create, join, and walk together in a lobby`

- [ ] **3. Study-Bot can lie: secret roles, terminals, hacks, strikes**
  Becomes usable: On Start, each player privately learns their role (temporary role banner; the book comes in slice 6) and their task list. Walking to a terminal and tapping Use opens a timed multiple-choice question where Study-Bot confidently recommends one answer. Double-check costs time and shows a hint. The Bluffer can Hack a terminal (30s cooldown) so its next answer lies. The Fact-Checker can Verify once (TRUE/FALSE). Answers move the class progress or add a strike that everyone sees. 3 strikes or all tasks done ends the game with a temporary result line.
  Why now: This is `scope.md > The Unique Kernel`, the reason the game exists. It comes as soon as players can share a world.
  PRD ref: `prd.md > Study-Bot Terminals (the kernel)`, `prd.md > Bluffer: Hacking`, `prd.md > Fact-Checker: Verify`, `prd.md > Role Reveal` (role assignment only), `prd.md > Win and Game Over` (strike and progress wins)
  Spec ref: `spec.md > Game Server (server/)`, `spec.md > Study-Bot Terminal Panel (client) — the kernel`, `spec.md > HUD & Controls (client)`, `spec.md > Question Set`, `spec.md > Data Model`, `spec.md > Socket Events`
  Build: `rules.ts` (role assignment, task assignment, win checks), `GameRoom.ts` (terminals, hacks, questions, deadlines, double-check, verify, answers, strikes, progress, goal), proximity checks, a starter set of 6 questions in `shared/questions.ts`, private `game:role`/`game:tasks`/`terminal:*` events, `TerminalPanel`, `StrikeBar`, `TaskList`, `ActionButton`, and terminal glow when near.
  Verify (mechanical): Vitest tests pass for role assignment (exactly 1 Bluffer, exactly 1 Fact-Checker), hack → lie pick, trusted lie → strike, correct → progress, wrong → task kept, timeout, verify once, and win at 3 strikes or all tasks done. A simulation script confirms `terminal:question` never contains the correct answer, and no client except its owner ever receives `game:role`. `npm run build` passes.
  Learner check: In 4 windows, start a game and note each window's role. As the Bluffer, hack a terminal. As a Student, use that terminal, trust Study-Bot, and watch the strike appear in all windows. Try Double-check and the Fact-Checker's Verify.
  Commit: `Add secret roles and lying Study-Bot terminals`

- [ ] **4. Call a meeting and kick the Bluffer out of school**
  Becomes usable: Near the classroom button, any living player can call a meeting (once each). Everyone switches to the Meeting screen with text chat and voting (vote or skip, 90s). The result says who was kicked out and whether they were the Bluffer. Ejected or disconnected players become spectators. All four win conditions work. The Game Over screen reveals every role and returns to the menu.
  Why now: Completes the core loop and the demo moment ("The bluffer get caught then kicked out from school") right after the kernel.
  PRD ref: `prd.md > Meetings and Voting`, `prd.md > Win and Game Over`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Meeting, Chat & Vote (client)`, `spec.md > Game Over (client)`, `spec.md > Game Server (server/)`, `spec.md > Data Model` (win checks), `spec.md > Important Failure Modes`
  Build: `meeting:call` with proximity and one call per player, the meeting phase timer, chat (meeting-only, 140 characters), vote tally with tie/skip → nobody, ejection, respawn in the classroom, spectator mode, disconnect-as-eliminated, the Bluffer-plus-one rule, the `Meeting`/`VoteResult`/`GameOver` screens, and Back to menu.
  Verify (mechanical): Vitest tests pass for vote tally (majority, tie, skip), every win condition including Bluffer disconnect, and chat rejected outside meetings. A simulation plays a full game to a "class wins" ejection and another to a "Bluffer wins" ending. `npm run build` passes.
  Learner check: In 4 windows, call a meeting, chat from two windows, vote out the Bluffer, and see "Kicked out of school!" and every role revealed. Play again and vote out an innocent to see the game continue.
  Commit: `Add meetings, voting, and game over`

- [ ] **5. Set up your avatar on the home screen**
  Becomes usable: The Main Menu shows your avatar slowly rotating in 3D. You can choose one of 4–6 characters, 5 colors, and a name. It's remembered on this device and appears in the lobby, the school, and the meeting list. CC0 character and furniture models replace the placeholder boxes where they load, with the bean as a fallback.
  Why now: The core game is complete and testable with beans, so the art risk can't block it. Avatars also make players recognizable before the role book is built.
  PRD ref: `prd.md > Avatar Setup`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Avatar Setup (client)`, `spec.md > School Scene (client 3D)`, `spec.md > Look and Feel`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Pick CC0 packs (Kenney or Quaternius) after confirming CC0 on each license page, add the needed `.glb` files to `client/public/models/`, write `shared/avatars.ts`, `avatar/AvatarPreview`, `AvatarPicker`, `avatarStorage` (try/catch, defaults), pass the character through join events, add models in `Player` and `SchoolMap` with `<Suspense>` and error-boundary bean fallback, and start `CREDITS.md`.
  Verify (mechanical): Vitest tests for `avatarStorage` pass (save, load, blocked storage → default). Every model path in `shared/avatars.ts` exists on disk. A simulation confirms `character` reaches other players in `lobby:state`/`game:state`. `npm run build` passes.
  Learner check: Set an avatar, reload, and confirm it's remembered. In a second window pick a different one, join the same lobby, and check both characters in the lobby and walking in the school.
  Commit: `Add avatar setup with CC0 characters`

- [ ] **6. Open your book: the role reveal**
  Becomes usable: After Start, everyone sees the classroom with an open-book overlay. Tapping "Open your book" shows your character on the left page and your role on the right, with the quick facts typing out letter by letter and a key-click sound. Play then begins.
  Why now: It replaces slice 3's temporary role banner with the game's own reveal, once avatars exist to show in the book.
  PRD ref: `prd.md > Role Reveal`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Role Reveal (client)`, `spec.md > Look and Feel`
  Build: `shared/quickFacts.ts`, the `RoleReveal` screen (classroom scene behind, book animation, avatar render, typed text), `audio/typing.ts` (Web Audio clicks with slight pitch variation, silent if blocked), and the server `reveal` phase timing (~8s, or later if needed).
  Verify (mechanical): Vitest test that the typing helper reveals text progressively to its full length. A simulation confirms the phase goes `reveal` → `playing` and each client receives only its own role. `npm run build` passes.
  Learner check: Start a 4-window game and open the book in each window. Check that each shows the right character and role, the facts type out with sound, and nobody sees someone else's role.
  Commit: `Add book-style role reveal with typing sound`

- [ ] **7. Ready to share: full question set and one-service production build**
  Becomes usable: 15–20 reviewed school-subject and trivia questions, each with a plausible lie and a hint. `npm run build` followed by `npm start` serves the whole game and Socket.IO from one Node process on `$PORT`, ready for Render. The README covers how to run, play, and deploy, and `CREDITS.md` lists the models.
  Why now: Content and packaging come last because they depend on everything above. The learner reviews the questions because they're the game's voice.
  PRD ref: `prd.md > Study-Bot Terminals (the kernel)` (question content), `prd.md > What We're Building`
  Spec ref: `spec.md > Question Set`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies`
  Build: Draft the remaining questions for learner review, then apply their edits. Make Express serve `client/dist` with an SPA fallback so `?room=` links work. Add `npm start`, `.env.example` (`PORT` only), README, and the finished `CREDITS.md`. Run a production smoke test.
  Verify (mechanical): Vitest test that every question has 4 choices, valid distinct `correctIndex` and `lieIndex`, and a hint. `npm run build && npm start` with `PORT=4000` serves `/` and `/?room=ABCD` with HTTP 200, and a Socket.IO client connects to it. The simulation from slice 4 passes against the production server.
  Learner check: Read and edit the question list. Then run `npm run build` and `npm start`, open `http://localhost:4000` in 4 windows, and play one full game.
  Commit: `Add full question set and production build`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3 (the kernel playable in 4 windows), so feedback on Study-Bot, timing, and feel can shape meetings, avatars, and the reveal
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [not started]
Route and stops: [not started]
Edit outcome: [not started]
Reflection: [not started]
Activity mode: [not started]

## Revisions

- Added `shared/src/collision.ts` (+ test), which wasn't in `spec.md > File Structure` — the server will need the same obstacle data for proximity checks, so wall collision lives beside `map.ts` instead of inside `client/game/useMovement.ts`.
- Pinned TypeScript 7.0.2 and package versions published at least two weeks before the build — `npm view` showed newer releases from the last few days, which are skipped for supply-chain safety.
- Server runs TypeScript directly with `tsx` in production too (`npm start` → `tsx src/index.ts`) instead of compiling to JS — the shared package exports `.ts` source, so a compile step would need a second build of `shared/`; `npm run build` still type-checks the server with `tsc`.
- Added `server/src/app.ts` (not in `spec.md > File Structure`) so the simulation script can start a real server on a random port; `index.ts` only listens.
- Spawn seats follow join order on both sides (server seats player *i* at `SPAWN_SEATS[i]`; the client finds its own index), so no extra spawn event was needed.
