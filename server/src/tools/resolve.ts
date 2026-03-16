import { nanoid } from "nanoid";
import { getThread, resolveThread, createReply, logOperation } from "../db.js";
import { broadcast } from "../ws.js";

export function ezraResolve(threadId: string, body?: string) {
  const thread = getThread(threadId);
  if (!thread) throw new Error(`Thread not found: ${threadId}`);

  if (body) {
    const replyId = nanoid(10);
    createReply(replyId, threadId, "Ezra", body);
  }

  resolveThread(threadId);
  logOperation("resolve", thread.doc_id, JSON.stringify({ thread_id: threadId }));
  broadcast("threads_update", { doc_id: thread.doc_id }, thread.doc_id);

  return { thread_id: threadId, status: "resolved" };
}
