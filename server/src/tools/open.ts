import { getDocument } from "../db.js";
import { broadcast, hasConnectedClients } from "../ws.js";
import { createApp } from "../app.js";
import { PORT } from "../config.js";

let httpStarted = false;

function ensureHttpServer() {
  if (httpStarted) return;
  httpStarted = true;
  const { server } = createApp();
  server.listen(PORT, () => {
    console.error(`Ezra UI running on http://localhost:${PORT}`);
  });
}

let openBrowser: typeof import("open").default | undefined;

async function getOpenFn() {
  if (!openBrowser) {
    openBrowser = (await import("open")).default;
  }
  return openBrowser;
}

export async function ezraOpen(docId: string) {
  const doc = getDocument(docId);
  if (!doc) throw new Error(`Document not found: ${docId}`);

  ensureHttpServer();

  if (!hasConnectedClients()) {
    const open = await getOpenFn();
    await open(`http://localhost:${PORT}/#/${docId}`);
  } else {
    broadcast("open_doc", { doc_id: docId });
  }

  return { doc_id: docId, title: doc.title };
}
