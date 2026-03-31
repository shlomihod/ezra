#!/usr/bin/env bun

// Start the server
await import("../server/src/index.ts");

// Open the browser after a short delay (skip in CI)
if (!process.env.CI) {
  const open = (await import("open")).default;
  const port = process.env.PORT || 3333;
  setTimeout(() => {
    open(`http://localhost:${port}`);
  }, 1000);
}
