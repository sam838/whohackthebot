// Builds the HTTP server and wires Socket.IO events to the room manager.
// Kept separate from index.ts so the simulation script can start it on any port.

import { POSITION_BROADCAST_RATE } from "@whtb/shared/constants";
import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
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

  io.on("connection", (socket) => {
    const enter = (room: Room) => {
      socket.join(room.code);
      broadcastRoom(room);
    };

    const leaveCurrent = () => {
      const code = rooms.roomOf(socket.id)?.code;
      const room = rooms.leave(socket.id);
      if (code) socket.leave(code);
      if (room) broadcastRoom(room);
    };

    socket.on("lobby:create", (p) => {
      leaveCurrent();
      const r = rooms.create(socket.id, p?.name);
      if (!r.ok) return void socket.emit("error", r.error);
      enter(r.value);
    });

    socket.on("lobby:join", (p) => {
      if (rooms.roomOf(socket.id)?.code !== p?.code?.toUpperCase?.()) leaveCurrent();
      const r = rooms.join(socket.id, p?.code, p?.name);
      if (!r.ok) return void socket.emit("error", r.error);
      enter(r.value);
    });

    socket.on("lobby:start", () => {
      const r = rooms.start(socket.id);
      if (!r.ok) return void socket.emit("error", r.error);
      broadcastRoom(r.value);
    });

    socket.on("move", (pos) => {
      rooms.move(socket.id, pos);
    });

    socket.on("disconnect", leaveCurrent);
  });

  // Send everyone's positions to each playing room ~12 times a second.
  const ticker = setInterval(() => {
    for (const room of rooms.allRooms()) {
      if (room.phase !== "playing" || !room.positionsDirty) continue;
      room.positionsDirty = false;
      io.to(room.code).emit("positions", positionsOf(room));
    }
  }, 1000 / POSITION_BROADCAST_RATE);
  httpServer.on("close", () => clearInterval(ticker));

  return { app, httpServer, io };
}
