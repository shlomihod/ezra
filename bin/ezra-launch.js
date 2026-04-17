#!/usr/bin/env node
import { existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const BUILT_SERVER = resolve(ROOT, "server/dist/stdio.js");
const LOCK = resolve(ROOT, "package-lock.json");
const STAMP = resolve(ROOT, "node_modules/.ezra-built");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: [0, 2, 2],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Fast path: stamp written after a full successful build; lockfile must
// not be newer than the stamp. Stamp presence means deps + server + client
// dists are all healthy from the same commit.
let fresh = existsSync(STAMP) && existsSync(BUILT_SERVER);
if (fresh && existsSync(LOCK)) {
  fresh = statSync(LOCK).mtimeMs <= statSync(STAMP).mtimeMs;
}

if (!fresh) {
  run("npm", ["ci", "--no-audit", "--no-fund"]);
  run("npm", ["run", "build"]);
  mkdirSync(dirname(STAMP), { recursive: true });
  writeFileSync(STAMP, String(Date.now()));
}

await import(pathToFileURL(BUILT_SERVER).href);
