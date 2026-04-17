#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const BUILT_SERVER = resolve(ROOT, "server/dist/stdio.js");
const BUILT_CLIENT = resolve(ROOT, "client/dist/index.html");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: [0, 2, 2],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(BUILT_SERVER) || !existsSync(BUILT_CLIENT)) {
  run("npm", ["ci", "--no-fund"]);
  run("npm", ["run", "build"]);
}

await import(pathToFileURL(BUILT_SERVER).href);
