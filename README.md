# Ezra

> **Research Preview** — This is an experimental prototype. Expect breaking changes and rough edges. Not security-hardened; designed for local use only. Feedback welcome via [GitHub Issues](https://github.com/shlomihod/ezra/issues).

AI document review with tracked changes and comments. A [Claude Code plugin](https://docs.anthropic.com/en/docs/claude-code/plugins) that gives Claude a rich-text editor with tracked changes and threaded comments.

## What It Does

Ezra provides Claude with MCP tools to review, edit, and annotate documents in a browser-based editor:

- **Tracked changes** — suggest insertions and deletions the user can accept or reject
- **Comment threads** — anchor comments to specific text, reply, and resolve
- **Direct edits** — make immediate changes when appropriate
- **Live browser UI** — all changes appear in real-time at `http://localhost:3333`

## Install as Claude Code Plugin

```bash
/plugin marketplace add shlomihod/ezra
```

Then use the skill:

```
/ezra Review the Consulting Agreement for legal issues
```

## Manual Setup

```bash
git clone https://github.com/shlomihod/ezra.git
cd ezra
npm install
npm run build
```

Then from your project directory:

```bash
claude --plugin-dir /path/to/ezra
```

## MCP Tools

| Tool | Description |
|---|---|
| `ezra_list` | List all documents |
| `ezra_open` | Open a document in the browser |
| `ezra_read` | Read document content with line numbers |
| `ezra_edit` | Direct text replacement |
| `ezra_write` | Overwrite entire document |
| `ezra_suggest` | Propose a tracked change for review |
| `ezra_comment` | Add a comment anchored to text |
| `ezra_reply` | Reply to a comment thread |
| `ezra_resolve` | Resolve a comment thread |
| `ezra_accept` | Accept a tracked change |
| `ezra_reject` | Reject a tracked change |
| `ezra_create` | Create a new document |
| `ezra_duplicate` | Duplicate a document |
| `ezra_import` | Import content as a new document |
| `ezra_threads` | Query comment threads |
| `ezra_changes_since` | Poll for recent operations |

## Development

```bash
npm run dev:server   # server with hot reload
npm run dev:client   # Vite dev server
npm test             # unit tests (server + client)
npm run test:e2e     # Playwright end-to-end tests
```
