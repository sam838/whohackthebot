// Tuning values shared by client and server. Timings were accepted as
// placeholders in prd.md > Assumptions to Confirm; tune them in playtests.

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 5;
export const TASKS_PER_PLAYER = 3;
/** Class questions to solve per non-Bluffer (prd.md > Question Pieces). */
export const QUESTIONS_PER_CLASSMATE = 2;
/** The Bluffer can hoard at most this many pieces at once. */
export const BLUFFER_MAX_PIECES = 2;
export const STRIKES_TO_LOSE = 3;

/** Time to arrange and answer once a terminal is open. */
export const QUESTION_SECONDS = 30;
export const DOUBLE_CHECK_COST_SECONDS = 8;
export const HACK_COOLDOWN_SECONDS = 30;
export const MEETING_SECONDS = 90;
/** How long the vote result stays on screen before play resumes. */
export const VOTE_RESULT_SECONDS = 6;
export const CHAT_MAX_LENGTH = 140;
export const MEETING_CALLS_PER_PLAYER = 1;
export const REVEAL_SECONDS = 8;

/** Walking speed in world units per second. */
export const WALK_SPEED = 4;
/** Collision radius of a player's body. */
export const PLAYER_RADIUS = 0.45;
/** How close a player must be to use a terminal or the meeting button. */
export const INTERACT_RADIUS = 1.6;
/** Position updates sent per second. */
export const MOVE_SEND_RATE = 12;
/** Position broadcasts per second from the server. */
export const POSITION_BROADCAST_RATE = 12;

export const NAME_MAX_LENGTH = 12;
/** Player colors in join order (until avatar setup in slice 5). */
export const PLAYER_COLORS = ["#f2c14e", "#5b8def", "#e5566b", "#4cbf87", "#b07cf0"];
