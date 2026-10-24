// Checks a running production server from the outside, like a player's browser would:
// the game page loads (also from a share link), its files load, and a game can start.
// Run with: npm run build && npm start, then in another terminal: npm run smoke [url]

import type { ClientToServerEvents, ServerToClientEvents } from "@whtb/shared/events";
import { io as connect, type Socket } from "socket.io-client";

const url = process.argv[2] ?? "http://localhost:4000";

function check(ok: boolean, label: string) {
  if (!ok) throw new Error(`FAIL: ${label}`);
  console.log(`  ok  ${label}`);
}

async function main() {
  console.log(`smoke test: ${url}`);
  const health = await fetch(`${url}/health`);
  check(health.ok && ((await health.json()) as { ok?: boolean }).ok === true, "/health answers");

  for (const path of ["/", "/?room=ABCD"]) {
    const res = await fetch(url + path);
    const html = await res.text();
    check(res.status === 200 && html.includes('<div id="root">'), `${path} serves the game page`);
    if (path === "/") {
      const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
      const asset = script ? await fetch(url + script) : undefined;
      check(Boolean(asset?.ok), `the page's script ${script ?? "(none found)"} loads`);
    }
  }

  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = connect(url, { transports: ["websocket"], forceNew: true });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });
    check(true, "Socket.IO connects");
    const state = new Promise<{ phase: string }>((resolve) => socket.on("game:state", resolve));
    const role = new Promise<{ role: string }>((resolve) => socket.on("game:role", resolve));
    socket.emit("practice:start", { name: "Smoke", character: "male-a", color: "#f2c14e", role: "student" });
    check((await state).phase === "reveal", "a practice game starts with the role book");
    check((await role).role === "student", "the player gets the role they picked");
  } finally {
    socket.disconnect();
  }
  console.log("\nProduction smoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
