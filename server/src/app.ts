// Builds the HTTP server and wires Socket.IO events to the room manager and
// each room's referee. Kept separate from index.ts so the simulation script
// can start it on any port.

import { POSITION_BROADCAST_RATE, REVEAL_SECONDS } from "@whtb/shared/constants";
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { Role } from "@whtb/shared/types";
import { AiService } from "./ai";
import { BotController } from "./bots";
import { ActionError, GameRoom } from "./game/GameRoom";
import { RoomManager, gameState, lobbyState, positionsOf, type Room } from "./rooms";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** The built game page (`npm run build`), served by this same server in production. */
const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

export function createApp(options: { ai?: AiService; revealMs?: number; clientDir?: string } = {}) {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // One service for everything: the game page and Socket.IO share a port (Render gives us one).
  // In development Vite serves the page instead, so this only kicks in after a build.
  const clientDir = options.clientDir ?? CLIENT_DIST;
  if (existsSync(join(clientDir, "index.html"))) {
    // Built files have hashed names, so they can be cached for a long time; index.html can't.
    app.use(express.static(clientDir, { index: false, maxAge: "7d" }));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/socket.io")) return next();
      // Any page (like a /?room=ABCD share link) gets the game, which reads the address itself.
      res.set("Cache-Control", "no-cache");
      res.sendFile(join(clientDir, "index.html"));
    });
  }

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer, { cors: { origin: true } });
  const rooms = new RoomManager();
  const ai = options.ai ?? new AiService();
  console.log(
    !ai.enabled
      ? `[ai] off (${process.env.AI_DISABLED === "1" ? "AI_DISABLED=1" : "no ANTHROPIC_API_KEY"}), using pre-written lines`
      : ai.active
        ? `[ai] Claude is on (${ai.model}), $${ai.spentThisMonth().toFixed(2)} of $${ai.monthlyLimitUsd} used this month`
        : `[ai] monthly AI limit of $${ai.monthlyLimitUsd} reached, using pre-written lines`,
  );
  /** Recent meeting chat per room, for the bots' AI lines. */
  const chatLog = new Map<string, string[]>();
  /** Practice rooms' bots, by room code. */
  const bots = new Map<string, BotController>();
  const PRACTICE_BOTS = 3;

  function broadcastRoom(room: Room) {
    if (room.phase === "lobby") io.to(room.code).emit("lobby:state", lobbyState(room));
    else io.to(room.code).emit("game:state", gameState(room));
  }

  function startGame(room: Room, fixedRoles?: Map<string, Role>) {
    room.game = new GameRoom(
      [...room.players.keys()],
      {
        // A socket id doubles as a private room, so this reaches one player only.
        toPlayer: (id, event, payload) => {
          const to = io.to(id);
          const emit = (e: string, p: unknown) => (to.emit as (e: string, p: unknown) => boolean).call(to, e, p);
          if (event !== "terminal:question" || !ai.active || room.players.get(id)?.isBot) return void emit(event, payload);
          // Study-Bot's pick shows at once; Claude's explanation follows when it's ready.
          const q = payload as Parameters<ServerToClientEvents["terminal:question"]>[0];
          emit(event, { ...q, botTyping: true });
          void ai.studyBotLine(room.code, { question: q.prompt, choices: q.choices, pick: q.choices[q.botPick] }).then((text) => {
            if (room.game?.hasOpenTerminal(id)) emit("terminal:botSays", { terminalId: q.terminalId, text: text ?? null });
          });
        },
        toRoom: (event, payload) => {
          if (event === "chat:message") {
            const m = payload as { fromId: string; text: string };
            const log = chatLog.get(room.code) ?? [];
            log.push(`${room.players.get(m.fromId)?.name ?? "someone"}: ${m.text}`);
            chatLog.set(room.code, log.slice(-6));
          }
          if (event === "vote:result") chatLog.delete(room.code);
          (io.to(room.code).emit as (e: string, p: unknown) => boolean)(event, payload);
        },
        respawn: (ids) => {
          const seats: Record<string, { x: number; z: number }> = {};
          ids.forEach((id, i) => {
            const seat = SPAWN_SEATS[i % SPAWN_SEATS.length];
            const p = room.players.get(id);
            if (p) p.position = { x: seat.x, z: seat.z, heading: Math.PI };
            seats[id] = seat;
          });
          room.positionsDirty = true;
          io.to(room.code).emit("game:respawn", { seats });
        },
        publicChanged: () => {
          const over = room.game?.gameOver();
          if (over && room.phase !== "over") {
            room.phase = "over";
            broadcastRoom(room);
            io.to(room.code).emit("game:over", over);
          } else {
            broadcastRoom(room);
          }
        },
      },
      (id) => room.players.get(id)?.position,
      Math.random,
      Date.now,
      fixedRoles,
    );
    // Role books first; practice bots don't need to read theirs.
    const botIds = [...room.players.values()].filter((p) => p.isBot).map((p) => p.id);
    room.game.beginReveal(options.revealMs ?? REVEAL_SECONDS * 1000, botIds);
    broadcastRoom(room);
    room.game.dealSecrets();
    if (room.practice) {
      const players = [...room.players.values()];
      bots.set(
        room.code,
        new BotController({
          game: room.game,
          botIds: players.filter((p) => p.isBot).map((p) => p.id),
          humanId: players.find((p) => !p.isBot)!.id,
          position: (id) => room.players.get(id)?.position,
          move: (id, pos) => {
            const p = room.players.get(id);
            if (!p) return;
            p.position = pos;
            room.positionsDirty = true;
          },
          nameOf: (id) => room.players.get(id)?.name ?? "someone",
          speak: ai.active ? (req) => ai.meetingLine(room.code, { ...req, recentChat: chatLog.get(room.code) ?? [] }) : undefined,
        }),
      );
    }
  }

  io.on("connection", (socket) => {
    const enter = (room: Room) => {
      socket.join(room.code);
      broadcastRoom(room);
    };

    const leaveCurrent = () => {
      const before = rooms.roomOf(socket.id);
      const room = rooms.leave(socket.id);
      if (before) socket.leave(before.code);
      if (!room) return;
      if (room.game && room.phase === "playing") room.game.removePlayer(socket.id);
      else broadcastRoom(room);
    };

    /** Runs a referee action; rule violations go back to this player as an error. */
    const act = (fn: (game: GameRoom) => void) => {
      const room = rooms.roomOf(socket.id);
      if (!room?.game || room.phase !== "playing") return;
      try {
        fn(room.game);
      } catch (err) {
        if (err instanceof ActionError) socket.emit("error", { code: err.code, message: err.message });
        else throw err;
      }
    };

    socket.on("lobby:create", (p) => {
      leaveCurrent();
      const r = rooms.create(socket.id, { name: p?.name, character: p?.character, color: p?.color });
      if (!r.ok) return void socket.emit("error", r.error);
      enter(r.value);
    });

    socket.on("lobby:join", (p) => {
      if (rooms.roomOf(socket.id)?.code !== p?.code?.toUpperCase?.()) leaveCurrent();
      const r = rooms.join(socket.id, p?.code, { name: p?.name, character: p?.character, color: p?.color });
      if (!r.ok) return void socket.emit("error", r.error);
      enter(r.value);
    });

    socket.on("practice:start", (p) => {
      leaveCurrent();
      const role = p?.role;
      const r = rooms.createPractice(socket.id, { name: p?.name, character: p?.character, color: p?.color }, PRACTICE_BOTS);
      if (!r.ok) return void socket.emit("error", r.error);
      socket.join(r.value.code);
      const fixed = role === "student" || role === "bluffer" || role === "factChecker" ? new Map([[socket.id, role as Role]]) : undefined;
      startGame(r.value, fixed);
    });

    socket.on("lobby:start", () => {
      const r = rooms.start(socket.id);
      if (!r.ok) return void socket.emit("error", r.error);
      startGame(r.value);
    });

    socket.on("move", (pos) => {
      const room = rooms.roomOf(socket.id);
      if (room?.game && (!room.game.isAlive(socket.id) || room.game.phase !== "playing")) return;
      rooms.move(socket.id, pos);
    });

    socket.on("reveal:ready", () => act((g) => g.markReady(socket.id)));
    socket.on("spot:examine", (p) => act((g) => g.examine(socket.id, String(p?.spotId))));
    socket.on("terminal:open", (p) => act((g) => g.openTerminal(socket.id, String(p?.terminalId))));
    socket.on("terminal:arrange", (p) => act((g) => g.arrange(socket.id, Array.isArray(p?.order) ? p.order.map(String) : [])));
    socket.on("terminal:botArrange", () => act((g) => g.botArrange(socket.id)));
    socket.on("terminal:close", () => act((g) => g.close(socket.id)));
    socket.on("meeting:call", () => act((g) => g.callMeeting(socket.id)));
    socket.on("chat:send", (p) => act((g) => g.chat(socket.id, p?.text)));
    socket.on("vote:cast", (p) => act((g) => g.vote(socket.id, typeof p?.targetId === "string" ? p.targetId : null)));
    socket.on("room:leave", leaveCurrent);
    socket.on("terminal:answer", (p) =>
      act((g) => g.answer(socket.id, Number.isInteger(p?.choiceIndex) ? p.choiceIndex : null)),
    );
    socket.on("terminal:doubleCheck", () => act((g) => g.doubleCheck(socket.id)));
    socket.on("terminal:verify", () => act((g) => g.verify(socket.id)));
    socket.on("terminal:hack", (p) => act((g) => g.hack(socket.id, String(p?.terminalId))));

    socket.on("disconnect", leaveCurrent);
  });

  // ~12 times a second: send positions, run practice bots, and let each referee time out questions.
  const ticker = setInterval(() => {
    const live = new Set<string>();
    for (const room of rooms.allRooms()) {
      live.add(room.code);
      if (room.phase !== "playing") continue;
      bots.get(room.code)?.tick(1 / POSITION_BROADCAST_RATE);
      room.game?.tick();
      if (!room.positionsDirty) continue;
      room.positionsDirty = false;
      io.to(room.code).emit("positions", positionsOf(room));
    }
    // A practice room disappears when its human leaves; drop its bots too.
    for (const code of bots.keys()) if (!live.has(code)) bots.delete(code);
    for (const code of chatLog.keys()) if (!live.has(code)) chatLog.delete(code);
  }, 1000 / POSITION_BROADCAST_RATE);
  httpServer.on("close", () => clearInterval(ticker));

  return { app, httpServer, io };
}
