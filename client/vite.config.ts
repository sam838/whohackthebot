import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward the live connection to the game server during development.
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
