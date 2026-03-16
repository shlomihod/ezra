import { createApp } from "./app.js";
import { PORT } from "./config.js";
import { mountMcp } from "./mcp.js";

const { server } = createApp({
  beforeStaticFiles: (app) => mountMcp(app),
});

server.listen(PORT, () => {
  console.log(`Ezra server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
