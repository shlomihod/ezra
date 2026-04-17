import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function resolveDbPath(): string {
  if (process.env.EZRA_DB_PATH) return process.env.EZRA_DB_PATH;
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  return path.join(projectDir, ".claude", "ezra", "docs.db");
}

const dbPath = resolveDbPath();
if (dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new Database(dbPath);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL REFERENCES documents(id),
    anchor_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS replies (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_threads_doc_id ON threads(doc_id);
  CREATE INDEX IF NOT EXISTS idx_replies_thread_id ON replies(thread_id);

  CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    doc_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Document CRUD ---

export function listDocuments() {
  return db.prepare("SELECT id, title, created_at, updated_at FROM documents ORDER BY updated_at DESC").all() as {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }[];
}

export function getDocument(id: string) {
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as
    | { id: string; title: string; content: string; created_at: string; updated_at: string }
    | undefined;
}

export function getDocOrThrow(id: string) {
  const doc = getDocument(id);
  if (!doc) throw new Error(`Document not found: ${id}`);
  return doc;
}

export function createDocument(id: string, title: string, content: string) {
  db.prepare("INSERT INTO documents (id, title, content) VALUES (?, ?, ?)").run(id, title, content);
}

export function updateDocumentContent(id: string, content: string) {
  db.prepare("UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
}

/**
 * Atomically update document content and log the operation.
 */
export const updateAndLog: (docId: string, content: string, opType: string, details: string | null) => void = db.transaction(
  (docId: string, content: string, opType: string, details: string | null) => {
    db.prepare("UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, docId);
    db.prepare("INSERT INTO operations (type, doc_id, details) VALUES (?, ?, ?)").run(opType, docId, details);
  }
);

// --- Thread CRUD ---

export function getThreadsForDoc(docId: string) {
  const rows = db.prepare(`
    SELECT t.id, t.doc_id, t.anchor_text, t.status, t.created_at,
           r.id as reply_id, r.author as reply_author, r.body as reply_body, r.created_at as reply_created_at
    FROM threads t
    LEFT JOIN replies r ON r.thread_id = t.id
    WHERE t.doc_id = ?
    ORDER BY t.created_at ASC, r.created_at ASC
  `).all(docId) as {
    id: string;
    doc_id: string;
    anchor_text: string;
    status: string;
    created_at: string;
    reply_id: string | null;
    reply_author: string | null;
    reply_body: string | null;
    reply_created_at: string | null;
  }[];

  const threadsMap = new Map<string, {
    id: string;
    doc_id: string;
    anchor_text: string;
    status: string;
    created_at: string;
    replies: { id: string; thread_id: string; author: string; body: string; created_at: string }[];
  }>();

  for (const row of rows) {
    if (!threadsMap.has(row.id)) {
      threadsMap.set(row.id, {
        id: row.id,
        doc_id: row.doc_id,
        anchor_text: row.anchor_text,
        status: row.status,
        created_at: row.created_at,
        replies: [],
      });
    }
    if (row.reply_id) {
      threadsMap.get(row.id)!.replies.push({
        id: row.reply_id,
        thread_id: row.id,
        author: row.reply_author!,
        body: row.reply_body!,
        created_at: row.reply_created_at!,
      });
    }
  }

  return Array.from(threadsMap.values());
}

export function getThread(id: string) {
  return db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as
    | { id: string; doc_id: string; anchor_text: string; status: string; created_at: string }
    | undefined;
}

export function createThread(id: string, docId: string, anchorText: string) {
  db.prepare("INSERT INTO threads (id, doc_id, anchor_text) VALUES (?, ?, ?)").run(id, docId, anchorText);
}

export function resolveThread(id: string) {
  db.prepare("UPDATE threads SET status = 'resolved' WHERE id = ?").run(id);
}

// --- Reply CRUD ---

export function getRepliesForThread(threadId: string) {
  return db.prepare("SELECT * FROM replies WHERE thread_id = ? ORDER BY created_at ASC").all(threadId) as {
    id: string;
    thread_id: string;
    author: string;
    body: string;
    created_at: string;
  }[];
}

export function createReply(id: string, threadId: string, author: string, body: string) {
  db.prepare("INSERT INTO replies (id, thread_id, author, body) VALUES (?, ?, ?, ?)").run(id, threadId, author, body);
}

// --- Operations log ---

export function logOperation(type: string, docId: string | null, details: string | null) {
  db.prepare("INSERT INTO operations (type, doc_id, details) VALUES (?, ?, ?)").run(type, docId, details);
}

export function getOperationsSince(cursor: number) {
  return db.prepare("SELECT * FROM operations WHERE id > ? ORDER BY id").all(cursor) as {
    id: number;
    type: string;
    doc_id: string | null;
    details: string | null;
    created_at: string;
  }[];
}

export const clearAll = db.transaction(() => {
  db.exec("DELETE FROM replies");
  db.exec("DELETE FROM threads");
  db.exec("DELETE FROM operations");
  db.exec("DELETE FROM documents");
});

export default db;
