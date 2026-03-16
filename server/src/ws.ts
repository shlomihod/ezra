import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface Client {
  ws: WebSocket;
  docId: string | null;
}

const clients = new Set<Client>();

export function hasConnectedClients(): boolean {
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

export function getOpenDocIds(): Set<string> {
  const ids = new Set<string>();
  for (const client of clients) {
    if (client.docId) ids.add(client.docId);
  }
  return ids;
}

export function broadcast(type: string, payload: unknown, docId?: string) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!docId || client.docId === docId) {
        client.ws.send(message);
      }
    }
  }
}


export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: ({ origin }: { origin?: string }) => {
      if (!origin) return true; // non-browser clients (no Origin header)
      try {
        const host = new URL(origin).hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
      } catch {
        return false;
      }
    },
  });

  wss.on("connection", (ws) => {
    const client: Client = { ws, docId: null };
    clients.add(client);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribe") {
          client.docId = msg.docId;
        } else if (msg.type === "unsubscribe") {
          client.docId = null;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(client);
    });
  });

  return wss;
}
