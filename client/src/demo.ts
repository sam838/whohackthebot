// A hook for recording the demo video (server/scripts/record-demo.ts). It exists
// only when the page is opened with ?demo, and changes no rules: a script can read
// what this player sees and steer with the same joystick input a phone uses.

import { joystick } from "./game/input";
import { localPlayer, remotePositions } from "./game/positions";
import { useGame } from "./net/store";

if (new URLSearchParams(location.search).has("demo")) {
  Object.assign(window, {
    __demo: {
      me: () => (localPlayer.body ? { x: localPlayer.body.x, z: localPlayer.body.z } : null),
      state: () => {
        const s = useGame.getState();
        return {
          menuScreen: s.menuScreen,
          phase: s.game?.phase,
          myId: s.myId,
          role: s.role,
          alive: s.game?.players.find((p) => p.id === s.myId)?.alive ?? true,
          bag: s.bag,
          searched: s.searched,
          arrange: s.arrange ? { cards: s.arrange.cards, wrongCount: s.arrange.wrongCount } : null,
          question: s.question
            ? {
                prompt: s.question.prompt,
                choices: s.question.choices,
                botPick: s.question.botPick,
                botLine: s.question.botLine,
                verified: s.question.verified,
                outcome: s.question.outcome,
              }
            : null,
          nearTerminal: s.nearTerminal,
          nearSpot: s.nearSpot,
          nearButton: s.nearButton,
          searching: Boolean(s.searching),
          strikes: s.game?.strikes ?? 0,
          progress: s.game?.progress ?? 0,
          chat: s.chat.length,
          myVote: s.myVote,
          gameOver: Boolean(s.gameOver),
          meetingCalls: s.myId ? (s.game?.meetingCallsLeft[s.myId] ?? 0) : 0,
          players: s.game?.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive })) ?? [],
          myHacks: s.myHacks,
          nearVictim: s.nearVictim,
          expelReady: s.expelReadyAt <= performance.now(),
          // Where everyone else is (the Bluffer sees them all anyway).
          others: [...remotePositions].map(([id, p]) => ({ id, x: p.x, z: p.z })),
        };
      },
      steer: (x: number, z: number) => {
        joystick.x = x;
        joystick.z = z;
      },
    },
  });
}
