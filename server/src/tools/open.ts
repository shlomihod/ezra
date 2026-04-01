import { getDocument } from "../db.js";
import { broadcast, hasConnectedClients } from "../ws.js";
import { createApp } from "../app.js";
import { PORT } from "../config.js";

let serverReady: Promise<void> | null = null;
let actualPort = Number(PORT);

function ensureHttpServer(): Promise<void> {
  if (serverReady) return serverReady;
  const { server } = createApp();

  serverReady = new Promise<void>((resolve, reject) => {
    const maxPort = Number(PORT) + 10;
    const tryPort = (port: number) => {
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port < maxPort) {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, () => {
        actualPort = port;
        console.error(`Ezra UI running on http://localhost:${port}`);
        resolve();
      });
    };
    tryPort(Number(PORT));
  });

  return serverReady;
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

  await ensureHttpServer();

  if (!hasConnectedClients()) {
    const open = await getOpenFn();
    await open(`http://localhost:${actualPort}/#/${docId}`);
  } else {
    broadcast("open_doc", { doc_id: docId });
  }

  return { doc_id: docId, title: doc.title };
}
