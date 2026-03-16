#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start the server
await import(path.resolve(__dirname, "../server/dist/index.js"));

// Open the browser after a short delay (skip in CI)
if (!process.env.CI) {
  const open = (await import("open")).default;
  const port = process.env.PORT || 3333;
  setTimeout(() => {
    open(`http://localhost:${port}`);
  }, 1000);
}
