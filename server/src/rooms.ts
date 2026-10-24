// Lobbies: codes, joining, leaving, host handoff, starting.
// Pure logic with no sockets, so it can be unit-tested.

import { DEFAULT_CHARACTER, isCharacter, isPlayerColor } from "@whtb/shared/avatars";
import { MAX_PLAYERS, MIN_PLAYERS, NAME_MAX_LENGTH, PLAYER_COLORS } from "@whtb/shared/constants";
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { GameError, GameStatePublic, LobbyState, Phase, PlayerPosition, PublicPlayer } from "@whtb/shared/types";
import type { GameRoom } from "./game/GameRoom";

// No I or O, so codes can't be confused with 1 or 0.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 4;

export interface ServerPlayer {
  id: string;
  name: string;
  color: string;
  character: string;
  position: PlayerPosition;
  /** A practice bot: server-side only, no socket. */
  isBot?: boolean;
}

/** What a player chose in Avatar Setup. Bad values fall back to defaults. */
export interface AvatarChoice {
  name: unknown;
  character?: unknown;
  color?: unknown;
}

export interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  players: Map<string, ServerPlayer>;
  /** Set when a position changed since the last broadcast. */
  positionsDirty: boolean;
  /** Practice room: one human against bots. */
  practice?: boolean;
  /** The referee, once the game has started. */
  game?: GameRoom;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: GameError };

const fail = (code: GameError["code"], message: string): { ok: false; error: GameError } => ({
  ok: false,
  error: { code, message },
});

function cleanName(name: unknown): string {
  return typeof name === "string" ? name.trim().slice(0, NAME_MAX_LENGTH) : "";
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private roomOfPlayer = new Map<string, string>();

  constructor(private random: () => number = Math.random) {}

  private newCode(): string {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(this.random() * CODE_LETTERS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  /** Your chosen color if nobody in the room has it yet, otherwise the next free one. */
  private colorFor(room: Room, wanted: unknown): string {
    const used = new Set([...room.players.values()].map((p) => p.color));
    if (isPlayerColor(wanted) && !used.has(wanted)) return wanted;
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }

  private addPlayer(room: Room, id: string, name: string, avatar: AvatarChoice): void {
    room.players.set(id, {
      id,
      name,
      color: this.colorFor(room, avatar.color),
      character: isCharacter(avatar.character) ? avatar.character : DEFAULT_CHARACTER,
      position: { x: 0, z: 0, heading: Math.PI },
    });
    this.roomOfPlayer.set(id, room.code);
  }

  create(playerId: string, avatar: AvatarChoice): Result<Room> {
    const name = cleanName(avatar.name);
    if (!name) return fail("NAME_REQUIRED", "Type a name first.");
    this.leave(playerId);
    const room: Room = { code: this.newCode(), hostId: playerId, phase: "lobby", players: new Map(), positionsDirty: false };
    this.rooms.set(room.code, room);
    this.addPlayer(room, playerId, name, avatar);
    return { ok: true, value: room };
  }

  join(playerId: string, rawCode: unknown, avatar: AvatarChoice): Result<Room> {
    const name = cleanName(avatar.name);
    if (!name) return fail("NAME_REQUIRED", "Type a name first.");
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    const room = this.rooms.get(code);
    if (!room) return fail("ROOM_NOT_FOUND", `Room ${code || "?"} wasn't found. Check the code and try again.`);
    if (room.players.has(playerId)) return { ok: true, value: room };
    if (room.phase !== "lobby") return fail("ALREADY_STARTED", "That game has already started.");
    if (room.players.size >= MAX_PLAYERS) return fail("ROOM_FULL", `That room is full (${MAX_PLAYERS} players).`);
    this.leave(playerId);
    this.addPlayer(room, playerId, name, avatar);
    return { ok: true, value: room };
  }

  /**
   * A practice room: this player plus bots, already started. Bots get names,
   * characters, and colors of their own.
   */
  createPractice(playerId: string, avatar: AvatarChoice, botCount: number): Result<Room> {
    const r = this.create(playerId, avatar);
    if (!r.ok) return r;
    const room = r.value;
    room.practice = true;
    const names = ["Rina", "Dimas", "Kevin", "Sari", "Budi"];
    const characters = ["male-b", "female-c", "male-d", "female-e", "male-f"];
    for (let i = 0; i < botCount; i++) {
      const id = `bot-${room.code}-${i}`;
      this.addPlayer(room, id, `${names[i]} (bot)`, { name: names[i], character: characters[i] });
      room.players.get(id)!.isBot = true;
    }
    return this.start(playerId);
  }

  /** Removes a player from their room. Returns the room if anyone is left in it. */
  leave(playerId: string): Room | undefined {
    const code = this.roomOfPlayer.get(playerId);
    if (!code) return undefined;
    this.roomOfPlayer.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.players.delete(playerId);
    // A practice room is just bots once its human leaves, so it goes away.
    const onlyBots = [...room.players.values()].every((p) => p.isBot);
    if (room.players.size === 0 || onlyBots) {
      for (const id of room.players.keys()) this.roomOfPlayer.delete(id);
      this.rooms.delete(code);
      return undefined;
    }
    if (room.hostId === playerId) room.hostId = room.players.keys().next().value!;
    room.positionsDirty = true;
    return room;
  }

  start(playerId: string): Result<Room> {
    const room = this.roomOf(playerId);
    if (!room) return fail("ROOM_NOT_FOUND", "You're not in a room.");
    if (room.hostId !== playerId) return fail("NOT_HOST", "Only the host can start the game.");
    if (room.phase !== "lobby") return fail("ALREADY_STARTED", "The game has already started.");
    if (room.players.size < MIN_PLAYERS) {
      const need = MIN_PLAYERS - room.players.size;
      return fail("NOT_ENOUGH_PLAYERS", `Need ${need} more player${need === 1 ? "" : "s"}.`);
    }
    room.phase = "playing";
    [...room.players.values()].forEach((p, i) => {
      const seat = SPAWN_SEATS[i % SPAWN_SEATS.length];
      p.position = { x: seat.x, z: seat.z, heading: Math.PI };
    });
    room.positionsDirty = true;
    return { ok: true, value: room };
  }

  move(playerId: string, pos: PlayerPosition): Room | undefined {
    const room = this.roomOf(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player || room.phase !== "playing") return undefined;
    if (![pos?.x, pos?.z, pos?.heading].every(Number.isFinite)) return undefined;
    player.position = { x: pos.x, z: pos.z, heading: pos.heading };
    room.positionsDirty = true;
    return room;
  }

  roomOf(playerId: string): Room | undefined {
    const code = this.roomOfPlayer.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  allRooms(): IterableIterator<Room> {
    return this.rooms.values();
  }
}

export function publicPlayers(room: Room): PublicPlayer[] {
  return [...room.players.values()].map(({ id, name, color, character }) => ({
    id,
    name,
    color,
    character,
    alive: room.game ? room.game.isAlive(id) : true,
    out: room.game?.outOf(id),
  }));
}

export function lobbyState(room: Room): LobbyState {
  return { code: room.code, hostId: room.hostId, players: publicPlayers(room) };
}

export function gameState(room: Room): GameStatePublic {
  const g = room.game;
  return {
    phase: room.phase === "playing" && g ? g.phase : room.phase,
    players: publicPlayers(room),
    strikes: g?.strikes ?? 0,
    progress: g?.progress ?? 0,
    goal: g?.goal() ?? 0,
    meetingCallerId: g?.meetingCallerId,
    meetingReport: g?.meetingReport,
    slips: g?.slips ?? [],
    phaseMsLeft: g?.phaseMsLeft(),
    votedIds: g?.votedIds() ?? [],
    readyIds: g?.readyIds() ?? [],
    meetingCallsLeft: g?.meetingCallsLeft() ?? {},
  };
}

export function positionsOf(room: Room): Record<string, PlayerPosition> {
  const out: Record<string, PlayerPosition> = {};
  for (const p of room.players.values()) out[p.id] = p.position;
  return out;
}
