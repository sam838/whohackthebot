import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import { io, type Socket } from "socket.io-client";

// Same origin: in dev, Vite forwards /socket.io to the server on :3001.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: true });
