// Builds the HTTP server and wires Socket.IO events to the room manager and
// each room's referee. Kept separate from index.ts so the simulation script
// can start it on any port.

import { POSITION_BROADCAST_RATE } from "@whtb/shared/constants";
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ActionError, GameRoom } from "./game/GameRoom";
import { RoomManager, gameState, lobbyState, positionsOf, type Room } from "./rooms";

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function createApp() {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer, { cors: { origin: true } });
  const rooms = new RoomManager();

  function broadcastRoom(room: Room) {
    if (room.phase === "lobby") io.to(room.code).emit("lobby:state", lobbyState(room));
    else io.to(room.code).emit("game:state", gameState(room));
  }

  function startGame(room: Room) {
    room.game = new GameRoom(
      [...room.players.keys()],
      {
        // A socket id doubles as a private room, so this reaches one player only.
        toPlayer: (id, event, payload) => (io.to(id).emit as (e: string, p: unknown) => boolean)(event, payload),
        toRoom: (event, payload) => (io.to(room.code).emit as (e: string, p: unknown) => boolean)(event, payload),
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
    );
    broadcastRoom(room);
    room.game.dealSecrets();
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

    socket.on("piece:pickup", (p) => act((g) => g.pickUp(socket.id, String(p?.pieceId))));
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

  // ~12 times a second: send positions and let each referee time out questions.
  const ticker = setInterval(() => {
    for (const room of rooms.allRooms()) {
      if (room.phase !== "playing") continue;
      room.game?.tick();
      if (!room.positionsDirty) continue;
      room.positionsDirty = false;
      io.to(room.code).emit("positions", positionsOf(room));
    }
  }, 1000 / POSITION_BROADCAST_RATE);
  httpServer.on("close", () => clearInterval(ticker));

  return { app, httpServer, io };
}
