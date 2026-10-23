import { createApp } from "./app";

const port = Number(process.env.PORT) || 3001;
const { httpServer } = createApp();

httpServer.listen(port, () => {
  console.log(`Who Hacked the Bot? server on http://localhost:${port}`);
});
