import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";

// Local secrets (ANTHROPIC_API_KEY, CLAUDE_MODEL) live in the repo-root .env, which git ignores.
// On Render the same variables are set in the dashboard instead.
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"));
} catch {
  // No .env file: fine, the AI just stays off.
}

const port = Number(process.env.PORT) || 3001;
const { httpServer } = createApp();

httpServer.listen(port, () => {
  console.log(`Who Hacked the Bot? server on http://localhost:${port}`);
});
