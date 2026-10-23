---
doc: scope
status: approved
---

# Classroom Bluffer (working title)

A multiplayer social deduction game set in a school, where the class's AI study assistant might be lying, and one classmate is the reason why.

## The Unique Kernel
The class shares an AI study assistant, **Study-Bot**, which always answers confidently. One player, the **Bluffer**, can secretly make it lie. Every task is a small moment of deciding whether to trust a confident AI or double-check it. Players learn to doubt AI answers by losing to a liar, not by being lectured.

## Who It's For
Asian Gen Z players, especially in Indonesia, who play Mobile Legends and Roblox with friends and use AI chatbots for search, school, and entertainment. Today they mostly accept AI answers without checking. The research the learner cited says up to ~51% accept plausible wrong answers, and only ~25% click through to sources. A friend group that wants a quick game together, each on their own phone.

## The Core Loop
1. Friends join a game room from their own phones and get secret roles: **Students**, one **Bluffer**, and one **Fact-Checker**.
2. Players walk around a 2.5D school map to Study-Bot terminals in different rooms.
3. At a terminal, a school-subject or trivia question appears. Study-Bot gives a confident answer. The player **trusts it** (fast) or **double-checks** (costs time).
4. The Bluffer secretly corrupts terminals (with a cooldown) and fakes doing tasks. The Fact-Checker can verify an answer for certain but has to persuade the class without exposing themselves.
5. Trusting a corrupted answer costs the class a strike. Anyone can call a meeting, where players argue about who was where and vote someone out.
6. Students win by catching the Bluffer or finishing enough correct answers. The Bluffer wins through enough strikes.

Why they come back: the table drama of accusing friends, alibis, and the satisfaction of catching the liar. One game lasts at most 10 minutes.

## Inspiration & Identity
- **Among Us:** walking a map, tasks in rooms, emergency meetings, voting. 
- **Werewolf:** hidden roles, discussion, voting someone out.
- **Roblox Murder Mystery:** a special innocent role (the Sheriff), which became the **Fact-Checker**.
- **Super Sus:** art style reference: cute, chunky cartoon characters (added in `3-prd`).
- **Kahoot / Among Us room codes:** everyone joins from their own phone.
- Must **not** feel like an "educational game." The learning has to be the gameplay itself.
- Questions work best when **the wrong answer sounds right** (common misconceptions, e.g. "the Great Wall is visible from space").
- Concept mockup: https://claude.ai/artifact/WskRuoWkQD8h5vN4o4ZNCK
- Research map:
  - https://www.brusselstimes.com/news-contents/world-news/2247625/only-25-of-ai-users-verify-source-from-chatbots-despite-hallucinations/
  - https://arxiv.org/pdf/2603.19843
  - https://er.educause.edu/articles/2025/12/the-paradox-of-ai-assistance-better-results-worse-thinking

## Why This Matters to the Learner
They've been reading research that "Gen Z tend to use AI and it reduce their critical thinking," and that Gen Z plays a lot of games. They want to meet players where they already are, with something that doesn't feel educational: "if this project successful I think it can be good impact." They also see a game with real walking as what makes them "a strong contender in this hackathon."

## What "Working" Looks Like
4–5 friends, each on their own phone, join the same game, walk around the 2.5D school, answer questions at Study-Bot terminals, and get burned or saved by trusting or checking. A meeting is called.

**The "oh, that's cool" moment:** "The bluffer get caught then kicked out from school."

## The POC Boundary
- One **2.5D** school map (3D models, fixed camera angle that follows the player, like Mobile Legends / Super Sus) with a few rooms, Super Sus–style cartoon look. Exact room and question counts are decided in `3-prd`.
- *Revised during `3-prd`: the learner first chose full 3D ("High risk high return"), then after comparing 2D, 2.5D, and full 3D side by side chose 2.5D: "Lets make it 2.5 d for now."*
- Real walking, synced live across players' phones.
- 4–5 players join a room from their own devices.
- Roles: Students, one Bluffer, one Fact-Checker.
- Study-Bot terminals with pre-written school-subject and trivia questions, each with a plausible lie for when the terminal is corrupted.
- Trust or double-check, strikes, meetings, voting, and win/lose conditions.
- A game ends within 10 minutes.
- Build the trust mechanic (Study-Bot terminal, corrupting, strikes) first; movement stays simple.

## Later
- Multiple maps.
- Full 3D with a free camera (possibly a Roblox version).
- More special roles.

## Explicitly Cut
- **Solo puzzle formats (Trust Meter, Outthink the Bot):** the learner judged them "just basic puzzle game." They lack the social element.
- **Sharing one phone (pass-and-play):** the learner wants everyone to open the game and join on their own device.
- **Emotional support and news topics:** questions focus on school subjects and trivia for now. Emotional support is too heavy a topic for a light casual game.
