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

- [x] **3. Study-Bot can lie: secret roles, terminals, hacks, strikes**
  Becomes usable: On Start, each player privately learns their role (temporary role banner; the book comes in slice 6) and their task list. Walking to a terminal and tapping Use opens a timed multiple-choice question where Study-Bot confidently recommends one answer. Double-check costs time and shows a hint. The Bluffer can Hack a terminal (30s cooldown) so its next answer lies. The Fact-Checker can Verify once (TRUE/FALSE). Answers move the class progress or add a strike that everyone sees. 3 strikes or all tasks done ends the game with a temporary result line.
  Why now: This is `scope.md > The Unique Kernel`, the reason the game exists. It comes as soon as players can share a world.
  PRD ref: `prd.md > Study-Bot Terminals (the kernel)`, `prd.md > Bluffer: Hacking`, `prd.md > Fact-Checker: Verify`, `prd.md > Role Reveal` (role assignment only), `prd.md > Win and Game Over` (strike and progress wins)
  Spec ref: `spec.md > Game Server (server/)`, `spec.md > Study-Bot Terminal Panel (client) — the kernel`, `spec.md > HUD & Controls (client)`, `spec.md > Question Set`, `spec.md > Data Model`, `spec.md > Socket Events`
  Build: `rules.ts` (role assignment, task assignment, win checks), `GameRoom.ts` (terminals, hacks, questions, deadlines, double-check, verify, answers, strikes, progress, goal), proximity checks, a starter set of 6 questions in `shared/questions.ts`, private `game:role`/`game:tasks`/`terminal:*` events, `TerminalPanel`, `StrikeBar`, `TaskList`, `ActionButton`, and terminal glow when near.
  Verify (mechanical): Vitest tests pass for role assignment (exactly 1 Bluffer, exactly 1 Fact-Checker), hack → lie pick, trusted lie → strike, correct → progress, wrong → task kept, timeout, verify once, and win at 3 strikes or all tasks done. A simulation script confirms `terminal:question` never contains the correct answer, and no client except its owner ever receives `game:role`. `npm run build` passes.
  Learner check: In 4 windows, start a game and note each window's role. As the Bluffer, hack a terminal. As a Student, use that terminal, trust Study-Bot, and watch the strike appear in all windows. Try Double-check and the Fact-Checker's Verify.
  Commit: `Add secret roles and lying Study-Bot terminals`

- [x] **3b. Hunt the question pieces, then arrange them (or let Study-Bot)**
  Becomes usable: Each task's question is split into 3 pieces lying in different rooms. Everyone except the Bluffer sees all pieces in their owner's color, and walking over your own picks it up. The task list shows `pieces 1/3`. With all 3, the terminal opens an arrange step: tap the pieces into order, or let Study-Bot arrange it. A hacked Study-Bot builds a believable wrong question that its lie answers. Then the answer step works as before.
  Why now: The first hands-on checkpoint showed a fast class wins before the Bluffer matters. The learner chose an escape-room hunt that slows the rush and gives the Bluffer a Werewolf-style weakness (they can't see pieces). It reshapes the kernel moment, so it comes before meetings.
  PRD ref: `prd.md > Question Pieces`, `prd.md > Study-Bot Terminals (the kernel)`
  Spec ref: `spec.md > Question Pieces (server + client)`, `spec.md > Socket Events`, `spec.md > Study-Bot Terminal Panel (client) — the kernel`
  Build: Add `pieces` and `twistedPrompt` to the 6 starter questions, `PIECE_SPOTS` in `map.ts`, piece placement/pickup/arrange/botArrange in `GameRoom`, the new private events, `Pieces3D`, piece counts in `TaskList`, the arrange step in `TerminalPanel`, and a "you can't see pieces" note for the Bluffer.
  Verify (mechanical): Vitest tests pass: pieces land in 3 different rooms on free floor; only the owner can pick up, and only within reach; a terminal refuses with fewer than 3 pieces; a correct arrangement reveals the choices and a wrong one says try again; hacked botArrange gives `twistedPrompt` with the lie as Study-Bot's pick; question data is consistent (pieces join into the prompt). Simulation: the Bluffer never receives `pieces:state`, and piece positions never include text. `npm run build` passes.
  Learner check: In 4 windows, start a game. In a Student window, follow your yellow pieces, collect 3, and open the terminal. Arrange it yourself once, then on another task let Study-Bot arrange it after the Bluffer hacked it, and compare the question you get. Check that the Bluffer's window shows no pieces.
  Commit: `Add question pieces to hunt and arrange`

- [x] **3c. Shared pieces: team up at a terminal**
  Becomes usable: Pieces belong to nobody. Anyone picks up any piece by walking over it, and your bag shows their text. The Bluffer can grab up to 2 to hoard. Classmates standing at the same terminal pool their pieces. Whoever presses Use picks 3 in order (or lets Study-Bot arrange a full question). A correct answer uses the pieces, and anything else returns them. The class board counts solved questions (2 per classmate). A leaver's pieces go back to their spots.
  Why now: After trying slice 3b, the learner redesigned the hunt as teamwork ("everyone can help arrange", "meet at terminal") and let the Bluffer take pieces. It changes the kernel moment again, so it comes before meetings.
  PRD ref: `prd.md > Question Pieces`, `prd.md > Study-Bot Terminals (the kernel)`
  Spec ref: `spec.md > Question Pieces (server + client)`, `spec.md > Socket Events`
  Build: Add 2 questions (8 total), replace personal tasks with a class board, piece states (floor/held/used) with home spots, pickup for everyone with the Bluffer limit, the terminal pool, the 3-from-pool arrange check, Study-Bot arranging from the pool, use/return on answer, return-home on leave, the `game:bag` event, a bag panel, and the pool picker in `TerminalPanel`.
  Verify (mechanical): Vitest tests pass: anyone can pick up; the Bluffer stops at 2; the pool includes nearby classmates' pieces but never the Bluffer's; a terminal refuses a pool under 3; a 3-piece arrangement must be one question in order; Study-Bot needs a full question, and when hacked it gives `twistedPrompt` with the lie as its pick; correct uses pieces and wrong returns them; a leaver's pieces return home; the class wins when every question is solved. Simulation: two students pool pieces at one terminal and solve a question; `pieces:state` never contains text. `npm run build` passes.
  Learner check: In 4 windows, have two Students collect pieces, meet at one terminal, and build a question from the shared pool. As the Bluffer, grab 2 pieces and check that you can't take a third. Leave a window with pieces in hand and watch them reappear on the floor.
  Commit: `Share question pieces and team up at terminals`

- [x] **4. Call a meeting and kick the Bluffer out of school**
  Becomes usable: Near the classroom button, any living player can call a meeting (once each). Everyone switches to the Meeting screen with text chat and voting (vote or skip, 90s). The result says who was kicked out and whether they were the Bluffer. Ejected or disconnected players become spectators. All four win conditions work. The Game Over screen reveals every role and returns to the menu.
  Why now: Completes the core loop and the demo moment ("The bluffer get caught then kicked out from school") right after the kernel.
  PRD ref: `prd.md > Meetings and Voting`, `prd.md > Win and Game Over`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Meeting, Chat & Vote (client)`, `spec.md > Game Over (client)`, `spec.md > Game Server (server/)`, `spec.md > Data Model` (win checks), `spec.md > Important Failure Modes`
  Build: `meeting:call` with proximity and one call per player, the meeting phase timer, chat (meeting-only, 140 characters), vote tally with tie/skip → nobody, ejection, respawn in the classroom, spectator mode, disconnect-as-eliminated, the Bluffer-plus-one rule, the `Meeting`/`VoteResult`/`GameOver` screens, and Back to menu.
  Verify (mechanical): Vitest tests pass for vote tally (majority, tie, skip), every win condition including Bluffer disconnect, and chat rejected outside meetings. A simulation plays a full game to a "class wins" ejection and another to a "Bluffer wins" ending. `npm run build` passes.
  Learner check: In 4 windows, call a meeting, chat from two windows, vote out the Bluffer, and see "Kicked out of school!" and every role revealed. Play again and vote out an innocent to see the game continue.
  Commit: `Add meetings, voting, and game over`

- [x] **5. Set up your avatar on the home screen**
  Becomes usable: The Main Menu shows your avatar slowly rotating in 3D. You can choose one of 4–6 characters, 5 colors, and a name. It's remembered on this device and appears in the lobby, the school, and the meeting list. CC0 character and furniture models replace the placeholder boxes where they load, with the bean as a fallback.
  Why now: The core game is complete and testable with beans, so the art risk can't block it. Avatars also make players recognizable before the role book is built.
  PRD ref: `prd.md > Avatar Setup`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Avatar Setup (client)`, `spec.md > School Scene (client 3D)`, `spec.md > Look and Feel`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Pick CC0 packs (Kenney or Quaternius) after confirming CC0 on each license page, add the needed `.glb` files to `client/public/models/`, write `shared/avatars.ts`, `avatar/AvatarPreview`, `AvatarPicker`, `avatarStorage` (try/catch, defaults), pass the character through join events, add models in `Player` and `SchoolMap` with `<Suspense>` and error-boundary bean fallback, and start `CREDITS.md`.
  Verify (mechanical): Vitest tests for `avatarStorage` pass (save, load, blocked storage → default). Every model path in `shared/avatars.ts` exists on disk. A simulation confirms `character` reaches other players in `lobby:state`/`game:state`. `npm run build` passes.
  Learner check: Set an avatar, reload, and confirm it's remembered. In a second window pick a different one, join the same lobby, and check both characters in the lobby and walking in the school.
  Commit: `Add avatar setup with CC0 characters`

- [x] **5b. Make the school feel like a school (interior design)**
  Becomes usable: Each room has its own floor (wood, carpet, lab tiles, canteen checks, hallway linoleum) and two-tone walls. Classroom 7A has a chalkboard ("Today's lesson: trust, but verify"), a teacher's desk, desk chairs, a clock, a window, and a poster. The hallway has lockers, and every door has a room sign. The library has a rug, lamps, and a plant. The lab has a periodic table, a safety poster, a sink, and flasks. The canteen has a kantin menu board, a counter, stools, a vending machine, and a window.
  Why now: After slice 5 the learner said the school "still feel plain without interior design or map design" and chose to build it from CC0 pieces plus code-drawn details, with no license risk.
  PRD ref: `prd.md > Look and Feel`
  Spec ref: `spec.md > School Scene (client 3D)`, `spec.md > Look and Feel`
  Build: More Kenney Furniture Kit (CC0) models, canvas-painted floors, posters, signs, a chalkboard, lockers, and a vending machine front (`client/src/game/textures.ts`), `client/src/game/Decor.tsx`, two-tone walls, and new solid furniture (teacher's desk, sink, counter, vending machine) in `shared/map.ts`.
  Verify (mechanical): A new reachability test flood-fills the floor from a classroom seat and confirms every seat, every terminal, the meeting button, and every piece hiding spot is still reachable. All tests, the simulation, and the build pass, and every new model file is served.
  Learner check: Walk through all five areas and say whether the school now feels like a school, and what still feels plain or wrong (stretched, floating, or backwards models).
  Commit: `Decorate the school with CC0 furniture and painted details`

- [x] **5c. Practice mode: play alone against bots, pick your role**
  Becomes usable: Main Menu → Practice → choose Student, Bluffer, Fact-Checker, or Random → a game starts at once with 3 bots. Bots walk the school, collect pieces, help at your terminal, solve questions (sometimes trusting Study-Bot blindly), hack if they're the Bluffer, call meetings after strikes, chat, and vote based on who was near a hacked terminal.
  Why now: Devpost's live review showed judges skip anything they can't try quickly alone. Needing 4 players is this game's version of a login wall. The learner asked for practice mode with a role choice before the role book and packaging.
  PRD ref: `prd.md > Practice Mode`
  Spec ref: `spec.md > Practice Mode & Bots (server + client)`, `spec.md > Socket Events`
  Build: Role override in role assignment, `practice:start`, `shared/nav.ts` (walkable grid + A*), `server/src/bots.ts` (BotController), bot hooks in `app.ts`'s tick, room cleanup when the human leaves, and a Practice button with a role picker on the Main Menu.
  Verify (mechanical): Vitest tests pass: A* finds paths between every room and never through obstacles; the chosen role is honored and the bots get the other roles; a fast-forwarded practice game sees bots pick up pieces, solve at least one question, and vote in a meeting. Simulation: a solo client starts practice with a chosen role, receives that role, sees bot positions change, and the room is gone after leaving. `npm run build` passes.
  Learner check: In one window, start Practice as the Bluffer and hack a terminal a bot will use. Then start Practice as a Student, team up with a bot at a terminal, and call a meeting. Say whether the bots feel alive enough to make practice fun.
  Commit: `Add practice mode with bots and role choice`

- [x] **5d. Real AI: Study-Bot explains, bots argue**
  Becomes usable: With an API key in `.env`, Study-Bot's confident explanation is written by Claude and types into its bubble a moment after the pick appears; in practice meetings, bots chat lines Claude writes from what they actually saw, with the Bluffer bot lying. Without a key (or if the AI is slow or down), everything works as before with the pre-written lines.
  Why now: The learner chose to bring real AI into the hackathon version (features A + B) after a cost estimate, before the role book and packaging.
  PRD ref: `prd.md > Real AI: Study-Bot Talks and Bots Argue`
  Spec ref: `spec.md > AI Service (server)`, `spec.md > External Services and Dependencies`
  Build: Add `@anthropic-ai/sdk`, `server/src/ai.ts` (prompts, caps, timeout, fallback), `.env` loading, the `terminal:botSays` event and a typing indicator in the Study-Bot bubble, the async `speak` hook in `BotController`, and `.env.example`.
  Verify (mechanical): Vitest tests pass: AI is off without a key; the output cleaner trims, strips quotes, and caps length; caps stop calls after the limit; a failing or refused call returns undefined; bots fall back to canned lines when `speak` gives nothing. The simulation still passes with no key. `npm run build` passes. With a key: one live Study-Bot line and one bot meeting line are printed by a small script (learner runs it, since it uses their key).
  Learner check: Put your key in `.env`, restart `npm run dev`, play Practice: open a terminal and watch Study-Bot explain its pick; call a meeting and read the bots' lines. Then remove the key and confirm the game still works.
  Commit: `Let Claude write Study-Bot's explanations and bot meeting lines`

- [x] **6. Open your book: the role reveal**
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

- [x] Early usable behavior explored — after slice 3 (the kernel playable in 4 windows), so feedback on Study-Bot, timing, and feel can shape meetings, avatars, and the reveal. Done: learner played 4 windows, confirmed it works, and found that a fast class wins before the Bluffer matters — leading to slice 3b (question pieces)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Hide pieces inside objects you examine (paintings, shelves, desks): an Examine action finds a piece or says "Nothing here", not only pieces lying on the floor — learner request after slice 3b
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
- Added `shared/src/geometry.ts` (reach checks shared by the client's Use button and the server's validation), `client/src/game/NearbyWatcher.tsx`, `client/src/hud/labels.ts`, and a temporary `hud/GameOverNotice.tsx` — small helpers the spec's component list implied but didn't name.
- Added a private `terminal:hackUsed` event so the Bluffer's red "hacked" screen clears when a classmate takes the bait, and an `AnswerOutcome` of `faked` for the Bluffer's pretend answers — the spec didn't say what the Bluffer sees after faking a task.
- Students and the Fact-Checker can only open terminals on their task list ("No task for you at this terminal"); the Bluffer can open any terminal to look busy. Answer options are shuffled per question so the right answer isn't always in the same spot.
- Desktop players can press E to use a terminal (in addition to the Use button), and task terminals show a bobbing yellow marker — both make the 4-window demo easier to follow.
- Added slice 3b (question pieces, arranging, Study-Bot arranging, Bluffer can't see pieces) — the first hands-on checkpoint found a fast class finishes every task before the Bluffer matters; the learner chose an escape-room hunt over tuning numbers. PRD (`Question Pieces`) and spec (`Question Pieces (server + client)`, events) updated to match.
- Added slice 3c (shared pieces, pooling at a terminal, Bluffer can hoard up to 2, leavers' pieces return home, class question board instead of personal tasks) — after trying 3b the learner chose a teamwork puzzle; PRD `Question Pieces`, spec `Question Pieces (server + client)` and events updated. Verify stays TRUE/FALSE.
- Added a Leave button (and Esc) to the terminal panel, with a `terminal:close` event — the learner found there was no way to back out of a terminal. Leaving costs nothing (no strike, no progress, pieces kept); a hack that was already used up by opening stays used.
- The Bluffer now handles pieces exactly like everyone (pick up max 2, pooled, can arrange and answer; no strikes from their own answers; no fake questions) — the learner found that a Bluffer whose pieces never pool, or who can't pick up, is always exposed by a 1-on-1 terminal test. Replaces the earlier fake-question and hoard-only behavior.
- Replaced the temporary `hud/GameOverNotice.tsx` with `screens/GameOver.tsx`; added a `room:leave` event (Back to menu) and `game:respawn` (seats after a meeting) not listed in the spec event table. Meeting/vote-result are sub-phases of a playing game (`GamePhase`), and the vote result stays on screen 6 seconds before a game-over check so the "kicked out" moment is seen.
- Avatar Setup offers all 12 Kenney Mini Characters (the plan said 4–6) since the pack has 12 at no extra cost. Characters keep their own textures; the player's color shows as a disc under their feet instead of tinting the model (tinting a textured model muddies it). If two players pick the same color, the later one gets the next free color.
- Added decorative CC0 furniture (plants, fridge, trash can, books) as solid map entries so collisions and piece spots stay consistent; every model falls back to its old box if it fails to load. Added `client/src/game/Character.tsx`, `FittedModel.tsx`, and `ModelBoundary.tsx` (not named in the spec).
- Added slice 5b (interior design) at the learner's request after slice 5; no ready-made classroom pack was clearly CC0 with redistribution allowed, so the school is built from Kenney CC0 models plus canvas-painted details. Floor room-name labels were replaced by door signs (also removing a font download from a CDN).
- Lighting changed to warm, dim late afternoon (low orange sun from the west, peach sky and fog, posters lit by the scene instead of glowing) and kantin prices to USD — learner feedback on slice 5b.
- Slice 5b follow-up from learner screenshots: bookcases filled with books, library floor changed from purple dotted carpet to dark wood ("the carpet feel off"), office chairs replaced with simple school chairs, and lived-in props added (notebooks, backpacks, globe, apple, meal trays) in `client/src/game/Props.tsx`.
- Added slice 5c (practice mode with 3 bots and a role choice) — Devpost's live review flagged friction before a judge can try an app; needing 4 players blocks solo judges. Moves filler bots off Deferred, for practice only. PRD `Practice Mode`, spec `Practice Mode & Bots` updated.
- Practice bots needed two fixes the plan did not foresee, found by fast-forwarded test games: bots must team up with each other (pieces end up split across bags, so a bot gathers every bot holding a piece of a question and meets at a terminal), and each terminal needs a precomputed standing spot in its own room (the nearest open grid cell to a wall-side terminal was on the far side of the wall, freezing bots in the hallway).
- Added a Leave lobby button — the learner found no way back to the menu from a lobby (only refreshing), which also hid Practice mode.
- Menus now scroll when taller than the window (the Practice button was hidden below the fold on a laptop screen with no way to scroll), and the avatar preview shrinks on short screens.
- Home screen split into game-style steps (learner: no scrollbar; "press start and then there is Vs and practice"): Title → Your student → Mode select (VS / Practice) → VS menu or Practice role picker. Lobby Leave and Back to menu return to Mode select. PRD Screens and Layout updated.
- Title screen wallpaper: learner picked a big confident Study-Bot on a sunburst saying "I'm always right! …probably." (bright, not spooky), with bigger bubble text and the logo kept off the bot (left column on wide screens, top on phones). Text changed to "PRESS ANYTHING TO CONTINUE".
- Added transitions (learner: "do not keep it like nothing"): menu cards pop in, the title zooms away on press, and every game opens with yellow school doors and a ringing bell ("Ding dong! Class 7A is starting…") that slide open while the camera swoops down from above. All respect reduced motion.
- Menus (Your student, Mode, VS, Practice, Join, Lobby) now share the title look: the yellow sunburst and Study-Bot on the right with a per-screen line, the card on the left, and the small logo styled like the title (learner: menus looked like "a different game").
- Menu transitions reworked (learner: entering felt sluggish, only an exit animation): one shared wallpaper now stays mounted across the title and every menu (no restart between screens); Study-Bot jumps in once and only its bubble pops with each new line; the title logo drops in, tagline fades in, and the button pops; leaving the title takes 0.18 s and menu cards slide in immediately.
- Study-Bot now drops out of view when you leave a screen and jumps back up with the new line on the next one (title → menu and between menu steps); all menu animations slowed down ~1.5–2× per learner feedback ("too fast").
- Real AI (Claude) explicitly deferred to Later by the learner after a cost estimate (Haiku 5.5 ≈ $0.0015/game, Sonnet 5.5 ≈ $0.03, Opus 5.5 ≈ $0.10 at ~20 calls/game); Study-Bot stays pre-written for the hackathon. Slice 7 README must state that Study-Bot is simulated.
- Lighting changed from late afternoon to early-afternoon daylight after a side-by-side of three presets (learner: "the new default is okay"); the comparison switch was removed.
- Added slice 5d (real AI: Study-Bot explanations + bot meeting lines) — the learner reversed the earlier "real AI later" decision. Default model Claude Opus 5.5 (configurable); the game still controls which answers are lies.
- Slice 5d: `terminal:botSays` event and `botTyping` flag added to the question payload; Study-Bot's pick still shows instantly and Claude's line follows. The simulation always forces the AI off so test runs never spend money; `npm run ai:check` makes two real calls with the learner's key. The simulation caught an `emit` binding bug in the new wiring that would have crashed every game start.
- Slice 5d: the learner asked for a hard monthly AI budget (`AI_MONTHLY_LIMIT_USD`): past it, or when Anthropic reports a billing or spend-limit error, the game falls back to the pre-written lines.
- Slice 5d: the first live check failed with a TLS error because Kaspersky Anti-Virus re-signs HTTPS traffic with its own root certificate, which Node does not trust by default. The server scripts now start Node with `--use-system-ca` (trusts the Windows certificate store; no change on Render). Failed connections no longer count toward the monthly budget; only timeouts, which may still be billed, do.
- Slice 5d: bot meeting lines are asked for at most 15 words and only cut at 25 (the learner saw a line cut off with "…").
- Title screen (learner feedback, outside the slice plan): the speech bubble no longer touches Study-Bot's antenna when it bounces or jumps in (the bot's rise is smoothly capped below the bubble); Study-Bot now acts out the game in a loop (a right answer stamped TRUE, a glitch "SYSTEM HACKED!", a confident wrong answer stamped FALSE, "Who hacked me?!") so the title shows what the game is about within seconds; the tagline is now "Never trust the bot blindly." in the title font. A three-step "how to play" row was tried and removed at the learner's request.
- CREDITS.md now states that Study-Bot is an original mascot drawn in code, and what Claude does and doesn't decide.
- Slice 6: the reveal is a server phase that ends when everyone closes their book (`reveal:ready`; practice bots count as ready) or after 15 seconds; the learner tried 20 s and 10 s first. Typing speed was tuned to match (about 5.7 s for the Student facts).
- Slice 6 (learner requests): a Skip button shows all the text at once; the book opens by itself instead of waiting for an "Open your book" tap; roles already read on this device show their text at once; the role panel's "Open your book" reopens it during play (closes with the button, Esc, or a tap outside, and closes itself for meetings and Game Over).
- Slice 6: the photo is a still image posed for each role (Student: hand up, head tilted; Fact-Checker: plain; Bluffer: bandit mask, hands behind the back), drawn once with a throwaway renderer. The learner chose this over a spinning 3D model to keep the book light. A magnifying glass prop and role stickers were tried and removed at the learner's request (the blocky hands can't hold props convincingly).
- Slice 6 bugs found from the learner's 4-window test and screen recording: the photo canvas grew without limit (resize loop), the closed and open book jumped between two layouts, the photo page showed before the cover had opened, a dark backing showed as the cover lifted, photos stayed blank in background tabs (browsers pause animation frames there), and the photo overflowed its frame. All fixed; ffmpeg was installed so recordings can be checked frame by frame.
