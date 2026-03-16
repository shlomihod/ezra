import { nanoid } from "nanoid";
import { getThread, createReply, logOperation } from "../db.js";
import { broadcast } from "../ws.js";

export function ezraReply(threadId: string, body: string, author = "Claude") {
  const thread = getThread(threadId);
  if (!thread) throw new Error(`Thread not found: ${threadId}`);

  const replyId = nanoid(10);
  createReply(replyId, threadId, author, body);
  logOperation("reply", thread.doc_id, JSON.stringify({ thread_id: threadId, reply_id: replyId }));

  broadcast("threads_update", { doc_id: thread.doc_id }, thread.doc_id);

  return { reply_id: replyId, thread_id: threadId };
}
