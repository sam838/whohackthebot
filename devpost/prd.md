---
doc: prd
status: approved
---

# Who Hacked the Bot? — Product Requirements

A multiplayer social deduction web game for Asian Gen Z friend groups. Players at a cartoon school rely on Study-Bot, an AI study assistant, while one secret classmate, the Bluffer, makes it lie.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. A player opens the game link in their phone's browser and sees the **Main Menu**: their **avatar** (a rotating 3D preview they can customize) plus **Create Lobby** or **Join Friend**.
2. **Create Lobby:** they enter a name and get a lobby with a **short room code** and a **share link**.
3. **Join Friend:** friends either type the room code or tap the share link, which **joins the lobby automatically**. They enter a name.
4. In the **Lobby**, everyone sees the code and the list of players. The host presses **Start** once at least **4 players** are in.
5. **Role Reveal:** everyone appears seated in the classroom. Each player opens a book showing their character's picture and secret role: **Student**, **Bluffer**, or **Fact-Checker**. A "quick facts" box types out what the role does, with a typing sound.
6. **Play:** players move with an on-screen **joystick** around a 2.5D cartoon school, visiting **Study-Bot terminals** in different rooms to complete their tasks.
7. **Collect question pieces:** the class's questions are split into pieces scattered around the school. Anyone can pick up any piece (the Bluffer too, to hoard them).
8. **At a terminal:** classmates standing together pool their pieces; whoever presses Use arranges 3 into a question, or lets Study-Bot arrange it. Then a timed multiple-choice question appears and Study-Bot confidently recommends one option. The player picks an answer, either trusting Study-Bot or using **Double-check** first.
8. **Bluffer:** secretly hacks terminals so their next answer is a convincing lie, and pretends to do tasks.
9. **Fact-Checker:** once per game, can verify whether Study-Bot's answer is TRUE or FALSE.
10. A trusted lie adds a **strike**, shown to everyone. A correct answer adds class progress.
11. Anyone can press the **meeting button in the classroom**. Everyone is brought to the classroom, argues in **text chat**, and **votes** someone out (or skips).
12. Play continues after each meeting until someone wins:
    - **Class wins:** the Bluffer is voted out ("kicked out of school"), or the class reaches the progress goal.
    - **Bluffer wins:** the class reaches 3 strikes, or only the Bluffer and one other player remain.
13. **Game Over** screen shows who won and reveals every role.

**Success (the demo moment):** "The bluffer get caught then kicked out from school."

## Screens and Layout

| Screen | Purpose |
|---|---|
| **Title** | Logo, tagline, blinking PRESS START (any key, click, or tap) |
| **Your student** | Avatar setup: character, color, name (skipped for returning players) |
| **Mode select** | **VS** (play with friends) or **Practice** (vs 3 bots), plus your avatar to edit |
| **VS menu** | Create Lobby / Join Friend |
| **Practice menu** | Pick a role: Student, Bluffer, Fact-Checker, Random |
| **Join** | Enter room code and name (skipped when arriving via share link, apart from the name) |
| **Lobby** | Room code, share link, player list, Start (host only) |
| **Role Reveal** | Classroom → book opens → character picture, role name, typed quick facts |
| **Game (map)** | Phone-sized view of the school with joystick, task list, strike count, class progress, action button |
| **Terminal** | Question, timer, Study-Bot's recommendation, multiple-choice answers, Double-check, Verify (Fact-Checker), Hack (Bluffer) |
| **Meeting** | Text chat, player list, vote buttons, skip vote |
| **Vote Result** | Who was voted out and whether they were the Bluffer |
| **Game Over** | Winner, all roles revealed, back to menu |

The game is designed for **phone screens in portrait** (it's a phone-browser game) and also works in desktop browser windows for testing and the demo.

## Look and Feel
Source: `scope.md > Inspiration & Identity`.

- **Common school, cartoon style.** Bright and friendly, recognizable as an everyday school (classroom, library, lab, canteen).
- **Art style reference: Super Sus.** Cute, chunky cartoon characters with a soft, slightly 3D look, in bright colors. Version one is **2.5D**: real 3D models seen from a **fixed camera angle above that follows the player** (like Mobile Legends and Super Sus). The player never rotates the camera. Inspired by the style only: no Super Sus assets or characters.
- **Interior design (added during build):** each room has its own floor, two-tone walls, door signs, and room-specific details: a chalkboard reading "Today's lesson: trust, but verify", hallway lockers, a library rug and lamps, a lab periodic table and flasks, and a canteen *kantin* menu (Nasi Goreng, Mie Ayam, Es Teh, priced in USD). Built from CC0 models and code-drawn pictures.
- **Lighting: early-afternoon daylight** — bright, clean light with a slightly warm tint and a pale blue sky, matching the sunny title. Chosen after comparing noon, early afternoon, and late afternoon (first version was "too bright"; late afternoon felt moody next to the bright title).
- **Do not copy Among Us.** The school setting and the book role reveal are the game's own identity.
- **Role reveal:** opening a book in class; quick facts appear with a **typing animation and typing sound**, like Study-Bot writing.
- Study-Bot should feel like a confident chatbot (chat-bubble style answers).
- Must not feel like an "educational game." No lessons, no quizzes that look like school tests.

## Features and Behavior

### Real AI: Study-Bot Talks and Bots Argue
*Added during `5-build`: the learner first deferred real AI, then chose to build features A and B after a cost estimate.*
- As a player, I want Study-Bot to explain its answer in its own confident words, so it feels like a real chatbot I might trust.
  - [ ] Study-Bot's pick (A/B/C/D) shows instantly, as before; a short explanation in Study-Bot's overconfident voice types in a moment later.
  - [ ] The game still decides which answer Study-Bot gives (true, or the lie when hacked); Claude only writes the explanation for it, and it never admits it might be wrong.
  - [ ] If the AI is slow, unavailable, or not configured, the pre-written line stays and the game works exactly as before.
- As a practice player, I want the bots to argue like real classmates in meetings.
  - [ ] Each bot's meeting line is written by Claude from what that bot actually saw (where it was, who stood near the hacked terminal); the Bluffer bot lies convincingly.
  - [ ] Falls back to the canned lines when the AI is unavailable.
- The model is a setting (default Claude Opus 5.5); the API key lives only on the server.

### Practice Mode
*Added during `5-build` after Devpost's live review session showed judges skip apps they can't try alone. Learner: "create practice mode with bots and the player can change what role they want."*
- As a judge or a player without friends online, I want to play a full game alone against bots so I can try every part of the game in one window.
  - [ ] The Main Menu has a **Practice** button next to Create Lobby and Join Friend.
  - [ ] Before starting, I choose my role: Student, Bluffer, Fact-Checker, or Random.
  - [ ] The game starts right away with me and 3 bots (no lobby, no room code); the bots get the other roles.
  - [ ] Bots walk the school, pick up pieces, come to help at the terminal I'm using, and solve questions (they sometimes trust Study-Bot blindly, like real players).
  - [ ] A Bluffer bot hacks terminals. After a strike, a bot may call a meeting.
  - [ ] In meetings, bots chat short lines (where they were, who they saw near the hacked terminal) and vote based on who was near it; the Bluffer bot lies.
  - [ ] Every win and lose condition works the same as a real game; Back to menu ends practice.

### Avatar Setup
*Added during `4-spec` at the learner's request.*
- As a player, I want to set up my avatar on the home screen so friends recognize me in the school and in meetings.
  - [ ] Main Menu shows my avatar as a slowly rotating 3D preview.
  - [ ] I can choose one of 4–6 characters, a color, and my name.
  - [ ] My choice is remembered on this device the next time I open the link.
  - [ ] The chosen character and color appear on the role book, in the school, and in the meeting list.

### Main Menu and Lobby
- As a player, I want to create a lobby and share a code or link so my friends can join quickly.
  - [ ] Main Menu shows **Create Lobby** and **Join Friend**.
  - [ ] Creating a lobby shows a short room code and a copyable share link.
  - [ ] Typing a valid code plus a name puts the player in that lobby's player list on every screen.
  - [ ] Opening the share link asks only for a name, then joins that lobby automatically.
  - [ ] **Start** is visible only to the host and enabled only at 4+ players. With fewer, it says how many more are needed.

### Role Reveal
- As a player, I want a dramatic, secret role reveal so the game starts with tension.
  - [ ] Every player gets exactly one role: exactly 1 Bluffer, exactly 1 Fact-Checker, the rest Students.
  - [ ] Each player sees only their own role.
  - [ ] The book shows the player's character picture, role name, and quick facts typed out with sound.
  - [ ] The book opens by itself; the photo is a still picture posed for the role (Bluffer wears a bandit mask). Skip shows all the text at once; roles you've read before show their text at once.
  - [ ] Class starts when everyone closes their book, or after 15 seconds at most.
  - [ ] During play, "Open your book" in the role panel opens it again; you close it whenever you like.

**Quick facts (draft wording, editable):**
- **Student:** Answer questions at Study-Bot terminals. But careful: someone may have hacked it. Trust it, or double-check? *Win:* answer enough questions right, or vote out the hacker.
- **Bluffer:** You hacked Study-Bot. Make terminals give convincing wrong answers, and blend in so nobody suspects you. *Win:* get the class to trust enough wrong answers.
- **Fact-Checker:** You can see the truth, once. Use it to expose a lie, but stay hidden, because if the Bluffer knows who you are, you're a target. *Win:* same as Students.

### Moving Around the School
- [ ] An on-screen joystick moves the player's character. Other players are visible moving in real time.
- [ ] The school has a few rooms, starting in the classroom. See **Assumptions to Confirm** for the room count.
  *(Final review: doubled to 8 rooms plus a long hallway: Class 7A, Library, Science Lab, Canteen, Gym, Server Room, Music Room, Art Room.)*
- [ ] **Limited vision:** during class you see a circle around you (about a room across); walls and distance hide classmates and darken the rest of the school. Meetings, the role book, Game Over, and expelled players see everyone.
- [ ] Every classmate you can see has a **name tag in their player color** above their head, so sightings are clear ("green Kevin left the server room").
- [ ] The game downloads all models and fonts behind a short loading splash (at least 2.5 s, with a progress bar and a credit line), so nothing pops in later.
- [ ] A task list shows which terminals the player still needs to visit.
- [ ] Strike count (e.g. "Strikes: 1/3") and class progress are always visible to everyone.

### Study-Bot Terminals (the kernel)
Source: `scope.md > The Unique Kernel`.
- As a Student, I want Study-Bot to give me a confident answer so I have to decide whether to trust it.
  - [ ] Walking up to a terminal shows an action button; tapping it opens the question.
  - [ ] Each question is **multiple choice** with a visible countdown timer.
  - [ ] Study-Bot recommends one option in a confident chat-bubble style.
  - [ ] **Double-check** costs time on the timer and shows a hint that helps judge the answer.
  - [ ] Picking the correct option adds class progress. Picking Study-Bot's corrupted recommendation adds **1 strike**, visible to everyone. Running out of time counts as a wrong answer.
  - [ ] Questions are pre-written school-subject and trivia questions, each with a **plausible wrong answer** for when the terminal is hacked.
  - [ ] After a correct answer or a strike, the player sees the real answer and a one-line "why". A plain wrong answer shows no answer, because those pieces can be tried again.

### Question Pieces
*Added during `5-build` after the first hands-on checkpoint (a fast class could finish every task before the Bluffer mattered), then reworked into a shared, teamwork puzzle after slice 3b. Source: learner ("escape room", "arrange the question", "everyone can help arrange", "meet at terminal").*
- The class shares a board of questions to solve: 2 per classmate (6 with 4 players, 8 with 5). This replaces personal task lists. *(Balance, tuned with `npm run balance`: on the first small school the Bluffer won only about 1 game in 12, so it went to 3 per classmate with a 20-second hack cooldown. The bigger school (slice 8) adds enough walking that 2 per classmate with the 20-second cooldown is about even.)*
- Each question is split into 3 pieces **hidden inside things** in different rooms (desks, posters, bookshelves, lockers, the fridge…). Nobody owns a piece. *(Changed in final review: the learner wanted pieces found by searching, not lying on the floor.)*
- As a player, I want to pick up any piece and team up with classmates at a terminal so that solving questions takes cooperation and talk.
  - [ ] Walking close to a searchable thing shows a glowing ring on the floor in front of it (the learner found floating markers distracting). Standing at one, **Examine** finds the piece hidden there ("Found “What is” in the fridge!") or says "Nothing here". There are more hiding spots than pieces, and nobody is told where pieces hide; things you've searched look searched.
  - [ ] You only learn a piece's text once you find it, and your bag shows what you carry.
  - [ ] The Bluffer collects pieces like anyone (at most 2 at a time); their pieces pool like anyone's, so nobody can be cleared or exposed by a terminal test. The Bluffer can arrange and answer too, but can never cause a strike, and never uses up their own hack.
  - [ ] At a terminal, the pieces of every classmate standing there are pooled, without showing who brought which.
  - [ ] Whoever presses Use picks 3 pieces from the pool and puts them in order, or lets Study-Bot arrange a full question from the pool.
  - [ ] When the terminal is hacked, Study-Bot arranges a **believable wrong question** that its lie answers; the 3 real pieces are shown underneath.
  - [ ] A correct answer uses up those 3 pieces and adds class progress; a wrong answer or trusted lie returns them to whoever brought them.
  - [ ] If a classmate leaves the game, their pieces go back into the things they were found in.
  - [ ] Any terminal can be used for any question.

### Bluffer: Hacking
- [ ] At a terminal, the Bluffer sees a **Hack** action that only they can see.
- [ ] A hacked terminal's next Study-Bot answer recommends the plausible wrong option, still sounding confident.
- [ ] Hacking has a cooldown, so the Bluffer can't hack terminals back to back.
- [ ] The Bluffer can open terminals and look busy like everyone else (fake tasks).

### Fact-Checker: Verify
- [ ] At a terminal, the Fact-Checker sees **Verify** while it's unused.
- [ ] Verify shows **TRUE** or **FALSE** about Study-Bot's current recommendation.
- [ ] Usable **once per game**; afterward it disappears.

### Meetings and Voting
- [ ] A **meeting button in the classroom** can be pressed by any living player.
- [ ] Pressing it brings every player to the Meeting screen.
- [ ] Meeting screen has a **text chat**, available only during meetings.
- [ ] Each player votes for one player or skips. The result is shown to everyone.
- [ ] A voted-out player is removed from play. The result says whether they were the Bluffer.
- [ ] Players can claim any role in chat; the game never confirms roles until Game Over.

### Win and Game Over
- [ ] Class wins when the Bluffer is voted out ("kicked out of school") or class progress reaches the goal.
- [ ] Bluffer wins at **3 strikes**, or when only the Bluffer and one other player remain.
- [ ] Game Over shows the winning side, reveals every player's role, and offers a way back to the menu.
- [ ] Game Over shows **Myths busted**: each of the game's questions with the myth Study-Bot could push, crossed out, next to the truth and why.
- [ ] There is no game timer.

## States and Boundaries
- **Wrong room code:** Join shows a clear message that the room wasn't found, and lets the player try again.
- **Too few players:** Start stays disabled with a "need X more players" message.
- **Game already started:** someone joining by code or link is told the game is in progress.
- **Player disconnects mid-game:** see **Assumptions to Confirm**.
- **Voted-out player:** can no longer move, answer, vote, or chat (see assumptions for what they see).
- **Avatar remembered on the device** (name, character, color). Nothing else persists between games. No accounts, no saved history.

## Product Decisions
- **Web game in the phone browser** — nothing to install, friends join instantly; Play Store later.
- **Create/join lobby by code or share link, no public matchmaking** — "real online matchmaking will take too long to build in this hackathon."
- **Minimum 4 players** — the smallest group with 1 Bluffer, 1 Fact-Checker, and 2 Students where a vote means something.
- **Name: Who Hacked the Bot?** — the meeting question becomes the title.
- **Demo with 4 browser windows side by side**, not 4 real people — viewers see every player's screen at once.
- **Role reveal is the school's own**, not Among Us's: sitting in class, opening a book, typed quick facts with sound — "Do not copy it."
- **Joystick movement** — chosen for phone play.
- **Fact-Checker verifies once per game**, so the class doesn't stop thinking and rely on them like an AI.
- **Multiple-choice, timed questions** for now.
- **Strikes shown to everyone** — strike timing becomes evidence to argue about in meetings.
- **No game timer, like Among Us** — the game ends only through win conditions.
- **Bluffer wins when only they and one other remain** — prevents endless games without a timer.
- **Text chat during meetings** — "for this build use chat first"; the demo can show the argument.
- **Meeting button in the classroom** (the main room).
- **Common school, cartoon style.**
- **Art style like Super Sus** — cute, chunky cartoon characters your players already know.
- **2.5D in version one** — after comparing 2D, 2.5D, and full 3D side by side (https://claude.ai/artifact/AH9VqGaLz1TYLjQgsdcAjY): "Lets make it 2.5 d for now." Looks like the mobile games players know (ML, Super Sus), keeps one-joystick controls, avoids free-camera problems. Full 3D moves to Later.
- **Fixed camera that follows the player** — part of the 2.5D choice; walls that hide players may need to turn see-through.
- **Avatar setup on the home screen** — 4–6 characters + color with a rotating 3D preview; helps players recognize each other in meetings. Remembered on the device.
- **Device memory instead of Google sign-in** — "keep localstorage for now"; sign-in would add setup, a database, and a login before playing.
- **Question pieces, escape-room style** — each question is split into 3 pieces hidden in different rooms; slows the rush and gives the Bluffer time.
- **Study-Bot can arrange the question** — and arranges a believable wrong one when hacked, keeping the AI shortcut at the center.
- **Shared pieces, meet at a terminal** — players pool what they found at a terminal; teamwork and alibis ("Rina and I solved it together").
- **The Bluffer handles pieces exactly like everyone (max 2)** — the learner spotted that if the Bluffer's pieces never pool (or they can't pick any up), anyone could "prove it at the terminal" and the Bluffer would always lose. Catching them now relies on behavior and stories, not a mechanical test. Their answers never cause strikes; a correct one still helps the class.
- **Leavers' pieces go home** — a classmate who leaves returns their pieces to where they were found.
- **Verify stays TRUE/FALSE** — reconfirmed after slice 3b.
- **Practice mode with bots, role of your choice** — judges and solo players can try the full game in one window; reverses the earlier "no filler bots / no CPU opponents" decision for practice only. Multiplayer with friends stays the main mode.
- **Real AI for Study-Bot's explanations and practice bots' meeting lines (A + B)** — first deferred ("can we put the real AI later"), then chosen after a cost estimate (~20 calls per game: Haiku 5.5 ≈ $0.0015, Sonnet 5.5 ≈ $0.03, Opus 5.5 ≈ $0.10). The game keeps control of which answer is a lie; Claude only writes the words. AI-generated questions stay on Later.
- **Claims aren't verified** — anyone can claim a role, and nobody has to believe it.

## Assumptions to Confirm
Drafted by the agent as placeholders; the learner accepted them as drafted at approval ("For now i think thats good"). Tune during the build.
- **Rooms:** 4 — Classroom (start + meeting button), Library, Science Lab, Canteen, with terminals in all but the Classroom.
- **Players:** 4–5 (max 5, per scope).
- **Tasks:** each player gets 3 terminal tasks; the class goal is enough correct answers to roughly match a ~10-minute game (tuned during build).
- **Question timer:** about 20 seconds; Double-check costs about 8 seconds and shows a short hint or source line.
- **Hack cooldown:** about 30 seconds.
- **Meeting limit:** each player can call 1 meeting per game, so it can't be spammed. Meetings last about 60–90 seconds for chat and voting.
- **Fact-Checker sees TRUE/FALSE only**, not the correct answer.
- **Voted-out players** become spectators who can watch but not act.
- **Disconnects:** a disconnected player is treated like a voted-out player; their role isn't revealed until Game Over.
- **Characters:** superseded by **Avatar Setup** — chosen on the home screen, not in the lobby.
- **Chat only during meetings.**

## What We're Building
- Main Menu, create/join lobby with room code and share link, lobby with host Start (4+ players).
- Book-style role reveal with typed quick facts and typing sound.
- One 2.5D cartoon school map (3D models, fixed follow camera) with joystick movement synced across players.
- Study-Bot terminals with timed multiple-choice questions, Double-check, strikes, and class progress.
- Bluffer hacking with cooldown; Fact-Checker verify once per game.
- Meeting button, text chat, voting, vote result.
- Win conditions and Game Over with role reveal.
- A pre-written set of questions, each with a plausible lie, a hint, 3 pieces, and a twisted wrong version for hacked arranging.
- Question pieces hidden around the school, arranging at terminals, Study-Bot arranging.

## Deferred From the POC
- **Public matchmaking** — too long to build; friends join by code or link instead.
- **Play Store / App Store release** — store accounts and review don't fit the hackathon; phone browser works now.
- **Voice chat** — text chat works for the demo.

## Possible Later Enhancements
- Bluffer powers to hide or forge clues (needs forgery detection to stay fair).
- Clues that carry evidence about the answer (option C from the slice-3 checkpoint).
- Google sign-in to save avatar and stats across devices.
- Hats and accessories for avatars.
- Multiple maps.
- Full 3D with a free camera, possibly a Roblox version.
- More special roles.
- AI-generated questions and lies (riskiest: a bad question breaks a round).
- A real playtest with friends to tune balance.
- Room-based vision (see your whole room and a little through doorways) instead of a circle; clearer, but more work to draw.
- Practice bot difficulty (easy bots trust Study-Bot and vote randomly; hard bots double-check and track who was near hacked terminals). Question difficulty levels need a much bigger question bank first.

## Non-Goals
- **Not an educational quiz app** — no lessons, scores, or teacher dashboards.
- **No accounts, profiles, or saved history** — every game is fresh.
- **No smart AI opponents** — practice bots follow simple rules; the real fun is still accusing friends.
- **No copying Among Us visuals or reveal** — school theme is the identity.
- **No emotional support or news topics** — questions are school subjects and trivia.

## Open Questions
- **Fallback if 2.5D art isn't coming together** (e.g. simple bean-shape characters) — learner hasn't decided; raise in `4-spec`.
- Timing and count values under **Assumptions to Confirm** — accepted for now, tune during the build.
- Exact question content (10–20 questions with plausible lies and hints) — can be written during the build.
